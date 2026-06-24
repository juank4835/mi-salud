// ===========================================================
//  Vista Inicio — resumen del estado de salud
// ===========================================================
import { watch } from "../db.js";
import { esc, vacio, hoyISO, fmtFecha, diasHasta, toast } from "../ui.js";

// Nivel de un indicador (igual que en examenes.js): normal / leve / marcado.
function nivelInd(u) {
  if (!(u.fuera === "alto" || u.fuera === "bajo")) return "normal";
  if (u.severidad === "leve") return "leve";
  if (u.severidad) return "marcado";
  const v = Number(u.valor);
  const lo = (u.refMin === 0 || u.refMin) ? Number(u.refMin) : null;
  const hi = (u.refMax === 0 || u.refMax) ? Number(u.refMax) : null;
  let ex = 0, dn = 1;
  if (u.fuera === "alto" && hi != null) { ex = v - hi; dn = (lo != null ? hi - lo : Math.abs(hi)) || 1; }
  else if (u.fuera === "bajo" && lo != null) { ex = lo - v; dn = (hi != null ? hi - lo : Math.abs(lo)) || 1; }
  return (ex / dn) <= 0.2 ? "leve" : "marcado";
}

// Arma el resumen completo (texto) a partir de los datos en vivo.
// Siempre actualizado: se genera en el momento de tocar el botón.
function generarResumen(estado) {
  const L = [];
  L.push(`RESUMEN DE SALUD — generado el ${fmtFecha(hoyISO())} por mi app personal "Mi Salud".`);
  L.push(`Es un resumen informativo de mi historia clínica organizada a partir de mis exámenes. No es diagnóstico; lo interpreta mi médico. Por favor ayúdame a entenderlo y conversar sobre mi estado de salud.`);
  L.push("");

  // Indicadores por área (con evolución y análisis).
  const hist = {};
  estado.metricas.forEach(m => { (hist[m.nombre] = hist[m.nombre] || []).push(m); });
  const porCat = {};
  Object.keys(hist).forEach(nombre => {
    const arr = hist[nombre].slice().sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
    const u = arr[arr.length - 1];
    (porCat[u.categoria || "Otros"] = porCat[u.categoria || "Otros"] || []).push({ u, arr });
  });
  if (Object.keys(porCat).length) {
    L.push("=== INDICADORES POR ÁREA ===");
    Object.keys(porCat).sort().forEach(cat => {
      L.push("");
      L.push(`[${cat}]`);
      porCat[cat].forEach(({ u, arr }) => {
        const nv = nivelInd(u);
        const dir = u.fuera === "alto" ? "alto" : "bajo";
        const est = nv === "normal" ? "normal" : nv === "leve" ? `${dir} leve` : `${dir.toUpperCase()} (marcado)`;
        let l = `- ${u.nombre}: ${u.valor} ${u.unidad || ""} (rango ${u.ref || "—"}) → ${est}`;
        if (arr.length > 1) l += ` | evolución: ${arr.map(x => `${x.valor} (${fmtFecha(x.fecha)})`).join(" → ")}`;
        L.push(l);
        if (u.analisis) L.push(`    · ${u.analisis}`);
      });
    });
    L.push("");
  }

  // Exámenes en el archivo (con su resumen).
  if (estado.examenes.length) {
    L.push("=== EXÁMENES EN EL ARCHIVO ===");
    estado.examenes.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).forEach(e => {
      L.push("");
      L.push(`• ${e.titulo} — ${fmtFecha(e.fecha)}${e.fuente ? ` · ${e.fuente}` : ""} (${e.tipo || ""})`);
      if (e.resumen) L.push(`  ${e.resumen}`);
    });
    L.push("");
  }

  // Medicamentos activos.
  const meds = estado.medicamentos.filter(m => (m.estado || "Activo") === "Activo");
  if (meds.length) {
    L.push("=== MEDICAMENTOS ACTIVOS ===");
    meds.forEach(m => L.push(`- ${m.nombre}${m.dosis ? ` ${m.dosis}` : ""}${m.frecuencia ? ` · ${m.frecuencia}` : ""}`));
    L.push("");
  }

  L.push("=== NOTA ===");
  L.push("Resumen informativo generado por mi app a partir de mis exámenes. No reemplaza la valoración de un profesional de salud.");
  return L.join("\n");
}

