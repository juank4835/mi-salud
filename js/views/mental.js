// ===========================================================
//  Vista Salud mental
//  Registro de ejercicios de ACT ("La trampa de la felicidad",
//  Russ Harris): qué practicaste, qué notaste, y una foto opcional.
// ===========================================================
import { watch, crear, actualizar, borrar } from "../db.js";
import { subirExamen, borrarArchivo } from "../storage.js";
import { esc, toast, vacio, hoyISO, fmtFecha, $ } from "../ui.js";

const COL = "mental";
// Los 6 procesos de ACT (el "hexaflex") + Otro.
const AREAS = ["Defusión", "Aceptación / Expansión", "Atención plena", "Yo observador",
  "Valores", "Acción comprometida", "Otro"];

function modalEntrada(e = {}) {
  return new Promise((resolve) => {
    const root = $("#modal-root");
    const editando = !!e.id;
    root.innerHTML = `
      <div class="modal" id="m-ov"><div class="modal__sheet" role="dialog" aria-modal="true">
        <div class="modal__head"><h2>${editando ? "Editar ejercicio" : "Nuevo ejercicio"}</h2>
          <button class="modal__close" id="m-cl" aria-label="Cerrar">×</button></div>
        <form class="form" id="m-f">
          <div class="field"><label for="f-ej">Ejercicio</label>
            <input id="f-ej" placeholder="Ej: Hojas en la corriente" value="${esc(e.ejercicio || "")}" required /></div>
          <div class="field--row">
            <div class="field"><label for="f-fecha">Fecha</label>
              <input id="f-fecha" type="date" value="${e.fecha || hoyISO()}" required /></div>
            <div class="field"><label for="f-area">Proceso (ACT)</label>
              <select id="f-area">${AREAS.map(a => `<option ${a === e.area ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></div>
          </div>
          <div class="field"><label for="f-ref">Reflexión / qué noté</label>
            <textarea id="f-ref" placeholder="Cómo me fue, qué observé, qué me costó, qué aprendí...">${esc(e.reflexion || "")}</textarea></div>
          <div class="field"><label for="f-file">Foto o PDF de la hoja (opcional)</label>
            <input id="f-file" type="file" accept="application/pdf,image/*" /></div>
          ${e.downloadURL ? `<a class="btn btn--block btn--ghost" href="${esc(e.downloadURL)}" target="_blank" rel="noopener">Ver archivo adjunto</a>` : ""}
          <div id="m-prog" class="muted" style="display:none">Subiendo… <span id="m-pct">0</span>%</div>
          <div class="form__actions">
            ${editando ? `<button type="button" class="btn btn--danger" id="m-del">Eliminar</button>` : ""}
            <button type="submit" class="btn btn--primary" id="m-go">Guardar</button>
          </div>
        </form>
      </div></div>`;

    const close = (v) => { root.innerHTML = ""; resolve(v); };
    $("#m-cl").onclick = () => close(null);
    $("#m-ov").onclick = (ev) => { if (ev.target.id === "m-ov") close(null); };
    if (editando) $("#m-del").onclick = async () => {
      if (!confirm("¿Eliminar este ejercicio? No se puede deshacer.")) return;
      if (e.storagePath) await borrarArchivo(e.storagePath);
      await borrar(COL, e.id); toast("Eliminado"); close(null);
    };
    $("#m-f").onsubmit = async (ev) => {
      ev.preventDefault();
      $("#m-go").disabled = true; $("#m-go").textContent = "Guardando…";
      const data = {
        ejercicio: $("#f-ej").value.trim(), fecha: $("#f-fecha").value,
        area: $("#f-area").value, reflexion: $("#f-ref").value.trim(),
      };
      const file = $("#f-file").files[0];
      try {
        if (file) { $("#m-prog").style.display = ""; const meta = await subirExamen(file, p => { $("#m-pct").textContent = p; }); Object.assign(data, meta); }
        if (editando) await actualizar(COL, e.id, data); else await crear(COL, data);
        toast(editando ? "Guardado" : "Ejercicio agregado"); close(true);
      } catch (err) {
        console.error(err);
        $("#m-prog").innerHTML = `<span style="color:var(--danger)">Error al subir. Revisa la conexión.</span>`;
        $("#m-go").disabled = false; $("#m-go").textContent = "Guardar";
      }
    };
  });
}

function fila(e) {
  const snippet = e.reflexion ? `${esc(e.reflexion.slice(0, 70))}${e.reflexion.length > 70 ? "…" : ""}` : "";
  return `<div class="row" data-id="${e.id}" style="cursor:pointer">
    <div class="row__accent accent--info"></div>
    <div class="row__main">
      <div class="row__title">${esc(e.ejercicio || "Ejercicio")}</div>
      <div class="row__sub">${fmtFecha(e.fecha)}${e.area ? ` · ${esc(e.area)}` : ""}${snippet ? ` · ${snippet}` : ""}</div>
    </div>
    ${e.downloadURL ? `<div class="row__meta"><span class="pill">archivo</span></div>` : ""}
  </div>`;
}

export default function render(app) {
  app.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <strong>Salud mental</strong>
      <p class="muted" style="margin:6px 0 0;font-size:14px">Registra los ejercicios de "La trampa de la felicidad" (ACT) que vas haciendo: qué practicaste, qué notaste y, si quieres, una foto de la hoja.</p>
    </div>
    <div class="list" id="lista"><div class="spinner"></div></div>
    <button class="fab" id="fab" aria-label="Agregar ejercicio">+</button>`;

  app.querySelector("#fab").onclick = () => modalEntrada();

  let items = [];
  const lista = app.querySelector("#lista");
  const unsub = watch(COL, "fecha", (arr) => {
    items = arr;
    if (!arr.length) { lista.innerHTML = vacio("✎", "Aún sin ejercicios", "Toca + para registrar tu primer ejercicio de ACT."); return; }
    lista.innerHTML = arr.map(fila).join("");
    lista.querySelectorAll(".row").forEach(r => r.onclick = () => modalEntrada(items.find(x => x.id === r.dataset.id)));
  });
  return unsub;
}
