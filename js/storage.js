// ===========================================================
//  Subida de archivos a Firebase Storage
//  Ruta: users/{uid}/examenes/{timestamp}-{nombre}
// ===========================================================
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { storage } from "./firebase.js";
import { getUid } from "./auth.js";

function limpiarNombre(n) {
  return n.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

// Sube un File. `onProgress(0..100)` opcional.
// Devuelve { storagePath, downloadURL, contentType, size, nombreArchivo }.
export async function subirExamen(file, onProgress) {
  const uid = getUid();
  if (!uid) throw new Error("Sin sesión");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const nombreArchivo = `${ts}-${limpiarNombre(file.name)}`;
  const storagePath = `users/${uid}/examenes/${nombreArchivo}`;
  const r = ref(storage, storagePath);

  const task = uploadBytesResumable(r, file, { contentType: file.type });
  await new Promise((resolve, reject) => {
    task.on("state_changed",
      (s) => { if (onProgress) onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)); },
      reject, resolve);
  });

  const downloadURL = await getDownloadURL(r);
  return { storagePath, downloadURL, contentType: file.type, size: file.size, nombreArchivo };
}

export async function borrarArchivo(storagePath) {
  if (!storagePath) return;
  try { await deleteObject(ref(storage, storagePath)); } catch (e) { console.warn("borrarArchivo", e); }
}
