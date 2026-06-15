import React, { useState, useEffect } from 'react';
import { fmt, calcPago, DIAS_KEYS } from '../../utils/week';

export default function HistorialModal({ trabajador, onClose }) {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/registros/trabajador/${trabajador.id}`)
      .then(r => r.json())
      .then(data => { setRegistros(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [trabajador.id]);

  const totalPagado = registros.reduce((s, r) => s + calcPago(trabajador, r), 0);
  const totalAnticipo = registros.reduce((s, r) => {
    return s + (Array.isArray(r.anticipos) ? r.anticipos.reduce((x, i) => x + i.monto, 0) : (r.anticipo || 0));
  }, 0);

  return (
    <div className="modal-overlay open">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Historial — {trabajador.nombre}</span>
          <button type="button" className="btn btn-icon btn-outline" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>Cargando…</div>
          ) : registros.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>Sin registros</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'SEMANAS', value: registros.length, color: 'var(--gold)' },
                  { label: 'TOTAL PAGADO', value: `$${fmt(totalPagado)}`, color: 'var(--gold)' },
                  { label: 'TOTAL ANTICIPOS', value: `$${fmt(totalAnticipo)}`, color: 'var(--red)' },
                ].map(card => (
                  <div key={card.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 1.25rem', minWidth: 120 }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>{card.label}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.2rem', color: card.color, fontWeight: 700 }}>{card.value}</div>
                  </div>
                ))}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Semana</th>
                      <th style={{ textAlign: 'right' }}>Días</th>
                      <th style={{ textAlign: 'right' }}>Extra</th>
                      <th style={{ textAlign: 'right' }}>Anticipo</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map(r => {
                      const dias = DIAS_KEYS.reduce((s, d) => s + (r.dias?.[d] || 0), 0);
                      const pago = calcPago(trabajador, r);
                      const extra = Array.isArray(r.extras) ? r.extras.reduce((s, e) => s + e.monto, 0) : (r.extra || 0);
                      const anticipo = Array.isArray(r.anticipos) ? r.anticipos.reduce((s, a) => s + a.monto, 0) : (r.anticipo || 0);
                      return (
                        <tr key={r.semana}>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.semana}</td>
                          <td style={{ textAlign: 'right' }}>{dias}</td>
                          <td style={{ textAlign: 'right', color: extra > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>{extra > 0 ? `+$${fmt(extra)}` : '—'}</td>
                          <td style={{ textAlign: 'right', color: anticipo > 0 ? 'var(--red)' : 'var(--text-muted)' }}>{anticipo > 0 ? `-$${fmt(anticipo)}` : '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--gold)', fontWeight: 700 }}>${fmt(pago)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 99,
                              background: r.pagado ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                              color: r.pagado ? 'var(--green)' : 'var(--red)',
                            }}>
                              {r.pagado ? '✓ Pagado' : 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
