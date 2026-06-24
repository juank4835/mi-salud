// ===========================================================
//  Autenticación — login Google restringido a tu correo
// ===========================================================
import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from "./firebase.js";
import { ALLOWED_EMAIL } from "./firebase-config.js";

let currentUser = null;

export function getUser() { return currentUser; }
export function getUid()  { return currentUser ? currentUser.uid : null; }

// Llama a `onChange(user|null)` cada vez que cambia el estado de sesión.
export function watchAuth(onChange) {
  onAuthStateChanged(auth, (user) => {
    if (user && user.email !== ALLOWED_EMAIL) {
      // Cuenta no autorizada: cerrar sesión de inmediato.
      signOut(auth);
      currentUser = null;
      onChange(null, "Esta cuenta no tiene acceso.");
      return;
    }
    currentUser = user || null;
    onChange(currentUser, null);
  });
}

export async function login() {
  try {
    const cred = await signInWithPopup(auth, provider);
    if (cred.user.email !== ALLOWED_EMAIL) {
      await signOut(auth);
      throw new Error("Esta cuenta no tiene acceso.");
    }
  } catch (e) {
    if (e.code === "auth/popup-closed-by-user") return;
    throw e;
  }
}

export function logout() { return signOut(auth); }
