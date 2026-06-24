// ===========================================================
//  Vista Citas médicas
// ===========================================================
import { watch, crear, actualizar, borrar } from "../db.js";
import { esc, formModal, toast, vacio, hoyISO, fmtFecha, diasHasta } from "../ui.js";

const COL = "citas";

function campos(c = {}) {
  return [
    { name: "especialidad", label: "Especialidad", value: c.especialidad, required: true, placeholder: "Ej: Cardiología" },
    { name: "medico",       label: "Médico",       value: c.medico, placeholder: "Dr(a). ..." },
    { name: "fecha",        label: "Fecha",        type: "date", value: c.fecha || hoyISO(), required: true },
    { name: "hora",         label: "Hora",         type: "time", value: c.hora || "08:00" },
    { name: "lugar",        label: "Lugar",        value: c.lugar, placeholder: "Clínica, dirección..." },
    { name: "motivo",       label: "Motivo",       value: c.motivo, placeholder: "Control, examen, síntoma..." },
    { name: "notas",        label: "Notas de la consulta", type: "textarea", value: c.notas, placeholder: "Qué dijo el médico, órdenes, próximos pasos..." },
  ];
}

async function nuevo() {
  const d = await formModal({ titulo: "Nueva cita", campos: campos() });
  if (d) { await crear(COL, d); toast("Cita agregada"); }
}
async function editar(c) {
  const d = await formModal({ titulo: "Editar cita", campos: campos(c), onDelete: () => borrar(COL, c.id) });
  if (d) { await actualizar(COL, c.id, d); toast("Guardado"); }
}

function fila(c) {
  const dias = diasHasta(c.fecha);
  let pill = "", accent = "accent--info";
  if (dias !== null) {
    if (dias < 0)       { pill = `<span class="pill">Pasada</span>`; accent = ""; }
    else if (dias === 0){ pill = `<span class="pill pill--warn">Hoy</span>`; accent = "accent--warn"; }
    else if (dias <= 7) { pill = `<span class="pill pill--warn">En ${dias} d</span>`; accent = "accent--warn"; }
    else                { pill = `<span class="pill pill--ok">En ${dias} d</span>`; }
  }
  return `<div class="row" data-id="${c.id}" style="cursor:pointer">
    <div class="row__accent ${accent}" ${accent ? "" : 'style="background:var(--border)"'}></div>
    <div class="row__main">
      <div class="row__title">${esc(c.especialidad)}${c.medico ? ` <span class="muted">· ${esc(c.medico)}</span>` : ""}</div>
      <div class="row__sub">${fmtFecha(c.fecha)}${c.hora ? ` · ${esc(c.hora)}` : ""}${c.lugar ? ` · ${esc(c.lugar)}` : ""}</div>
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

  let citas = [];
  const lista = app.querySelector("#lista");

  const unsub = watch(COL, "fecha", (items) => {
    citas = items;
    if (!items.length) { lista.innerHTML = vacio("◷", "Sin citas", "Toca + para agendar la primera."); return; }
    const hoy = hoyISO();
    const futuras = items.filter(c => c.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pasadas = items.filter(c => c.fecha <  hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
    lista.innerHTML =
      (futuras.length ? `<div class="section__head"><h2>Próximas</h2></div>` + futuras.map(fila).join("") : "") +
      (pasadas.length ? `<div class="section__head mt"><h2>Anteriores</h2></div>` + pasadas.map(fila).join("") : "");
    lista.querySelectorAll(".row").forEach(r =>
      r.onclick = () => editar(citas.find(c => c.id === r.dataset.id)));
  });

  return unsub;
}
