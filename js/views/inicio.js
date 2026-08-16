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

// --- Utilidades para correlacionar en vivo ---
// Última lectura de cada indicador (por nombre).
function ultimasPorNombre(estado) {
  const m = {};
  estado.metricas.forEach(x => { const c = m[x.nombre]; if (!c || (x.fecha || "") > (c.fecha || "")) m[x.nombre] = x; });
  return m;
}
// Busca el primer indicador cuyo nombre contenga alguno de los textos dados.
function buscarInd(U, ...subs) {
  const k = Object.keys(U).find(n => subs.some(s => n.toLowerCase().includes(s.toLowerCase())));
  return k ? U[k] : null;
}
// ¿Existe un examen cuyo título contenga alguno de los textos?
function hayExamen(estado, ...subs) {
  return estado.examenes.some(e => subs.some(s => (e.titulo || "").toLowerCase().includes(s.toLowerCase())));
}
const val = (m) => m ? `${m.valor}${m.unidad ? ` ${m.unidad}` : ""}` : "";

// Correlaciones cruzadas: cada línea solo se emite si sus datos están presentes,
// así el resumen refleja siempre el estado actual (no es texto fijo).
function correlaciones(estado) {
  const U = ultimasPorNombre(estado);
  const out = [];
  const a1c   = buscarInd(U, "glicosilada", "hba1c");
  const apnea = hayExamen(estado, "polisomnog", "apnea", "cpap");
  const mapa  = hayExamen(estado, "mapa", "presión arterial", "presion arterial");
  const malb  = buscarInd(U, "microalbumin");
  const vcm   = buscarInd(U, "corpuscular medio", "vcm");
  const rdw   = buscarInd(U, "distribución eritroide", "rdw");
  const ferr  = buscarInd(U, "ferritina");
  const fe    = buscarInd(U, "hierro sérico", "hierro serico");
  const d25   = buscarInd(U, "25-oh", "(25");
  const dact  = buscarInd(U, "activa", "1,25", "1.25");
  const b12   = buscarInd(U, "b12", "cobalamina");
  const fol   = buscarInd(U, "fólico", "folato");
  const homo  = buscarInd(U, "homociste");
  const aTg   = buscarInd(U, "tiroglobulina");
  const aTPO  = buscarInd(U, "tpo");
  const tsh   = buscarInd(U, "tsh", "tiroestimulante");
  const colT  = buscarInd(U, "colesterol total");
  const ldl   = buscarInd(U, "colesterol ldl");
  const nohdl = buscarInd(U, "no-hdl", "no hdl");
  const hdl   = buscarInd(U, "colesterol hdl");
  const tg    = buscarInd(U, "triglic");

  if (apnea || (a1c && nivelInd(a1c) !== "normal")) {
    const partes = [];
    if (apnea) partes.push("apnea del sueño documentada en polisomnograma");
    if (a1c && nivelInd(a1c) !== "normal") partes.push(`HbA1c ${a1c.valor}% (rango prediabético)`);
    out.push(`• Eje sueño–metabolismo–peso: ${partes.join(" + ")}. La apnea no tratada empuja la resistencia a la insulina, la presión y el peso; el peso es la palanca común que conecta apnea, prediabetes, lípidos y presión. Prioridad práctica: adherencia al CPAP y reducción de peso.`);
  }
  if (malb && (malb.fuera === "alto" || malb.fuera === "bajo")) {
    out.push(`• Riñón–presión: microalbuminuria ${val(malb)} (elevada)${mapa ? ", junto con el MAPA de presión de 24h" : ""}. Es un marcador renal y cardiovascular temprano; conviene repetirla (elevada en 2 de 3 muestras en 3–6 meses) para confirmar si es persistente o fue transitoria. Encaja con la prediabetes y la presión.`);
  }
  if (vcm && vcm.fuera === "bajo" && rdw && nivelInd(rdw) === "normal" && (!ferr || !ferr.fuera) && (!fe || !fe.fuera)) {
    out.push(`• Serie roja: VCM bajo (${vcm.valor}) con RDW normal (${rdw.valor}) y hierro/ferritina normales → orienta más a un rasgo talasémico que a falta de hierro. Se confirma con electroforesis de hemoglobina si el médico lo considera.`);
  }
  if (d25 && dact) {
    out.push(`• Vitamina D: reserva 25-OH ${val(d25)} (${d25.fuera ? "insuficiente" : "normal"}) con la forma activa 1,25 ${val(dact)} (normal). Para decidir suplementación se usa la 25-OH, no la activa.`);
  }
  if ((aTg && aTg.fuera) || (aTPO && aTPO.fuera)) {
    const ac = aTg && aTg.fuera ? `anti-tiroglobulina ${aTg.valor}` : `anti-TPO ${aTPO.valor}`;
    out.push(`• Tiroides: anticuerpos antitiroideos elevados (${ac})${tsh && !tsh.fuera ? ` con TSH normal (${tsh.valor})` : ""} → autoinmunidad tiroidea sin disfunción actual; conviene vigilar la TSH en el tiempo.`);
  }
  if (b12 && fol && homo && !b12.fuera && !fol.fuera && !homo.fuera) {
    out.push(`• B12 / folato: B12 ${b12.valor}, folato ${fol.valor} y homocisteína ${homo.valor}, todos normales → este frente está en orden.`);
  }
  if ((colT && colT.fuera === "alto") || (ldl && ldl.fuera === "alto") || (nohdl && nohdl.fuera === "alto")) {
    const altos = [colT && colT.fuera === "alto" && `colesterol total ${colT.valor}`, ldl && ldl.fuera === "alto" && `LDL ${ldl.valor}`, nohdl && nohdl.fuera === "alto" && `No-HDL ${nohdl.valor}`].filter(Boolean);
    let l = `• Lípidos: ${altos.join(", ")} por encima de meta`;
    if (hdl && !hdl.fuera) l += `, con HDL bueno (${hdl.valor})`;
    if (tg && !tg.fuera) l += ` y triglicéridos normales (${tg.valor})`;
    out.push(l + ". El manejo se define por el riesgo cardiovascular global (peso, presión, glucosa), no por un solo número.");
  }
  if (hayExamen(estado, "audiometr") || hayExamen(estado, "maxilofacial", "panorám", "cefalometr")) {
    const hechos = [];
    if (hayExamen(estado, "audiometr")) hechos.push("audiometría");
    if (hayExamen(estado, "senos")) hechos.push("TAC de senos sin causa estructural");
    let l = "• Tinnitus (zumbido de oído): " + (hechos.length ? `${hechos.join(" y ")} ya hechos. ` : "");
    if (hayExamen(estado, "maxilofacial", "panorám", "cefalometr")) {
      l += "Radiografías maxilofaciales (panorámica + perfil) pendientes de que el maxilofacial/otorrino evalúen la ATM y la apófisis estiloides (posible tinnitus somatosensorial). ";
    }
    l += "Pendiente valoración por otorrino, que además cubre el posible componente nasal de la apnea.";
    out.push(l);
  }
  return out;
}

