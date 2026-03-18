import React from 'react';
import { fmt, calcPago, DIAS_KEYS } from '../utils/week';

export default function SummaryCards({ trabajadores, registros, ramas = [] }) {
  const trabajadoresMap = Object.fromEntries(trabajadores.map((t) => [t.id, t]));

  let totalNomina = 0;
  let totalDias = 0;
  let totalAnticipos = 0;
  let totalPagado = 0;
  const trabajadoresConRegistro = new Set();

  for (const r of registros) {
    const t = trabajadoresMap[r.trabajador_id];
    if (!t) continue;
    const dias = DIAS_KEYS.reduce((s, d) => s + (r.dias?.[d] || 0), 0);
    const pago = calcPago(t, r);
    totalDias += dias;
    totalAnticipos += r.anticipo || 0;
    totalNomina += pago;
    if (r.pagado) totalPagado += pago;
    if (dias > 0) trabajadoresConRegistro.add(r.trabajador_id);
  }

  const balanceRestante = totalNomina - totalPagado;

  // Proyección: si todos trabajaran semana completa (6 días = sueldo completo)
  const totalProyectado = trabajadores.reduce((s, t) => s + (t.sueldo || 0), 0);

  // Desglose por rama
  const ramasMap = Object.fromEntries(ramas.map((r) => [r.id, r]));
  const byRama = {};
  for (const t of trabajadores) {
    if (!byRama[t.rama]) byRama[t.rama] = { proyectado: 0, real: 0 };
    byRama[t.rama].proyectado += t.sueldo || 0;
  }
  for (const r of registros) {
    const t = trabajadoresMap[r.trabajador_id];
    if (!t) continue;
    if (!byRama[t.rama]) byRama[t.rama] = { proyectado: 0, real: 0 };
    byRama[t.rama].real += calcPago(t, r);
  }

  const porcentajeAvance = totalProyectado > 0 ? Math.min((totalNomina / totalProyectado) * 100, 100) : 0;

  return (
    <>
      <div className="summary-grid">
        <div className="summary-card gold">
          <div className="summary-label">Nomina Total</div>
          <div className="summary-value gold">${fmt(totalNomina)}</div>
        </div>
        <div className="summary-card green">
          <div className="summary-label">Monto Pagado</div>
          <div className="summary-value green">${fmt(totalPagado)}</div>
        </div>
        <div className="summary-card red">
          <div className="summary-label">Balance Restante</div>
          <div className="summary-value red">${fmt(balanceRestante)}</div>
        </div>
        <div className="summary-card blue">
          <div className="summary-label">Trabajadores</div>
          <div className="summary-value blue">{trabajadoresConRegistro.size}</div>
        </div>
        <div className="summary-card green">
          <div className="summary-label">Dias Trabajados</div>
          <div className="summary-value green">{totalDias}</div>
        </div>
        <div className="summary-card red">
          <div className="summary-label">Anticipos</div>
          <div className="summary-value red">${fmt(totalAnticipos)}</div>
        </div>
      </div>

      {/* Proyección semanal */}
      <div className="proyeccion-card">
        <div className="proyeccion-header">
          <div>
            <div className="proyeccion-label">Proyección semana completa</div>
            <div className="proyeccion-subtitle">{trabajadores.length} empleados · semana de 6 días</div>
          </div>
          <div className="proyeccion-total">${fmt(totalProyectado)}</div>
        </div>

        {/* Barra de progreso general */}
        <div className="progress-track">
          <div className="progress-bar gold" style={{ width: `${porcentajeAvance}%` }} />
        </div>
        <div className="proyeccion-meta">
          <span>Registrado: ${fmt(totalNomina)}</span>
          <span>{porcentajeAvance.toFixed(0)}% de la semana</span>
        </div>

        {/* Desglose por rama */}
        {ramas.length > 0 && (
          <div className="rama-breakdown">
            {ramas.map((rama) => {
              const data = byRama[rama.id];
              if (!data || data.proyectado === 0) return null;
              const pct = Math.min((data.real / data.proyectado) * 100, 100);
              return (
                <div key={rama.id} className="rama-row">
                  <div className="rama-info">
                    <span className="dot" style={{ background: rama.color }} />
                    <span className="rama-nombre">{rama.emoji} {rama.label}</span>
                    <span className="rama-real">${fmt(data.real)}</span>
                    <span className="rama-slash">/</span>
                    <span className="rama-proyectado">${fmt(data.proyectado)}</span>
                  </div>
                  <div className="progress-track thin">
                    <div className="progress-bar" style={{ width: `${pct}%`, background: rama.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
