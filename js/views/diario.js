// ===========================================================
//  Vista Diario — síntomas, ánimo y mediciones del día
// ===========================================================
import { watch, crear, actualizar, borrar } from "../db.js";
import { esc, formModal, toast, vacio, hoyISO, fmtFecha } from "../ui.js";

const COL = "diario";
const ANIMOS = ["Muy bien", "Bien", "Regular", "Mal", "Muy mal"];

function campos(e = {}) {
  return [
    { name: "fecha",      label: "Fecha",            type: "date", value: e.fecha || hoyISO(), required: true },
    { name: "animo",      label: "¿Cómo te sientes?",type: "select", value: e.animo || "Bien", options: ANIMOS },
    { name: "intensidad", label: "Malestar (0-10)",  type: "number", step: "1", value: e.intensidad, placeholder: "0 = nada, 10 = máximo" },
    { name: "sintomas",   label: "Síntomas",         value: e.sintomas, placeholder: "Ej: dolor de cabeza, mareo" },
    { name: "peso",       label: "Peso (kg)",        type: "number", step: "0.1", value: e.peso, placeholder: "Ej: 72.5" },
    { name: "presion",    label: "Presión (sis/dia)",value: e.presion, placeholder: "Ej: 120/80" },
    { name: "glucosa",    label: "Glucosa (mg/dL)",  type: "number", step: "1", value: e.glucosa, placeholder: "Opcional" },
    { name: "notas",      label: "Notas",            type: "textarea", value: e.notas, placeholder: "Qué hiciste, qué comiste, cómo dormiste..." },
  ];
}

async function nuevo() {
  const d = await formModal({ titulo: "Nuevo registro", campos: campos() });
  if (d) { await crear(COL, d); toast("Registro agregado"); }
}
async function editar(e) {
  const d = await formModal({ titulo: "Editar registro", campos: campos(e), onDelete: () => borrar(COL, e.id) });
  if (d) { await actualizar(COL, e.id, d); toast("Guardado"); }
}

function animoClase(a) {
  if (a === "Muy bien" || a === "Bien") return "accent--ok";
  if (a === "Regular") return "accent--warn";
  return "accent--danger";
}

function fila(e) {
  const datos = [];
  if (e.peso)    datos.push(`${e.peso} kg`);
  if (e.presion) datos.push(`PA ${esc(e.presion)}`);
  if (e.glucosa) datos.push(`Gluc ${e.glucosa}`);
  if (e.intensidad != null && e.intensidad !== "") datos.push(`malestar ${e.intensidad}/10`);
  return `<div class="row" data-id="${e.id}" style="cursor:pointer">
    <div class="row__accent ${animoClase(e.animo)}"></div>
    <div class="row__main">
      <div class="row__title">${fmtFecha(e.fecha)} <span class="muted">· ${esc(e.animo || "")}</span></div>
      <div class="row__sub">${e.sintomas ? esc(e.sintomas) : "<span class='muted'>sin síntomas</span>"}${datos.length ? ` · ${datos.join(" · ")}` : ""}</div>
    </div>
  </div>`;
}

export default function render(app) {
  app.innerHTML = `
    <div class="section">
      <div class="list" id="lista"><div class="spinner"></div></div>
    </div>
    <button class="fab" id="fab" aria-label="Agregar">+</button>`;
  app.querySelector("#fab").onclick = nuevo;

  let regs = [];
  const lista = app.querySelector("#lista");

  const unsub = watch(COL, "fecha", (items) => {
    regs = items;
    if (!items.length) { lista.innerHTML = vacio("✎", "Diario vacío", "Toca + para registrar cómo te sientes hoy."); return; }
    lista.innerHTML = items.map(fila).join("");
    lista.querySelectorAll(".row").forEach(r =>
      r.onclick = () => editar(regs.find(x => x.id === r.dataset.id)));
  });

  return unsub;
}
