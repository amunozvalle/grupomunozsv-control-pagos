import React, { useState, useEffect } from 'react';
import { DIAS_KEYS, fmt, calcPago } from '../../utils/week';
import { getRegistrosAnual } from '../../api';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function ReporteAnualTab({ trabajadores, ramas }) {
  const hoy = new Date();
  const [year, setYear] = useState(hoy.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filtroRama, setFiltroRama] = useState('todas');

  const ramaMap = Object.fromEntries(ramas.map((r) => [r.id, r]));
  const trabajadoresMap = Object.fromEntries(trabajadores.map((t) => [t.id, t]));

  useEffect(() => {
    setLoading(true);
    getRegistrosAnual(year)
      .then(setData)
      .finally(() => setLoading(false));
  }, [year]);

  // Procesar datos: para cada trabajador, calcular total por mes
  const filas = [];
  if (data) {
    const acum = {}; // { trabajador_id: { 1: {pago,dias,extra,reembolso,anticipo}, 2: {...}, ... , total: {...} } }

    for (let month = 1; month <= 12; month++) {
      const registros = data[month] || [];
      for (const r of registros) {
        const t = trabajadoresMap[r.trabajador_id];
        if (!t) continue;
        if (filtroRama !== 'todas' && t.rama !== filtroRama) continue;

        if (!acum[r.trabajador_id]) {
          acum[r.trabajador_id] = { t };
          for (let m = 1; m <= 12; m++) {
            acum[r.trabajador_id][m] = { pago: 0, dias: 0, extra: 0, reembolso: 0, anticipo: 0, semanas: 0 };
          }
          acum[r.trabajador_id].total = { pago: 0, dias: 0, extra: 0, reembolso: 0, anticipo: 0, semanas: 0 };
        }

        const dias = DIAS_KEYS.reduce((s, d) => s + (r.dias?.[d] || 0), 0);
        const pago = calcPago(t, r);
        const extra = (r.extras || []).reduce((s, e) => s + e.monto, 0);
        const reembolso = (r.reembolsos || []).reduce((s, e) => s + e.monto, 0);
        const anticipo = (r.anticipos || []).reduce((s, e) => s + e.monto, 0);

        acum[r.trabajador_id][month].pago += pago;
        acum[r.trabajador_id][month].dias += dias;
        acum[r.trabajador_id][month].extra += extra;
        acum[r.trabajador_id][month].reembolso += reembolso;
        acum[r.trabajador_id][month].anticipo += anticipo;
        acum[r.trabajador_id][month].semanas += 1;

        acum[r.trabajador_id].total.pago += pago;
        acum[r.trabajador_id].total.dias += dias;
        acum[r.trabajador_id].total.extra += extra;
        acum[r.trabajador_id].total.reembolso += reembolso;
        acum[r.trabajador_id].total.anticipo += anticipo;
        acum[r.trabajador_id].total.semanas += 1;
      }
    }

    for (const row of Object.values(acum)) {
      filas.push(row);
    }
    filas.sort((a, b) => a.t.nombre.localeCompare(b.t.nombre));
  }

  // Totales por mes
  const totalesMes = {};
  for (let m = 1; m <= 12; m++) {
    totalesMes[m] = filas.reduce((s, f) => s + f[m].pago, 0);
  }
  const granTotal = filas.reduce((s, f) => s + f.total.pago, 0);

  return (
    <>
      {/* Header */}
      <div className="section-header">
        <span className="section-title">Reporte Anual</span>
        <button className="btn btn-outline btn-sm no-print" onClick={() => window.print()}>🖨 Imprimir</button>
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-icon btn-outline" onClick={() => setYear(y => y - 1)}>‹</button>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: 60, textAlign: 'center' }}>{year}</span>
          <button className="btn btn-icon btn-outline" onClick={() => setYear(y => y + 1)}>›</button>
          {year !== hoy.getFullYear() && (
            <button className="btn btn-sm btn-outline" onClick={() => setYear(hoy.getFullYear())}>Hoy</button>
          )}
        </div>

        <select className="form-input" value={filtroRama} onChange={e => setFiltroRama(e.target.value)} style={{ width: 'auto' }}>
          <option value="todas">Todas las ramas</option>
          {ramas.map(r => <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>)}
        </select>
      </div>

      {/* Contenido */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>Cargando...</div>
      ) : filas.length === 0 ? (
        <div className="empty-state"><p>No hay registros para {year}.</p></div>
      ) : (
        <>
          {/* Tabla principal */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 2 }}>Trabajador</th>
                  <th>Rama</th>
                  {MESES.map((m, i) => (
                    <th key={i} style={{ textAlign: 'right', fontSize: '0.75rem', minWidth: 75 }}>{m}</th>
                  ))}
                  <th style={{ textAlign: 'right', fontWeight: 800, minWidth: 90 }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => {
                  const rama = ramaMap[fila.t.rama];
                  return (
                    <tr key={fila.t.id}>
                      <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 1, whiteSpace: 'nowrap' }}>
                        {fila.t.nombre}
                      </td>
                      <td>
                        {rama ? (
                          <span className="badge" style={{ background: rama.color + '22', color: rama.color, border: `1px solid ${rama.color}44` }}>
                            {rama.emoji} {rama.label}
                          </span>
                        ) : '—'}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <td key={m} style={{
                          textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '0.8rem',
                          color: fila[m].pago > 0 ? 'var(--text)' : 'var(--text-muted)',
                        }}
                          title={fila[m].pago > 0 ? `${fila[m].dias} días · ${fila[m].semanas} sem${fila[m].extra > 0 ? ' · +$' + fmt(fila[m].extra) + ' extra' : ''}${fila[m].reembolso > 0 ? ' · +$' + fmt(fila[m].reembolso) + ' reemb' : ''}${fila[m].anticipo > 0 ? ' · -$' + fmt(fila[m].anticipo) + ' antic' : ''}` : ''}
                        >
                          {fila[m].pago > 0 ? `$${fmt(fila[m].pago)}` : '—'}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--gold)', fontWeight: 700, fontSize: '0.85rem' }}>
                        ${fmt(fila.total.pago)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface)', fontWeight: 700 }}>
                  <td colSpan={2} style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 2, paddingTop: '0.75rem', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                    TOTAL · {filas.length} trabajadores
                  </td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <td key={m} style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '0.8rem', color: totalesMes[m] > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                      {totalesMes[m] > 0 ? `$${fmt(totalesMes[m])}` : '—'}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '1.1rem', color: 'var(--gold)', fontWeight: 700 }}>
                    ${fmt(granTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Resumen desglosado */}
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
              Resumen Mensual {year}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                const total = totalesMes[m];
                const trabajadoresMes = filas.filter(f => f[m].pago > 0).length;
                return (
                  <div key={m} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderTop: total > 0 ? '2px solid var(--gold)' : '2px solid var(--border)',
                    borderRadius: 8, padding: '0.65rem 0.75rem',
                  }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>{MESES_FULL[m - 1]}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1rem', color: total > 0 ? 'var(--gold)' : 'var(--text-muted)', fontWeight: 700 }}>
                      {total > 0 ? `$${fmt(total)}` : '—'}
                    </div>
                    {trabajadoresMes > 0 && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>{trabajadoresMes} trabaj.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumen por rama */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1.25rem' }}>
            {ramas.map(rama => {
              const sub = filas.filter(f => f.t.rama === rama.id);
              if (sub.length === 0) return null;
              const subTotal = sub.reduce((s, f) => s + f.total.pago, 0);
              const subDias = sub.reduce((s, f) => s + f.total.dias, 0);
              return (
                <div key={rama.id} style={{ background: 'var(--surface)', border: `1px solid ${rama.color}44`, borderTop: `2px solid ${rama.color}`, borderRadius: 8, padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: rama.color, marginBottom: '0.3rem' }}>{rama.emoji} {rama.label}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.15rem', color: 'var(--gold)', fontWeight: 700 }}>${fmt(subTotal)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>{sub.length} trabajadores · {subDias} días</div>
                </div>
              );
            })}
          </div>

          {/* Gran total card */}
          <div style={{
            background: 'var(--gold-dim)', border: '1px solid rgba(212,168,83,0.25)',
            borderRadius: 8, padding: '1.25rem', marginTop: '1.25rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Total Anual {year}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                {filas.length} trabajadores · {filas.reduce((s, f) => s + f.total.dias, 0)} días totales
              </div>
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.8rem', color: 'var(--gold)', fontWeight: 700 }}>
              ${fmt(granTotal)}
            </div>
          </div>
        </>
      )}
    </>
  );
}
