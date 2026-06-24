// ===========================================================
//  Capa de datos — CRUD genérico sobre Firestore
//  Estructura: /users/{uid}/{coleccion}/{doc}
// ===========================================================
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase.js";
import { getUid } from "./auth.js";

function col(nombre) {
  const uid = getUid();
  if (!uid) throw new Error("Sin sesión");
  return collection(db, "users", uid, nombre);
}

// Escucha en tiempo real una colección, ordenada por un campo.
// `cb` recibe un array de documentos [{ id, ...datos }].
export function watch(nombre, campoOrden, cb, desc = true) {
  const q = query(col(nombre), orderBy(campoOrden, desc ? "desc" : "asc"));
  return onSnapshot(q,
    (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => { console.error("watch", nombre, err); cb([], err); }
  );
}

export function crear(nombre, datos) {
  return addDoc(col(nombre), { ...datos, creado: serverTimestamp() });
}

export function actualizar(nombre, id, datos) {
  const uid = getUid();
  return updateDoc(doc(db, "users", uid, nombre, id), datos);
}

export function borrar(nombre, id) {
  const uid = getUid();
  return deleteDoc(doc(db, "users", uid, nombre, id));
}
