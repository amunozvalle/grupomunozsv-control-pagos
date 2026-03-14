import React from 'react';
import { fmt, calcPago, DIAS_KEYS } from '../utils/week';

export default function SummaryCards({ trabajadores, registros }) {
  const trabajadoresMap = Object.fromEntries(trabajadores.map(t => [t.id, t]));

  let totalNomina = 0, totalDias = 0, totalAnticipos = 0;
  const trabajadoresConRegistro = new Set();

  for (const r of registros) {
    const t = trabajadoresMap[r.trabajador_id];
    if (!t) continue;
    const dias = DIAS_KEYS.reduce((s, d) => s + (r.dias?.[d] || 0), 0);
    totalDias += dias;
    totalAnticipos += r.anticipo || 0;
    totalNomina += calcPago(t, r);
    if (dias > 0) trabajadoresConRegistro.add(r.trabajador_id);
  }

  return (
    <div className="summary-grid">
      <div className="summary-card gold">
        <div className="summary-label">Nómina Total</div>
        <div className="summary-value gold">${fmt(totalNomina)}</div>
      </div>
      <div className="summary-card green">
        <div className="summary-label">Días Trabajados</div>
        <div className="summary-value green">{totalDias}</div>
      </div>
      <div className="summary-card blue">
        <div className="summary-label">Trabajadores</div>
        <div className="summary-value blue">{trabajadoresConRegistro.size}</div>
      </div>
      <div className="summary-card red">
        <div className="summary-label">Anticipos</div>
        <div className="summary-value red">${fmt(totalAnticipos)}</div>
      </div>
    </div>
  );
}
