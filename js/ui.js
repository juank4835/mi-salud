// ===========================================================
//  Utilidades de interfaz: modales, formularios, fechas
// ===========================================================

export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// Escapa texto para insertar seguro en HTML.
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// ---------- Fechas ----------
export function hoyISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function fmtFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d} ${meses[m - 1]} ${y}`;
}

export function diasHasta(iso) {
  if (!iso) return null;
  const hoy = new Date(hoyISO());
  const f = new Date(iso);
  return Math.round((f - hoy) / 86400000);
}

// ---------- Modal con formulario ----------
//  campos: [{ name, label, type, value, options?, required?, placeholder?, step?, full? }]
//  Devuelve una Promise que resuelve con los datos, o null si se cancela.
export function formModal({ titulo, campos, submitLabel = "Guardar", onDelete }) {
  return new Promise((resolve) => {
    const root = $("#modal-root");

    const campoHTML = (c) => {
      const id = `f-${c.name}`;
      let control;
      if (c.type === "select") {
        control = `<select id="${id}" name="${c.name}" ${c.required ? "required" : ""}>
          ${c.options.map(o => {
            const val = typeof o === "string" ? o : o.value;
            const lab = typeof o === "string" ? o : o.label;
            return `<option value="${esc(val)}" ${val === c.value ? "selected" : ""}>${esc(lab)}</option>`;
          }).join("")}
        </select>`;
      } else if (c.type === "textarea") {
        control = `<textarea id="${id}" name="${c.name}" placeholder="${esc(c.placeholder || "")}">${esc(c.value || "")}</textarea>`;
      } else {
        control = `<input id="${id}" name="${c.name}" type="${c.type || "text"}"
          ${c.step ? `step="${c.step}"` : ""} ${c.required ? "required" : ""}
          placeholder="${esc(c.placeholder || "")}" value="${esc(c.value ?? "")}" />`;
      }
      return `<div class="field ${c.full ? "" : ""}"><label for="${id}">${esc(c.label)}</label>${control}</div>`;
    };

    // Agrupa campos marcados con row en pares.
    const fieldsHTML = campos.map(campoHTML).join("");

    root.innerHTML = `
      <div class="modal" id="m-overlay">
        <div class="modal__sheet" role="dialog" aria-modal="true">
          <div class="modal__head">
            <h2>${esc(titulo)}</h2>
            <button class="modal__close" id="m-close" aria-label="Cerrar">×</button>
          </div>
          <form class="form" id="m-form">
            ${fieldsHTML}
            <div class="form__actions">
              ${onDelete ? `<button type="button" class="btn btn--danger" id="m-delete">Eliminar</button>` : ""}
              <button type="submit" class="btn btn--primary">${esc(submitLabel)}</button>
            </div>
          </form>
        </div>
      </div>`;

    const close = (val) => { root.innerHTML = ""; resolve(val); };

    $("#m-close").onclick = () => close(null);
    $("#m-overlay").onclick = (e) => { if (e.target.id === "m-overlay") close(null); };
    $("#m-form").onsubmit = (e) => {
      e.preventDefault();
      const data = {};
      campos.forEach(c => {
        const el = $(`#f-${c.name}`);
        let v = el.value;
        if (c.type === "number") v = v === "" ? null : Number(v);
        data[c.name] = v;
      });
      close(data);
    };
    if (onDelete) {
      $("#m-delete").onclick = async () => {
        if (confirm("¿Eliminar este registro? No se puede deshacer.")) {
          await onDelete();
          close(null);
        }
      };
    }
  });
}

// ---------- Toast ----------
let toastTimer;
export function toast(msg) {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.style.cssText = `position:fixed;left:50%;bottom:calc(var(--tabbar-h) + 24px);
      transform:translateX(-50%);background:var(--card-2);color:var(--text);
      padding:10px 18px;border-radius:999px;border:1px solid var(--border);
      box-shadow:var(--shadow);z-index:80;font-size:14px;font-weight:600;
      opacity:0;transition:opacity .2s;`;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.opacity = "1"; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = "0"; }, 2200);
}

// ---------- Estado vacío ----------
export function vacio(icono, titulo, sub = "") {
  return `<div class="empty">
    <div class="empty__icon">${icono}</div>
    <div><strong>${esc(titulo)}</strong></div>
    ${sub ? `<div class="muted">${esc(sub)}</div>` : ""}
  </div>`;
}
