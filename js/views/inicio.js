// ===========================================================
//  Vista Inicio — resumen del estado de salud
// ===========================================================
import { watch } from "../db.js";
import { esc, vacio, hoyISO, fmtFecha, diasHasta } from "../ui.js";

export default function render(app) {
  const estado = { medicamentos: [], citas: [], examenes: [], diario: [] };

  app.innerHTML = `<div id="dash"><div class="spinner"></div></div>`;
  const dash = app.querySelector("#dash");

  function pinta() {
    const meds   = estado.medicamentos.filter(m => (m.estado || "Activo") === "Activo");
    const hoy    = hoyISO();
    const prox   = estado.citas.filter(c => c.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
    const ultExa = estado.examenes.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))[0];
    const ultDia = estado.diario.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))[0];

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
  }

  const subs = [
    watch("medicamentos", "estado", items => { estado.medicamentos = items; pinta(); }),
    watch("citas",        "fecha",  items => { estado.citas = items; pinta(); }),
    watch("examenes",     "fecha",  items => { estado.examenes = items; pinta(); }),
    watch("diario",       "fecha",  items => { estado.diario = items; pinta(); }),
  ];

  return () => subs.forEach(u => { try { u(); } catch {} });
}
