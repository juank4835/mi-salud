#!/usr/bin/env node
// ===========================================================
//  Puente de revisión de exámenes (uso de Claude / línea de comandos)
//
//  Permite, desde tu Mac, listar los exámenes pendientes, bajar el
//  archivo para que Claude lo lea, y escribir de vuelta el análisis
//  (resumen, comparación y valores) en Firestore.
//
//  Requiere:
//    - tools/serviceAccount.json  (Firebase Console > Project settings
//      > Service accounts > Generate new private key)
//    - npm install   (dentro de tools/)
//
//  Comandos:
//    node revisar.mjs list [--all]
//        Lista exámenes pendientes (o todos con --all) como JSON.
//    node revisar.mjs pull <storagePath> [carpetaDestino]
//        Baja el archivo del examen y muestra la ruta local.
//    node revisar.mjs save <docPath> <archivo.json>
//        Escribe el análisis y marca el examen como revisado.
//        docPath = users/<uid>/examenes/<id>
//        El JSON debe tener: { resumen, comparacion, valores: [
//          { nombre, valor, unidad, ref, refMin, refMax, fuera } ] }
//        donde `fuera` es "alto", "bajo" o null.
// ===========================================================
import { readFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import admin from "firebase-admin";
import { firebaseConfig } from "../js/firebase-config.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const SA_PATH = join(__dir, "serviceAccount.json");

if (!existsSync(SA_PATH)) {
  console.error("Falta tools/serviceAccount.json. Descárgalo de Firebase Console > Project settings > Service accounts.");
  process.exit(1);
}

const sa = JSON.parse(await readFile(SA_PATH, "utf8"));
// Bucket exacto del proyecto (los proyectos nuevos usan .firebasestorage.app).
const bucket = process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || `${sa.project_id}.appspot.com`;
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: bucket });

const dbf = admin.firestore();
const [cmd, ...rest] = process.argv.slice(2);

async function list() {
  const all = rest.includes("--all");
  // Sin where() para no requerir índices; filtramos en código.
  const snap = await dbf.collectionGroup("examenes").get();
  const out = snap.docs.map(d => {
    const x = d.data();
    return {
      path: d.ref.path, id: d.id, uid: d.ref.path.split("/")[1],
      titulo: x.titulo, fecha: x.fecha, tipo: x.tipo, estado: x.estado,
      storagePath: x.storagePath, contentType: x.contentType, downloadURL: x.downloadURL,
    };
  })
  .filter(x => all || x.estado === "pendiente")
  .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  console.log(JSON.stringify(out, null, 2));
}

async function pull() {
  const storagePath = rest[0];
  if (!storagePath) { console.error("Uso: pull <storagePath> [carpetaDestino]"); process.exit(1); }
  const destDir = rest[1] || join(__dir, "_review");
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, basename(storagePath));
  await admin.storage().bucket().file(storagePath).download({ destination: dest });
  console.log(dest);
}

async function save() {
  const docPath = rest[0], jsonPath = rest[1];
  if (!docPath || !jsonPath) { console.error("Uso: save <docPath> <archivo.json>"); process.exit(1); }
  const data = JSON.parse(await readFile(jsonPath, "utf8"));

  const parts = docPath.split("/");          // users/{uid}/examenes/{id}
  const uid = parts[1], examenId = parts[3];
  const fecha = data.fecha || null;          // FECHA REAL del laboratorio (del PDF)
  const fuente = data.fuente ?? "";

  // Lista de métricas que vienen del PDF ya partido.
  const metricas = (data.metricas || data.valores || []).map(m => ({
    nombre: m.nombre ?? "", categoria: m.categoria ?? "Otros",
    valor: m.valor ?? null, unidad: m.unidad ?? "",
    ref: m.ref ?? "", refMin: m.refMin ?? null, refMax: m.refMax ?? null,
    fuera: m.fuera ?? null,
    analisis: m.analisis ?? "",          // explicación individual de la métrica
  }));

  // 1) Actualiza el documento del examen (resumen, fecha real, copia de valores).
  const examUpdate = {
    estado: "revisado",
    resumen: data.resumen ?? "",
    comparacion: data.comparacion ?? "",
    valores: metricas,                       // copia para el detalle del examen
    fuente,
    revisadoEl: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (data.titulo) examUpdate.titulo = data.titulo;
  if (data.tipo) examUpdate.tipo = data.tipo;
  if (fecha) examUpdate.fecha = fecha;        // corrige a la fecha real del examen
  await dbf.doc(docPath).set(examUpdate, { merge: true });

  // 2) Catálogo de indicadores: una lectura fechada por métrica.
  //    Idempotente: borra las de este examen y reinserta.
  const mcol = dbf.collection(`users/${uid}/metricas`);
  const prev = await mcol.where("examenId", "==", examenId).get();
  const batch = dbf.batch();
  prev.forEach(d => batch.delete(d.ref));
  metricas.forEach(m => batch.set(mcol.doc(), {
    ...m, examenId, fecha, fuente,
    creado: admin.firestore.FieldValue.serverTimestamp(),
  }));
  await batch.commit();

  console.log(`OK: ${examenId} revisado · ${metricas.length} indicadores guardados (fecha ${fecha || "s/f"}).`);
}

// Sube un archivo local a Storage y crea el examen (estado pendiente).
// Imprime el docPath para luego revisarlo con `save`.
async function upload() {
  const localFile = rest[0], uid = rest[1];
  if (!localFile || !uid) { console.error("Uso: upload <archivoLocal> <uid> [titulo] [fecha] [tipo]"); process.exit(1); }
  if (!existsSync(localFile)) { console.error("No existe: " + localFile); process.exit(1); }
  const titulo = rest[2] || basename(localFile);
  const fecha = rest[3] || new Date().toISOString().slice(0, 10);
  const tipo = rest[4] || "Laboratorio";
  const ext = (basename(localFile).match(/\.[^.]+$/) || [""])[0].toLowerCase();
  const ctype = ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png"
    : (ext === ".jpg" || ext === ".jpeg") ? "image/jpeg" : "application/octet-stream";
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const safe = basename(localFile).normalize("NFD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const storagePath = `users/${uid}/examenes/${ts}-${safe}`;
  const token = randomUUID();
  await admin.storage().bucket().upload(localFile, {
    destination: storagePath,
    metadata: { contentType: ctype, metadata: { firebaseStorageDownloadTokens: token } },
  });
  const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
  const ref = await dbf.collection(`users/${uid}/examenes`).add({
    titulo, fecha, tipo, estado: "pendiente",
    storagePath, downloadURL, contentType: ctype, nombreArchivo: `${ts}-${safe}`,
    creado: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(ref.path);
}

const cmds = { list, pull, save, upload };
if (!cmds[cmd]) {
  console.error("Comandos: list [--all] | pull <storagePath> [dir] | save <docPath> <json> | upload <archivo> <uid> [titulo] [fecha] [tipo]");
  process.exit(1);
}
await cmds[cmd]().catch(e => { console.error(e.message || e); process.exit(1); });
process.exit(0);
