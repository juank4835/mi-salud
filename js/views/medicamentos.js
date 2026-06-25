// ===========================================================
//  Vista Medicamentos
// ===========================================================
import { watch, crear, actualizar, borrar } from "../db.js";
import { esc, formModal, toast, vacio, hoyISO, fmtFecha } from "../ui.js";

const COL = "medicamentos";
const FRECUENCIAS = ["Cada 8 horas", "Cada 12 horas", "Cada 24 horas", "Una vez al día",
  "Dos veces al día", "Tres veces al día", "Semanal", "Según necesidad", "Otra"];

function campos(med = {}) {
  return [
    { name: "nombre",     label: "Medicamento", value: med.nombre, required: true, placeholder: "Ej: Losartán" },
    { name: "dosis",      label: "Dosis",       value: med.dosis,  placeholder: "Ej: 50 mg" },
    { name: "frecuencia", label: "Frecuencia",  type: "select", value: med.frecuencia || FRECUENCIAS[0], options: FRECUENCIAS },
    { name: "horarios",   label: "Horarios",    value: med.horarios, placeholder: "Ej: 7:00, 19:00" },
    { name: "inicio",     label: "Desde (cuándo lo empezaste)", type: "date", value: med.inicio || (med.id ? "" : hoyISO()) },
    { name: "fin",        label: "Hasta (si lo suspendiste)",   type: "date", value: med.fin || "" },
    { name: "estado",     label: "Estado",      type: "select", value: med.estado || "Activo", options: ["Activo", "Suspendido"] },
    { name: "notas",      label: "Notas",       type: "textarea", value: med.notas, placeholder: "Indicaciones, médico que lo formuló..." },
  ];
}

async function nuevo() {
  const d = await formModal({ titulo: "Nuevo medicamento", campos: campos() });
  if (d) { await crear(COL, d); toast("Medicamento agregado"); }
}

async function editar(med) {
  const d = await formModal({
    titulo: "Editar medicamento",
    campos: campos(med),
    onDelete: () => borrar(COL, med.id),
  });
  if (d) { await actualizar(COL, med.id, d); toast("Guardado"); }
}

function fila(med) {
  const activo = (med.estado || "Activo") === "Activo";
  const pill = activo ? `<span class="pill pill--ok">Activo</span>` : `<span class="pill">Suspendido</span>`;
  return `<div class="row" data-id="${med.id}" style="cursor:pointer">
    <div class="row__accent ${activo ? "accent--ok" : ""}" ${activo ? "" : 'style="background:var(--border)"'}></div>
    <div class="row__main">
      <div class="row__title">${esc(med.nombre)} ${med.dosis ? `<span class="muted">· ${esc(med.dosis)}</span>` : ""}</div>
      <div class="row__sub">${esc(med.frecuencia || "")}${med.horarios ? ` · ${esc(med.horarios)}` : ""}${med.inicio ? ` · desde ${fmtFecha(med.inicio)}` : ""}${(!activo && med.fin) ? ` · hasta ${fmtFecha(med.fin)}` : ""}</div>
    </div>
    <div class="row__meta">${pill}</div>
  </div>`;
}

export default function render(app) {
  app.innerHTML = `
    <div class="section">
      <div class="list" id="lista"><div class="spinner"></div></div>
    </div>
    <button class="fab" id="fab" aria-label="Agregar">+</button>`;

  app.querySelector("#fab").onclick = nuevo;

  let meds = [];
  const lista = app.querySelector("#lista");

  const unsub = watch(COL, "estado", (items) => {
    meds = items;
    if (!items.length) { lista.innerHTML = vacio("℞", "Sin medicamentos", "Toca + para agregar el primero."); return; }
    // Activos primero
    items.sort((a, b) => ((a.estado || "Activo") === "Activo" ? 0 : 1) - ((b.estado || "Activo") === "Activo" ? 0 : 1));
    lista.innerHTML = items.map(fila).join("");
    lista.querySelectorAll(".row").forEach(r =>
      r.onclick = () => editar(meds.find(m => m.id === r.dataset.id)));
  });

  return unsub;
}
