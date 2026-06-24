// ===========================================================
//  Configuración de Firebase — proyecto "mi-salud-daf44"
// -----------------------------------------------------------
//  Estas claves web NO son secretas: van en el frontend y están
//  protegidas por las reglas de seguridad (firestore.rules /
//  storage.rules). El archivo secreto es tools/serviceAccount.json.
// ===========================================================

export const firebaseConfig = {
  apiKey:            "AIzaSyAxt-V7wchxRtwy8GqG_XpOAK_Mgw14IUI",
  authDomain:        "mi-salud-daf44.firebaseapp.com",
  projectId:         "mi-salud-daf44",
  storageBucket:     "mi-salud-daf44.firebasestorage.app",
  messagingSenderId: "407866809315",
  appId:             "1:407866809315:web:37c204c65609ec4ed3ded6",
};

// Solo este correo puede entrar y leer/escribir datos.
export const ALLOWED_EMAIL = "juank4835@gmail.com";