async function copiarResumen(estado) {
  const texto = generarResumen(estado);
  try {
    await navigator.clipboard.writeText(texto);
    toast("Resumen copiado — pégalo en tu chat de IA");
  } catch {
    // Fallback: mostrar el texto para copiar a mano.
    const root = document.querySelector("#modal-root");
    root.innerHTML = `<div class="modal" id="m-ov"><div class="modal__sheet">
      <div class="modal__head"><h2>Resumen para IA</h2><button class="modal__close" id="m-cl">×</button></div>
      <p class="muted" style="margin:0 0 10px">Mantén pulsado para seleccionar y copiar:</p>
      <textarea readonly style="width:100%;height:50dvh;font-size:13px">${esc(texto)}</textarea></div></div>`;
    root.querySelector("#m-cl").onclick = () => root.innerHTML = "";
    root.querySelector("#m-ov").onclick = (e) => { if (e.target.id === "m-ov") root.innerHTML = ""; };
  }
}

export default function render(app) {
  const estado = { medicamentos: [], citas: [], examenes: [], diario: [], metricas: [] };

  app.innerHTML = `<div id="dash"><div class="spinner"></div></div>`;
  const dash = app.querySelector("#dash");

  function pinta() {
    const meds   = estado.medicamentos.filter(m => (m.estado || "Activo") === "Activo");
    const hoy    = hoyISO();
    const prox   = estado.citas.filter(c => c.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    const ultExa = estado.examenes.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))[0];
    const ultDia = estado.diario.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))[0];

    // Indicadores fuera de rango (lectura más reciente de cada métrica).
    const ultimaPorNombre = {};
    estado.metricas.forEach(m => {
      const cur = ultimaPorNombre[m.nombre];
      if (!cur || (m.fecha || "") > (cur.fecha || "")) ultimaPorNombre[m.nombre] = m;
    });
    const nivel = (u) => {
      if (!(u.fuera === "alto" || u.fuera === "bajo")) return "normal";
      if (u.severidad === "leve") return "leve";
      if (u.severidad) return "marcado";
      const v = Number(u.valor);
      const lo = (u.refMin === 0 || u.refMin) ? Number(u.refMin) : null;
      const hi = (u.refMax === 0 || u.refMax) ? Number(u.refMax) : null;
      let ex = 0, dn = 1;
      if (u.fuera === "alto" && hi != null) { ex = v - hi; dn = (lo != null ? hi - lo : Math.abs(hi)) || 1; }
      else if (u.fuera === "bajo" && lo != null) { ex = lo - v; dn = (hi != null ? hi - lo : Math.abs(lo)) || 1; }
      return (ex / dn) <= 0.2 ? "leve" : "marcado";
    };
    const fuera = Object.values(ultimaPorNombre).filter(m => m.fuera === "alto" || m.fuera === "bajo")
      .sort((a, b) => (nivel(b) === "marcado") - (nivel(a) === "marcado"));
    const fueraHTML = fuera.length ? `<div class="section">
      <div class="section__head"><h2>Indicadores a revisar</h2><a class="section__count" href="#/examenes">Ver todos</a></div>
      <div class="list">${fuera.map(m => {
        const nv = nivel(m);
        const acc = nv === "marcado" ? "accent--danger" : "accent--warn";
        const pill = nv === "marcado" ? `<span class="pill pill--danger">${m.fuera === "alto" ? "Alto" : "Bajo"}</span>`
          : `<span class="pill pill--warn">${m.fuera === "alto" ? "Alto" : "Bajo"} leve</span>`;
        return `<div class="row">
        <div class="row__accent ${acc}"></div>
        <div class="row__main"><div class="row__title">${esc(m.nombre)} <span class="muted">· ${esc(String(m.valor))} ${esc(m.unidad || "")}</span></div>
          <div class="row__sub">${fmtFecha(m.fecha)}${m.ref ? ` · normal: ${esc(m.ref)}` : ""}</div></div>
        <div class="row__meta">${pill}</div>
      </div>`; }).join("")}</div></div>` : "";

    let proxHTML;
    if (prox) {
      const d = diasHasta(prox.fecha);
      const cuando = d === 0 ? "Hoy" : d === 1 ? "Mañana" : `En ${d} días`;
      proxHTML = `<div class="row">
        <div class="row__accent ${d <= 7 ? "accent--warn" : "accent--info"}"></div>
        <div class="row__main">
          <div class="row__title">${esc(prox.especialidad)}</div>
          <div class="row__sub">${fmtFecha(prox.fecha)}${prox.hora ? ` · ${esc(prox.hora)}` : ""}</div>
        </div>
        <div class="row__meta"><span class="pill ${d <= 7 ? "pill--warn" : ""}">${cuando}</span></div>
      </div>`;
    } else {
      proxHTML = `<div class="row"><div class="row__main muted">No tienes citas próximas.</div></div>`;
    }

    const medsHTML = meds.length
      ? meds.slice(0, 5).map(m => `<div class="row">
          <div class="row__accent accent--ok"></div>
          <div class="row__main">
            <div class="row__title">${esc(m.nombre)} ${m.dosis ? `<span class="muted">· ${esc(m.dosis)}</span>` : ""}</div>
            <div class="row__sub">${esc(m.frecuencia || "")}${m.horarios ? ` · ${esc(m.horarios)}` : ""}</div>
          </div></div>`).join("")
      : `<div class="row"><div class="row__main muted">Sin medicamentos activos.</div></div>`;

    dash.innerHTML = `
      <div class="section">
        <div class="stat-grid">
          <a class="stat" href="#/medicamentos" style="text-decoration:none;color:inherit">
            <div class="stat__num">${meds.length}</div><div class="stat__label">Medicamentos activos</div></a>
          <a class="stat" href="#/citas" style="text-decoration:none;color:inherit">
            <div class="stat__num">${estado.citas.filter(c => c.fecha >= hoy).length}</div><div class="stat__label">Citas próximas</div></a>
          <a class="stat" href="#/examenes" style="text-decoration:none;color:inherit">
            <div class="stat__num">${estado.examenes.length}</div><div class="stat__label">Exámenes${estado.examenes.filter(e => e.estado === "pendiente").length ? ` · ${estado.examenes.filter(e => e.estado === "pendiente").length} por revisar` : ""}</div></a>
          <a class="stat" href="#/diario" style="text-decoration:none;color:inherit">
            <div class="stat__num">${estado.diario.length}</div><div class="stat__label">Registros del diario</div></a>
        </div>
      </div>

      <div class="section">
        <button class="btn btn--primary btn--block" id="btn-resumen">Copiar resumen para IA</button>
        <div class="muted center" style="font-size:12px;margin-top:7px">Genera tu historia al día para pegarla en cualquier chat de IA</div>
      </div>

      ${fueraHTML}

      <div class="section">
        <div class="section__head"><h2>Próxima cita</h2><a class="section__count" href="#/citas">Ver todas</a></div>
        <div class="list">${proxHTML}</div>
      </div>

      <div class="section">
        <div class="section__head"><h2>Medicamentos de hoy</h2><a class="section__count" href="#/medicamentos">Ver todos</a></div>
        <div class="list">${medsHTML}</div>
      </div>

      ${ultExa ? (() => {
        const rev = ultExa.estado === "revisado";
        const nFuera = (ultExa.valores || []).filter(v => v.fuera === "alto" || v.fuera === "bajo").length;
        const pill = !rev ? `<span class="pill pill--warn">Por revisar</span>`
          : nFuera ? `<span class="pill pill--danger">${nFuera} fuera de rango</span>`
          : `<span class="pill pill--ok">Revisado</span>`;
        return `<div class="section">
        <div class="section__head"><h2>Último examen</h2><a class="section__count" href="#/examenes">Ver todos</a></div>
        <div class="list"><div class="row">
          <div class="row__accent ${rev ? (nFuera ? "accent--danger" : "accent--ok") : "accent--warn"}"></div>
          <div class="row__main">
            <div class="row__title">${esc(ultExa.titulo || "Examen")}</div>
            <div class="row__sub">${fmtFecha(ultExa.fecha)} · ${esc(ultExa.tipo || "")}</div>
          </div>
          <div class="row__meta">${pill}</div>
        </div></div></div>`;
      })() : ""}

      ${ultDia ? `<div class="section">
        <div class="section__head"><h2>Último registro</h2><a class="section__count" href="#/diario">Ver diario</a></div>
        <div class="list"><div class="row">
          <div class="row__main">
            <div class="row__title">${fmtFecha(ultDia.fecha)} <span class="muted">· ${esc(ultDia.animo || "")}</span></div>
            <div class="row__sub">${ultDia.sintomas ? esc(ultDia.sintomas) : "<span class='muted'>sin síntomas</span>"}</div>
          </div></div></div>
      </div>` : ""}
    `;
    const bR = dash.querySelector("#btn-resumen");
    if (bR) bR.onclick = () => copiarResumen(estado);
  }

  const subs = [
    watch("medicamentos", "estado", items => { estado.medicamentos = items; pinta(); }),
    watch("citas",        "fecha",  items => { estado.citas = items; pinta(); }),
    watch("examenes",     "fecha",  items => { estado.examenes = items; pinta(); }),
    watch("diario",       "fecha",  items => { estado.diario = items; pinta(); }),
    watch("metricas",     "fecha",  items => { estado.metricas = items; pinta(); }),
  ];

  return () => subs.forEach(u => { try { u(); } catch {} });
}
