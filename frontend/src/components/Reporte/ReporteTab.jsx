import React from 'react';
import { DIAS_KEYS, fmt, calcPago, formatSemana } from '../../utils/week';

export default function ReporteTab({ trabajadores, ramas, registros, semanaKey, semanaOffset, setSemanaOffset }) {
  const recordMap = Object.fromEntries(registros.map((r) => [r.trabajador_id, r]));
  const ramaMap = Object.fromEntries(ramas.map((r) => [r.id, r]));

  const byRama = {};
  for (const t of trabajadores) {
    if (!byRama[t.rama]) byRama[t.rama] = [];
    byRama[t.rama].push(t);
  }

  let grandTotal = 0;

  return (
    <>
      <div className="section-header report-print-header">
        <span className="section-title">Reporte de Nomina</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm no-print" onClick={() => window.print()}>
            Imprimir
          </button>
          <div className="week-nav no-print">
            <button className="btn btn-icon btn-outline" onClick={() => setSemanaOffset((o) => o - 1)}>‹</button>
            <span className="week-label">{formatSemana(semanaKey)}</span>
            <button className="btn btn-icon btn-outline" onClick={() => setSemanaOffset((o) => o + 1)}>›</button>
            {semanaOffset !== 0 && (
              <button className="btn btn-sm btn-outline" onClick={() => setSemanaOffset(0)}>Hoy</button>
            )}
          </div>
        </div>
      </div>

      {registros.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2rem' }}>Reporte</div>
          <p>No hay registros para esta semana.</p>
        </div>
      ) : (
        <div className="report-section">
          {ramas.map((rama) => {
            const trabajadoresRama = (byRama[rama.id] || []).filter((t) => recordMap[t.id]);
            if (trabajadoresRama.length === 0) return null;

            const ramaTotal = trabajadoresRama.reduce((s, t) => s + calcPago(t, recordMap[t.id]), 0);
            grandTotal += ramaTotal;

            const ramaObj = ramaMap[rama.id];

            return (
              <div className="report-card" key={rama.id}>
                <div className="report-card-header">
                  <div className="report-card-title">
                    <span className="badge" style={{
                      background: ramaObj.color + '22',
                      color: ramaObj.color,
                      border: `1px solid ${ramaObj.color}44`,
                    }}>
                      {ramaObj.emoji} {ramaObj.label}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.9rem', color: 'var(--gold)' }}>
                    ${fmt(ramaTotal)}
                  </div>
                </div>

                {trabajadoresRama.map((t) => {
                  const rec = recordMap[t.id];
                  const dias = DIAS_KEYS.reduce((s, d) => s + (rec?.dias?.[d] || 0), 0);
                  const pago = calcPago(t, rec);

                  return (
                    <div className="report-row" key={t.id}>
                      <span className="report-row-label">{t.nombre}</span>
                      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dias} dias</span>
                        {rec?.extra > 0 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--green)' }}>+${fmt(rec.extra)} extra</span>
                        )}
                        {rec?.anticipo > 0 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--red)' }}>-${fmt(rec.anticipo)} anticipo</span>
                        )}
                        <span className="report-row-value">${fmt(pago)}</span>
                      </div>
                    </div>
                  );
                })}

                <div className="report-row" style={{ background: 'var(--surface2)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Subtotal · {trabajadoresRama.length} trabajadores
                  </span>
                  <span className="report-row-value">${fmt(ramaTotal)}</span>
                </div>
              </div>
            );
          })}

          <div className="report-card" style={{ borderColor: 'var(--gold)' }}>
            <div className="report-row" style={{ background: 'var(--gold-dim)', padding: '1.25rem' }}>
              <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.1rem', letterSpacing: '0.06em' }}>
                TOTAL NOMINA SEMANAL
              </span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.4rem', color: 'var(--gold)', fontWeight: 700 }}>
                ${fmt(grandTotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
