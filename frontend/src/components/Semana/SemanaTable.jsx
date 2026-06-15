import React from 'react';
import { DIAS_KEYS, DIAS_LABELS, fmt, calcPago } from '../../utils/week';
import { deleteRegistro, upsertRegistro } from '../../api';

export default function SemanaTable({ trabajadores, ramas, recordMap, semanaKey, onEdit, onRefresh, isViewer }) {
  const ramaMap = Object.fromEntries(ramas.map((r) => [r.id, r]));

  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < 640);
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleDelete = async (t) => {
    if (!confirm(`Eliminar registro de ${t.nombre}?`)) return;
    await deleteRegistro(semanaKey, t.id);
    onRefresh();
  };

  const handleTogglePagado = async (t, rec) => {
    if (!rec) return;
    await upsertRegistro(semanaKey, {
      trabajador_id: t.id,
      dias: rec.dias || {},
      extras: rec.extras || [],
      anticipos: rec.anticipos || [],
      reembolsos: rec.reembolsos || [],
      extra: Array.isArray(rec.extras) ? rec.extras.reduce((s, e) => s + e.monto, 0) : (Number(rec.extra) || 0),
      anticipo: Array.isArray(rec.anticipos) ? rec.anticipos.reduce((s, a) => s + a.monto, 0) : (Number(rec.anticipo) || 0),
      reembolso: Array.isArray(rec.reembolsos) ? rec.reembolsos.reduce((s, r) => s + r.monto, 0) : (Number(rec.reembolso) || 0),
      notas: rec.notas || '',
      pagado: !rec.pagado,
      pagado_at: !rec.pagado ? new Date().toISOString() : null,
    });
    onRefresh();
  };

  if (trabajadores.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '2rem' }}>Trabajadores</div>
        <p>No hay trabajadores en esta categoria.</p>
      </div>
    );
  }

  return (
    isMobile ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.25rem 0' }}>
        {trabajadores.map(t => {
          const r = recordMap[t.id] || {};
          const dias = DIAS_KEYS.reduce((s, d) => s + (r.dias?.[d] || 0), 0);
          const pago = calcPago(t, r);
          return (
            <div key={t.id} style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{t.nombre}</span>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 99,
                  background: r.pagado ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                  color: r.pagado ? 'var(--green)' : 'var(--red)',
                }}>
                  {r.pagado ? '✓' : '●'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {DIAS_KEYS.map(d => (
                  <span key={d} style={{
                    padding: '0.15rem 0.4rem',
                    borderRadius: 4,
                    background: (r.dias?.[d] || 0) > 0 ? 'rgba(212,175,55,0.18)' : 'var(--bg-dark)',
                    color: (r.dias?.[d] || 0) > 0 ? 'var(--gold)' : 'var(--text-muted)',
                  }}>
                    {DIAS_LABELS[d]}: {r.dias?.[d] ?? 0}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{dias} días · ${fmt(t.salarioDia ?? t.sueldo ?? 0)}/día</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '1rem', fontWeight: 700, color: 'var(--gold)' }}>${fmt(pago)}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                {!isViewer && (
                  <button type="button" className="btn btn-sm btn-outline" style={{ flex: 1 }} onClick={() => onEdit(t)}>✎ Editar</button>
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    flex: 1,
                    background: r.pagado ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                    color: isViewer ? 'var(--text-muted)' : (r.pagado ? 'var(--red)' : 'var(--green)'),
                    opacity: isViewer ? 0.5 : 1,
                  }}
                  onClick={() => !isViewer && handleTogglePagado(t, r)}
                  disabled={isViewer}
                >
                  {r.pagado ? '✕ Desmarcar' : '✓ Pagar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Trabajador</th>
              <th>Rama</th>
              {DIAS_KEYS.map((d) => <th key={d} style={{ textAlign: 'center' }}>{DIAS_LABELS[d]}</th>)}
              <th style={{ textAlign: 'right' }}>Dias</th>
              <th style={{ textAlign: 'right' }}>Extra</th>
              <th style={{ textAlign: 'right' }}>Reembolso</th>
              <th style={{ textAlign: 'right' }}>Anticipo</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'center' }}>Pagado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {trabajadores.map((t) => {
              const rec = recordMap[t.id];
              const dias = rec?.dias || {};
              const totalDias = DIAS_KEYS.reduce((s, d) => s + (dias[d] || 0), 0);
              const pago = calcPago(t, rec);
              const rama = ramaMap[t.rama];
              const extraVal = Array.isArray(rec?.extras) ? rec.extras.reduce((s, e) => s + e.monto, 0) : (rec?.extra || 0);
              const anticipoVal = Array.isArray(rec?.anticipos) ? rec.anticipos.reduce((s, a) => s + a.monto, 0) : (rec?.anticipo || 0);
              const reembolsoVal = Array.isArray(rec?.reembolsos) ? rec.reembolsos.reduce((s, r) => s + r.monto, 0) : (rec?.reembolso || 0);

              return (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.nombre}</td>
                  <td>
                    {rama ? (
                      <span className="badge" style={{
                        background: rama.color + '22',
                        color: rama.color,
                        border: `1px solid ${rama.color}44`,
                      }}>
                        {rama.emoji} {rama.label}
                      </span>
                    ) : t.rama}
                  </td>
                  {DIAS_KEYS.map((d) => {
                    const val = dias[d] || 0;
                    return (
                      <td key={d} style={{ textAlign: 'center' }}>
                        {val === 1 ? (
                          <span style={{ color: 'var(--green)', fontWeight: 700 }}>●</span>
                        ) : val === 0.5 ? (
                          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>◐</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>○</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{totalDias}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: extraVal ? 'var(--green)' : 'var(--text-muted)' }}>
                    {extraVal ? `+$${fmt(extraVal)}` : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: reembolsoVal ? 'var(--blue, var(--green))' : 'var(--text-muted)' }}>
                    {reembolsoVal ? `+$${fmt(reembolsoVal)}` : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: anticipoVal ? 'var(--red)' : 'var(--text-muted)' }}>
                    {anticipoVal ? `-$${fmt(anticipoVal)}` : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--gold)', fontWeight: 600 }}>
                    ${fmt(pago)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {rec ? (
                      <button
                        className={`btn btn-sm ${rec.pagado ? 'btn-green' : 'btn-outline'}`}
                        onClick={() => !isViewer && handleTogglePagado(t, rec)}
                        disabled={isViewer}
                        title={rec.pagado_at ? `Marcado: ${new Date(rec.pagado_at).toLocaleString()}` : 'Marcar como pagado'}
                        style={isViewer ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                      >
                        {rec.pagado ? 'Pagado' : 'Pendiente'}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Sin registro</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      {!isViewer && (
                        <>
                          <button className="btn btn-icon btn-outline btn-sm" onClick={() => onEdit(t)} title="Editar">Edit</button>
                          {rec && (
                            <button className="btn btn-icon btn-danger btn-sm" onClick={() => handleDelete(t)} title="Eliminar">Del</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )
  );
}
