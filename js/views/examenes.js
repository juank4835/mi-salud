// ===========================================================
//  Vista Exámenes — archivo de documentos + análisis de Claude
//  Cada examen es un archivo (PDF/foto) en Storage. Cuando Claude
//  lo revisa, escribe de vuelta: resumen, comparación y `valores`
//  (que alimentan las gráficas de evolución).
// ===========================================================
import { watch, crear, actualizar, borrar } from "../db.js";
import { subirExamen, borrarArchivo } from "../storage.js";
import { esc, toast, vacio, hoyISO, fmtFecha, $ } from "../ui.js";

const COL = "examenes";
const TIPOS = ["Laboratorio", "Imagen diagnóstica", "Otro"];

let chart = null;

/* -------------------- Subir examen -------------------- */
function modalSubir() {
  return new Promise((resolve) => {
    const root = $("#modal-root");
    root.innerHTML = `
      <div class="modal" id="m-overlay">
        <div class="modal__sheet" role="dialog" aria-modal="true">
          <div class="modal__head"><h2>Subir examen</h2>
            <button class="modal__close" id="m-close" aria-label="Cerrar">×</button></div>
          <form class="form" id="m-form">
            <div class="field">
              <label for="f-file">Archivo (PDF o foto)</label>
              <input id="f-file" type="file" accept="application/pdf,image/*" required />
            </div>
            <div class="field"><label for="f-titulo">Título</label>
              <input id="f-titulo" placeholder="Ej: Perfil lipídico" required /></div>
            <div class="field--row">
              <div class="field"><label for="f-fecha">Fecha</label>
                <input id="f-fecha" type="date" value="${hoyISO()}" required /></div>
              <div class="field"><label for="f-tipo">Tipo</label>
                <select id="f-tipo">${TIPOS.map(t => `<option>${t}</option>`).join("")}</select></div>
            </div>
            <div id="m-prog" class="muted" style="display:none">Subiendo… <span id="m-pct">0</span>%</div>
            <div class="form__actions">
              <button type="submit" class="btn btn--primary btn--block" id="m-go">Subir</button>
            </div>
          </form>
        </div>
      </div>`;

    const close = (v) => { root.innerHTML = ""; resolve(v); };
    $("#m-close").onclick = () => close(null);
    $("#m-overlay").onclick = (e) => { if (e.target.id === "m-overlay") close(null); };

    // autocompletar título con el nombre del archivo
    $("#f-file").onchange = (e) => {
      const f = e.target.files[0];
      if (f && !$("#f-titulo").value) $("#f-titulo").value = f.name.replace(/\.[^.]+$/, "");
    };

    $("#m-form").onsubmit = async (e) => {
      e.preventDefault();
      const file = $("#f-file").files[0];
      if (!file) return;
      $("#m-go").disabled = true; $("#m-go").textContent = "Subiendo…";
      $("#m-prog").style.display = "";
      try {
        const meta = await subirExamen(file, (p) => { $("#m-pct").textContent = p; });
        await crear(COL, {
          titulo: $("#f-titulo").value.trim() || file.name,
          fecha: $("#f-fecha").value,
          tipo: $("#f-tipo").value,
          estado: "pendiente",
          ...meta,
        });
        toast("Examen subido");
        close(true);
      } catch (err) {
        console.error(err);
        $("#m-prog").innerHTML = `<span style="color:var(--danger)">Error al subir. Revisa tu conexión y Storage.</span>`;
        $("#m-go").disabled = false; $("#m-go").textContent = "Reintentar";
      }
    };
  });
}

/* -------------------- Detalle / análisis -------------------- */
function valorRow(v) {
  const fuera = v.fuera === "alto" || v.fuera === "bajo";
  const pill = fuera
    ? `<span class="pill pill--danger">${v.fuera === "alto" ? "Alto" : "Bajo"}</span>`
    : `<span class="pill pill--ok">Normal</span>`;
  return `<div class="row" style="padding:10px 12px">
    <div class="row__accent ${fuera ? "accent--danger" : "accent--ok"}"></div>
    <div class="row__main">
      <div class="row__title">${esc(v.nombre)} <span class="muted">· ${esc(String(v.valor))} ${esc(v.unidad || "")}</span></div>
      ${v.ref ? `<div class="row__sub">Rango normal: ${esc(v.ref)}</div>` : ""}
    </div>
    <div class="row__meta">${pill}</div>
  </div>`;
}

function modalDetalle(x) {
  return new Promise((resolve) => {
    const root = $("#modal-root");
    const revisado = x.estado === "revisado";
    const valores = Array.isArray(x.valores) ? x.valores : [];

    const analisis = revisado ? `
      ${x.resumen ? `<div class="card mt"><strong>Resumen</strong><p class="mt" style="margin:6px 0 0">${esc(x.resumen)}</p></div>` : ""}
      ${x.comparacion ? `<div class="card mt"><strong>Comparación con el anterior</strong><p class="mt" style="margin:6px 0 0">${esc(x.comparacion)}</p></div>` : ""}
      ${valores.length ? `<div class="section mt"><div class="section__head"><h2>Valores</h2></div>
        <div class="list">${valores.map(valorRow).join("")}</div></div>` : ""}
      <p class="muted center" style="font-size:12px;margin-top:8px">Resumen informativo. No reemplaza la valoración de tu médico.</p>
    ` : `
      <div class="card mt center muted">
        <div class="empty__icon">◔</div>
        <p>Por revisar. Dile a Claude: <em>"revisa mi examen de ${esc(x.titulo)}"</em> y aquí aparecerá el análisis.</p>
      </div>`;

    root.innerHTML = `
      <div class="modal" id="m-overlay">
        <div class="modal__sheet" role="dialog" aria-modal="true">
          <div class="modal__head"><h2>${esc(x.titulo)}</h2>
            <button class="modal__close" id="m-close" aria-label="Cerrar">×</button></div>
          <div class="muted" style="margin-bottom:10px">${fmtFecha(x.fecha)} · ${esc(x.tipo || "")}
            ${revisado ? `· <span class="pill pill--ok">Revisado</span>` : `· <span class="pill pill--warn">Por revisar</span>`}</div>
          <a class="btn btn--block" id="m-open" href="${esc(x.downloadURL || "#")}" target="_blank" rel="noopener">Abrir archivo</a>
          ${analisis}
          <div class="form__actions" style="margin-top:16px">
            <button type="button" class="btn btn--danger" id="m-del">Eliminar</button>
          </div>
        </div>
      </div>`;

    const close = (v) => { root.innerHTML = ""; resolve(v); };
    $("#m-close").onclick = () => close(null);
    $("#m-overlay").onclick = (e) => { if (e.target.id === "m-overlay") close(null); };
    $("#m-del").onclick = async () => {
      if (!confirm("¿Eliminar este examen y su archivo? No se puede deshacer.")) return;
      await borrarArchivo(x.storagePath);
      await borrar(COL, x.id);
      toast("Eliminado");
      close(true);
    };
  });
}

