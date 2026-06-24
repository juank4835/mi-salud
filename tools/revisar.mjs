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
  const valores = (data.valores || []).map(v => ({
    nombre: v.nombre ?? "", valor: v.valor ?? null, unidad: v.unidad ?? "",
    ref: v.ref ?? "", refMin: v.refMin ?? null, refMax: v.refMax ?? null,
    fuera: v.fuera ?? null,
  }));
  await dbf.doc(docPath).set({
    estado: "revisado",
    resumen: data.resumen ?? "",
    comparacion: data.comparacion ?? "",
    valores,
    revisadoEl: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log("OK: " + docPath + " marcado como revisado.");
}

const cmds = { list, pull, save };
if (!cmds[cmd]) {
  console.error("Comandos: list [--all] | pull <storagePath> [dir] | save <docPath> <json>");
  process.exit(1);
}
await cmds[cmd]().catch(e => { console.error(e.message || e); process.exit(1); });
process.exit(0);
