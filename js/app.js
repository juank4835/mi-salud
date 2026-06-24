// ===========================================================
//  App — arranque, router por hash y control de sesión
// ===========================================================
import { watchAuth, login, logout } from "./auth.js";
import { $, $$ } from "./ui.js";

import inicio       from "./views/inicio.js";
import medicamentos from "./views/medicamentos.js";
import citas        from "./views/citas.js";
import examenes     from "./views/examenes.js";
import diario       from "./views/diario.js";

const VISTAS = {
  inicio:       { titulo: "Inicio",       render: inicio },
  medicamentos: { titulo: "Medicamentos", render: medicamentos },
  citas:        { titulo: "Citas",        render: citas },
  examenes:     { titulo: "Exámenes",     render: examenes },
  diario:       { titulo: "Diario",       render: diario },
};

let cleanup = null;   // función para desuscribir listeners de la vista actual

function rutaActual() {
  const h = location.hash.replace(/^#\//, "");
  return VISTAS[h] ? h : "inicio";
}

async function render() {
  const clave = rutaActual();
  const vista = VISTAS[clave];

  // limpia listeners de la vista anterior
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }

  $("#topbar-title").textContent = vista.titulo;
  $$(".tab").forEach(t => t.classList.toggle("is-active", t.dataset.tab === clave));

  const app = $("#app");
  app.innerHTML = `<div class="spinner"></div>`;
  cleanup = await vista.render(app);
}

function mostrarApp(user) {
  $("#login").classList.add("hidden");
  $("#shell").classList.remove("hidden");
  if (!location.hash) location.hash = "#/inicio";
  render();
}

function mostrarLogin(error) {
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  $("#shell").classList.add("hidden");
  $("#login").classList.remove("hidden");
  $("#login-error").textContent = error || "";
}

function init() {
  // Botones de sesión
  $("#btn-login").onclick = async () => {
    $("#login-error").textContent = "";
    try { await login(); }
    catch (e) { $("#login-error").textContent = e.message || "No se pudo iniciar sesión."; }
  };
  $("#btn-logout").onclick = () => logout();

  // Router
  window.addEventListener("hashchange", () => {
    if (!$("#shell").classList.contains("hidden")) render();
  });

  // Estado de sesión
  watchAuth((user, error) => {
    $("#splash").classList.add("splash--gone");
    if (user) mostrarApp(user);
    else mostrarLogin(error);
  });

  // Service worker (PWA)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