/* -------------------- Gráficas -------------------- */
function seriesDesde(docs) {
  // Aplana los `valores` de todos los exámenes revisados, por nombre.
  const por = {};
  docs.forEach(d => {
    (d.valores || []).forEach(v => {
      const n = Number(v.valor);
      if (!v.nombre || Number.isNaN(n)) return;
      (por[v.nombre] = por[v.nombre] || []).push({ fecha: d.fecha, valor: n, unidad: v.unidad });
    });
  });
  Object.values(por).forEach(arr => arr.sort((a, b) => a.fecha.localeCompare(b.fecha)));
  return por;
}

async function dibujar(canvas, serie) {
  const { Chart, registerables } = await import("https://cdn.jsdelivr.net/npm/chart.js@4.4.3/+esm");
  Chart.register(...registerables);
  if (chart) { chart.destroy(); chart = null; }
  const css = getComputedStyle(document.documentElement);
  const primary = (css.getPropertyValue("--primary") || "#38bdf8").trim();
  const dim = (css.getPropertyValue("--text-dim") || "#94a3b8").trim();
  chart = new Chart(canvas, {
    type: "line",
    data: { labels: serie.map(p => fmtFecha(p.fecha)),
      datasets: [{ data: serie.map(p => p.valor), borderColor: primary,
        backgroundColor: primary + "33", tension: .3, fill: true, pointRadius: 4, borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: dim }, grid: { display: false } },
                y: { ticks: { color: dim }, grid: { color: dim + "22" } } } },
  });
}

/* -------------------- Render -------------------- */
function fila(x) {
  const revisado = x.estado === "revisado";
  const nFuera = (x.valores || []).filter(v => v.fuera === "alto" || v.fuera === "bajo").length;
  let pill;
  if (!revisado) pill = `<span class="pill pill--warn">Por revisar</span>`;
  else if (nFuera) pill = `<span class="pill pill--danger">${nFuera} fuera de rango</span>`;
  else pill = `<span class="pill pill--ok">Revisado</span>`;
  return `<div class="row" data-id="${x.id}" style="cursor:pointer">
    <div class="row__accent ${revisado ? (nFuera ? "accent--danger" : "accent--ok") : "accent--warn"}"></div>
    <div class="row__main">
      <div class="row__title">${esc(x.titulo)}</div>
      <div class="row__sub">${fmtFecha(x.fecha)} · ${esc(x.tipo || "")}</div>
    </div>
    <div class="row__meta">${pill}</div>
  </div>`;
}

export default function render(app) {
  app.innerHTML = `
    <div class="section" id="grafica-sec" style="display:none">
      <div class="card">
        <div class="section__head" style="margin-bottom:10px"><h2>Evolución</h2>
          <select id="sel" style="font:inherit;background:var(--card-2);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:6px 10px"></select>
        </div>
        <div class="chart-wrap"><canvas id="chart"></canvas></div>
      </div>
    </div>
    <div class="section"><div class="list" id="lista"><div class="spinner"></div></div></div>
    <button class="fab" id="fab" aria-label="Subir examen">+</button>`;

  app.querySelector("#fab").onclick = () => modalSubir();

  let docs = [];
  const lista = app.querySelector("#lista");
  const sec = app.querySelector("#grafica-sec");
  const sel = app.querySelector("#sel");
  const canvas = app.querySelector("#chart");

  function pintarGrafica() {
    const por = seriesDesde(docs);
    const graficables = Object.keys(por).filter(n => por[n].length >= 2);
    if (!graficables.length) { sec.style.display = "none"; return; }
    sec.style.display = "";
    const prev = sel.value;
    sel.innerHTML = graficables.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
    if (graficables.includes(prev)) sel.value = prev;
    sel.onchange = () => dibujar(canvas, por[sel.value]);
    dibujar(canvas, por[sel.value]);
  }

  const unsub = watch(COL, "fecha", (items) => {
    docs = items;
    if (!items.length) {
      sec.style.display = "none";
      lista.innerHTML = vacio("∿", "Sin exámenes", "Toca + para subir tu primer examen (PDF o foto).");
      return;
    }
    pintarGrafica();
    lista.innerHTML = items.map(fila).join("");
    lista.querySelectorAll(".row").forEach(r =>
      r.onclick = () => modalDetalle(docs.find(x => x.id === r.dataset.id)));
  });

  return () => { unsub(); if (chart) { chart.destroy(); chart = null; } };
}
