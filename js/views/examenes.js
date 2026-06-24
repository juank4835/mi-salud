// ===========================================================
//  Vista Exámenes
//  Dos caras (control segmentado):
//   · Indicadores → catálogo de métricas (colección `metricas`),
//     agrupadas por categoría, cada una con su evolución fechada.
//   · Documentos  → los archivos (PDF/foto) subidos a Storage.
//  Claude parte cada PDF en sus métricas y las guarda con fecha real.
// ===========================================================
import { watch, crear, borrar } from "../db.js";
import { subirExamen, borrarArchivo } from "../storage.js";
import { esc, toast, vacio, hoyISO, fmtFecha, $ } from "../ui.js";

const COL_DOC = "examenes";
const COL_MET = "metricas";
const TIPOS = ["Laboratorio", "Imagen diagnóstica", "Otro"];
const ORDEN_CAT = ["Función renal", "Metabólico / Glucosa", "Lípidos", "Tiroides",
  "Hematología", "Hígado", "Vitaminas y minerales", "Hormonal", "Otros"];

let chart = null;

/* ==================== Subir documento ==================== */
function modalSubir() {
  return new Promise((resolve) => {
    const root = $("#modal-root");
    root.innerHTML = `
      <div class="modal" id="m-overlay">
        <div class="modal__sheet" role="dialog" aria-modal="true">
          <div class="modal__head"><h2>Subir examen</h2>
            <button class="modal__close" id="m-close" aria-label="Cerrar">×</button></div>
          <form class="form" id="m-form">
            <div class="field"><label for="f-file">Archivo (PDF o foto)</label>
              <input id="f-file" type="file" accept="application/pdf,image/*" required /></div>
            <div class="field"><label for="f-titulo">Título</label>
              <input id="f-titulo" placeholder="Ej: Exámenes de control" required /></div>
            <div class="field--row">
              <div class="field"><label for="f-fecha">Fecha (si la sabes)</label>
                <input id="f-fecha" type="date" value="${hoyISO()}" required /></div>
              <div class="field"><label for="f-tipo">Tipo</label>
                <select id="f-tipo">${TIPOS.map(t => `<option>${t}</option>`).join("")}</select></div>
            </div>
            <p class="muted" style="font-size:13px;margin:0">Sube el PDF tal cual te llegó. Yo lo parto en sus métricas y corrijo la fecha con la del laboratorio.</p>
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
        await crear(COL_DOC, {
          titulo: $("#f-titulo").value.trim() || file.name,
          fecha: $("#f-fecha").value, tipo: $("#f-tipo").value, estado: "pendiente", ...meta,
        });
        toast("Examen subido");
        close(true);
      } catch (err) {
        console.error(err);
        $("#m-prog").innerHTML = `<span style="color:var(--danger)">Error al subir. Revisa conexión y Storage.</span>`;
        $("#m-go").disabled = false; $("#m-go").textContent = "Reintentar";
      }
    };
  });
}

/* ==================== Documentos ==================== */
function filaDoc(x) {
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
      <div class="row__sub">${fmtFecha(x.fecha)} · ${esc(x.tipo || "")}${x.fuente ? ` · ${esc(x.fuente)}` : ""}</div>
    </div>
    <div class="row__meta">${pill}</div>
  </div>`;
}

function valorRow(v) {
  const fuera = v.fuera === "alto" || v.fuera === "bajo";
  const pill = fuera ? `<span class="pill pill--danger">${v.fuera === "alto" ? "Alto" : "Bajo"}</span>`
    : `<span class="pill pill--ok">Normal</span>`;
  return `<div class="row" style="padding:10px 12px">
    <div class="row__accent ${fuera ? "accent--danger" : "accent--ok"}"></div>
    <div class="row__main">
      <div class="row__title">${esc(v.nombre)} <span class="muted">· ${esc(String(v.valor))} ${esc(v.unidad || "")}</span></div>
      ${v.ref ? `<div class="row__sub">Rango: ${esc(v.ref)}</div>` : ""}
    </div>
    <div class="row__meta">${pill}</div>
  </div>`;
}

function modalDoc(x) {
  return new Promise((resolve) => {
    const root = $("#modal-root");
    const revisado = x.estado === "revisado";
    const valores = Array.isArray(x.valores) ? x.valores : [];
    const analisis = revisado ? `
      ${x.resumen ? `<div class="card mt"><strong>Resumen</strong><p class="mt" style="margin:6px 0 0">${esc(x.resumen)}</p></div>` : ""}
      ${x.comparacion ? `<div class="card mt"><strong>Comparación</strong><p class="mt" style="margin:6px 0 0">${esc(x.comparacion)}</p></div>` : ""}
      ${valores.length ? `<div class="section mt"><div class="section__head"><h2>Métricas de este examen</h2></div>
        <div class="list">${valores.map(valorRow).join("")}</div></div>` : ""}
      <p class="muted center" style="font-size:12px;margin-top:8px">Resumen informativo. No reemplaza a tu médico.</p>`
      : `<div class="card mt center muted"><div class="empty__icon">◔</div>
         <p>Por revisar. Dime <em>"revisa mi examen ${esc(x.titulo)}"</em> y lo parto en sus métricas.</p></div>`;
    root.innerHTML = `
      <div class="modal" id="m-overlay"><div class="modal__sheet" role="dialog" aria-modal="true">
        <div class="modal__head"><h2>${esc(x.titulo)}</h2>
          <button class="modal__close" id="m-close" aria-label="Cerrar">×</button></div>
        <div class="muted" style="margin-bottom:10px">${fmtFecha(x.fecha)} · ${esc(x.tipo || "")}
          ${revisado ? `· <span class="pill pill--ok">Revisado</span>` : `· <span class="pill pill--warn">Por revisar</span>`}</div>
        <a class="btn btn--block" href="${esc(x.downloadURL || "#")}" target="_blank" rel="noopener">Abrir archivo original</a>
        ${analisis}
        <div class="form__actions" style="margin-top:16px">
          <button type="button" class="btn btn--danger" id="m-del">Eliminar</button></div>
      </div></div>`;
    const close = (v) => { root.innerHTML = ""; resolve(v); };
    $("#m-close").onclick = () => close(null);
    $("#m-overlay").onclick = (e) => { if (e.target.id === "m-overlay") close(null); };
    $("#m-del").onclick = async () => {
      if (!confirm("¿Eliminar este examen y su archivo? (Sus métricas quedan en el historial.)")) return;
      await borrarArchivo(x.storagePath); await borrar(COL_DOC, x.id);
      toast("Eliminado"); close(true);
    };
  });
}

/* ==================== Indicadores ==================== */
// Agrupa lecturas por nombre; devuelve series ordenadas por fecha.
function agrupar(metricas) {
  const por = {};
  metricas.forEach(m => { (por[m.nombre] = por[m.nombre] || []).push(m); });
  Object.values(por).forEach(arr => arr.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")));
  return por;
}

function modalMetrica(nombre, lecturas) {
  return new Promise((resolve) => {
    const root = $("#modal-root");
    const ult = lecturas[lecturas.length - 1];
    const filas = lecturas.slice().reverse().map(l => {
      const fuera = l.fuera === "alto" || l.fuera === "bajo";
      const tag = fuera ? `<span class="pill pill--danger">${l.fuera === "alto" ? "Alto" : "Bajo"}</span>`
        : `<span class="pill pill--ok">Normal</span>`;
      return `<tr><td>${fmtFecha(l.fecha)}</td>
        <td><span class="metric-val">${esc(String(l.valor))}</span> <span class="muted">${esc(l.unidad || "")}</span></td>
        <td>${tag}</td></tr>`;
    }).join("");
    root.innerHTML = `
      <div class="modal" id="m-overlay"><div class="modal__sheet" role="dialog" aria-modal="true">
        <div class="modal__head"><h2>${esc(nombre)}</h2>
          <button class="modal__close" id="m-close" aria-label="Cerrar">×</button></div>
        <div class="muted" style="margin-bottom:12px">${esc(ult.categoria || "")}${ult.ref ? ` · rango normal: ${esc(ult.ref)}` : ""}</div>
        ${lecturas.length >= 2 ? `<div class="card"><div class="chart-wrap"><canvas id="m-chart"></canvas></div></div>` : ""}
        <table class="readings mt"><tbody>${filas}</tbody></table>
        <p class="muted center" style="font-size:12px;margin-top:12px">Informativo, no diagnóstico.</p>
      </div></div>`;
    const close = () => { if (chart) { chart.destroy(); chart = null; } root.innerHTML = ""; resolve(); };
    $("#m-close").onclick = close;
    $("#m-overlay").onclick = (e) => { if (e.target.id === "m-overlay") close(); };
    if (lecturas.length >= 2) dibujar($("#m-chart"), lecturas);
  });
}

async function dibujar(canvas, lecturas) {
  const { Chart, registerables } = await import("https://cdn.jsdelivr.net/npm/chart.js@4.4.3/+esm");
  Chart.register(...registerables);
  if (chart) { chart.destroy(); chart = null; }
  const css = getComputedStyle(document.documentElement);
  const primary = (css.getPropertyValue("--primary") || "#38bdf8").trim();
  const danger = (css.getPropertyValue("--danger") || "#f87171").trim();
  const dim = (css.getPropertyValue("--text-dim") || "#94a3b8").trim();
  chart = new Chart(canvas, {
    type: "line",
    data: { labels: lecturas.map(l => fmtFecha(l.fecha)),
      datasets: [{
        data: lecturas.map(l => Number(l.valor)),
        borderColor: primary, backgroundColor: primary + "33", tension: .3, fill: true, borderWidth: 2,
        pointRadius: 5, pointBackgroundColor: lecturas.map(l => (l.fuera === "alto" || l.fuera === "bajo") ? danger : primary),
      }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: dim }, grid: { display: false } },
                y: { ticks: { color: dim }, grid: { color: dim + "22" } } } },
  });
}

function filaMetrica(nombre, lecturas) {
  const ult = lecturas[lecturas.length - 1];
  const prev = lecturas.length >= 2 ? lecturas[lecturas.length - 2] : null;
  const fuera = ult.fuera === "alto" || ult.fuera === "bajo";
  let trend = "";
  if (prev != null && prev.valor != null && ult.valor != null) {
    const d = Number(ult.valor) - Number(prev.valor);
    const cls = d > 0 ? "trend--up" : d < 0 ? "trend--down" : "trend--eq";
    const ds = d === 0 ? "igual" : `${d > 0 ? "+" : ""}${Math.round(d * 100) / 100}`;
    trend = `<div class="trend ${cls}">${ds}</div>`;
  }
  const pill = fuera ? `<span class="pill pill--danger">${ult.fuera === "alto" ? "Alto" : "Bajo"}</span>`
    : `<span class="pill pill--ok">Normal</span>`;
  return `<div class="row" data-met="${esc(nombre)}" style="cursor:pointer">
    <div class="row__accent ${fuera ? "accent--danger" : "accent--ok"}"></div>
    <div class="row__main">
      <div class="row__title">${esc(nombre)}</div>
      <div class="row__sub">${fmtFecha(ult.fecha)}${lecturas.length > 1 ? ` · ${lecturas.length} registros` : ""}</div>
    </div>
    <div class="row__meta">
      <div><span class="metric-val">${esc(String(ult.valor))}</span> <span class="muted">${esc(ult.unidad || "")}</span></div>
      ${trend} ${pill}
    </div>
  </div>`;
}

function pintarIndicadores(cont, metricas) {
  if (!metricas.length) {
    cont.innerHTML = vacio("∿", "Aún sin indicadores",
      "Sube un examen en la pestaña Documentos y pídeme que lo revise. Aquí aparecerán tus métricas organizadas.");
    return;
  }
  const fueraTotal = (() => {
    const por = agrupar(metricas); let n = 0;
    Object.values(por).forEach(arr => { const u = arr[arr.length - 1]; if (u.fuera === "alto" || u.fuera === "bajo") n++; });
    return n;
  })();

  // Agrupa por categoría → por nombre.
  const porCat = {};
  metricas.forEach(m => { (porCat[m.categoria || "Otros"] = porCat[m.categoria || "Otros"] || []).push(m); });
  const cats = Object.keys(porCat).sort((a, b) => {
    const ia = ORDEN_CAT.indexOf(a), ib = ORDEN_CAT.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  let html = fueraTotal
    ? `<div class="card" style="border-color:var(--danger);margin-bottom:14px">
         <strong style="color:var(--danger)">${fueraTotal} indicador${fueraTotal > 1 ? "es" : ""} fuera de rango</strong>
         <div class="muted" style="font-size:13px;margin-top:2px">Según la lectura más reciente de cada uno.</div></div>`
    : `<div class="card" style="border-color:var(--ok);margin-bottom:14px">
         <strong style="color:var(--ok)">Todo dentro de rango</strong>
         <div class="muted" style="font-size:13px;margin-top:2px">En la lectura más reciente de cada indicador.</div></div>`;

  cats.forEach(cat => {
    const por = agrupar(porCat[cat]);
    const nombres = Object.keys(por).sort();
    html += `<div class="cat-title">${esc(cat)}</div><div class="list">`;
    html += nombres.map(n => filaMetrica(n, por[n])).join("");
    html += `</div>`;
  });
  cont.innerHTML = html;

  const todas = agrupar(metricas);
  cont.querySelectorAll(".row[data-met]").forEach(r =>
    r.onclick = () => modalMetrica(r.dataset.met, todas[r.dataset.met]));
}

/* ==================== Render ==================== */
export default function render(app) {
  app.innerHTML = `
    <div class="seg" id="seg">
      <button data-tab="indicadores" class="is-active">Indicadores</button>
      <button data-tab="documentos">Documentos</button>
    </div>
    <div id="cont"><div class="spinner"></div></div>
    <button class="fab" id="fab" aria-label="Subir examen">+</button>`;
  app.querySelector("#fab").onclick = () => modalSubir();

  let tab = "indicadores";
  let docs = [], metricas = [];
  const cont = app.querySelector("#cont");

  function pintar() {
    if (tab === "indicadores") pintarIndicadores(cont, metricas);
    else {
      if (!docs.length) { cont.innerHTML = vacio("∿", "Sin documentos", "Toca + para subir tu primer examen (PDF o foto)."); return; }
      cont.innerHTML = `<div class="list">${docs.map(filaDoc).join("")}</div>`;
      cont.querySelectorAll(".row").forEach(r => r.onclick = () => modalDoc(docs.find(d => d.id === r.dataset.id)));
    }
  }

  app.querySelectorAll(".seg button").forEach(b => b.onclick = () => {
    tab = b.dataset.tab;
    app.querySelectorAll(".seg button").forEach(x => x.classList.toggle("is-active", x === b));
    pintar();
  });

  const u1 = watch(COL_DOC, "fecha", (items) => { docs = items; if (tab === "documentos") pintar(); });
  const u2 = watch(COL_MET, "fecha", (items) => { metricas = items; if (tab === "indicadores") pintar(); });

  return () => { u1(); u2(); if (chart) { chart.destroy(); chart = null; } };
}