// Arma el resumen completo (texto) a partir de los datos en vivo.
// Siempre actualizado: se genera en el momento de tocar el botón.
function generarResumen(estado) {
  const L = [];
  L.push(`RESUMEN DE SALUD — generado el ${fmtFecha(hoyISO())} por mi app personal "Mi Salud".`);
  L.push(`Es un resumen informativo de mi historia clínica organizada a partir de mis exámenes. No es diagnóstico; lo interpreta mi médico. Por favor ayúdame a entenderlo y a conversar sobre mi estado de salud, correlacionando los distintos exámenes entre sí.`);
  L.push("");

  // Panorama y prioridades (calculados en vivo).
  const U = ultimasPorNombre(estado);
  const arr = Object.values(U);
  const fueras = arr.filter(m => m.fuera === "alto" || m.fuera === "bajo");
  const marc = fueras.filter(m => nivelInd(m) === "marcado");
  const leves = fueras.filter(m => nivelInd(m) === "leve");
  const areas = [...new Set(fueras.map(m => m.categoria || "Otros"))];
  if (arr.length) {
    L.push("=== PANORAMA (al día de hoy) ===");
    L.push(`- Indicadores en seguimiento: ${arr.length} (a partir de ${estado.examenes.length} exámenes).`);
    L.push(`- Fuera de rango: ${fueras.length} (${marc.length} marcados, ${leves.length} leves).`);
    if (areas.length) L.push(`- Áreas con señales: ${areas.join(", ")}.`);
    L.push("");
  }
  if (fueras.length) {
    L.push("=== PRIORIDADES (lo que conviene mirar primero) ===");
    const linea = (m) => {
      const dir = m.fuera === "alto" ? "alto" : "bajo";
      const et = nivelInd(m) === "marcado" ? `${dir.toUpperCase()} (marcado)` : `${dir} leve`;
      return `- ${m.nombre}: ${m.valor} ${m.unidad || ""} (rango ${m.ref || "—"}) → ${et}`;
    };
    marc.forEach(m => L.push(linea(m)));
    leves.forEach(m => L.push(linea(m)));
    L.push("");
  }

  // Correlaciones cruzadas entre exámenes.
  const corr = correlaciones(estado);
  if (corr.length) {
    L.push("=== CORRELACIONES ENTRE EXÁMENES (contexto para conversar, no diagnóstico) ===");
    corr.forEach(c => L.push(c));
    L.push("");
  }

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
    meds.forEach(m => L.push(`- ${m.nombre}${m.dosis ? ` ${m.dosis}` : ""}${m.frecuencia ? ` · ${m.frecuencia}` : ""}${m.inicio ? ` · desde ${fmtFecha(m.inicio)}` : ""}`));
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
