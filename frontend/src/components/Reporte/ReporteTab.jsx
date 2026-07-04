import React, { useState, useEffect, useCallback } from 'react';
import { DIAS_KEYS, DIAS_LABELS, fmt, calcPago, formatSemana } from '../../utils/week';
import { getRegistrosMes } from '../../api';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function getSemanaFechas(semanaKey) {
  const monday = new Date(semanaKey + 'T12:00:00');
  return DIAS_KEYS.map((d, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day.toLocaleDateString('sv-SE');
  });
}

function getPeriodKey(filtro, semanaKey, diaSeleccionado, mesYear, mesMonth) {
  if (filtro === 'semana') return `semana_${semanaKey}`;
  if (filtro === 'dia') return `dia_${diaSeleccionado}`;
  return `mes_${mesYear}_${mesMonth}`;
}

const STORAGE_KEY = 'gm_montos_entregados';

function loadMontos(periodKey) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [{ id: Date.now(), label: '', monto: '' }];
    const all = JSON.parse(raw);
    const saved = all[periodKey];
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch {}
  return [{ id: Date.now(), label: '', monto: '' }];
}

function saveMontos(periodKey, montos) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[periodKey] = montos;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export default function ReporteTab({ trabajadores, ramas, registros, semanaKey, semanaOffset, setSemanaOffset }) {
  const hoy = new Date();
  const [filtro, setFiltro] = useState('semana');
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => hoy.toLocaleDateString('sv-SE'));
  const [mesYear, setMesYear] = useState(hoy.getFullYear());
  const [mesMonth, setMesMonth] = useState(hoy.getMonth() + 1);
  const [registrosMes, setRegistrosMes] = useState([]);
  const [loadingMes, setLoadingMes] = useState(false);
  const [filtroRama, setFiltroRama] = useState('todas');
  const [montosEntregados, setMontosEntregados] = useState([{ id: Date.now(), label: '', monto: '' }]);

  const ramaMap = Object.fromEntries(ramas.map((r) => [r.id, r]));
  const trabajadoresMap = Object.fromEntries(trabajadores.map((t) => [t.id, t]));

  const periodKey = getPeriodKey(filtro, semanaKey, diaSeleccionado, mesYear, mesMonth);

  // Cargar montos guardados cuando cambia el período
  useEffect(() => {
    setMontosEntregados(loadMontos(periodKey));
  }, [periodKey]);

  // Guardar montos cuando cambian
  useEffect(() => {
    saveMontos(periodKey, montosEntregados);
  }, [periodKey, montosEntregados]);

  // Cargar datos del mes
  useEffect(() => {
    if (filtro !== 'mes') return;
    setLoadingMes(true);
    getRegistrosMes(mesYear, mesMonth)
      .then(setRegistrosMes)
      .finally(() => setLoadingMes(false));
  }, [filtro, mesYear, mesMonth]);

  function agregarMonto() {
    setMontosEntregados(prev => [...prev, { id: Date.now(), label: '', monto: '' }]);
  }

  function eliminarMonto(id) {
    setMontosEntregados(prev => {
      const next = prev.filter(m => m.id !== id);
      return next.length === 0 ? [{ id: Date.now(), label: '', monto: '' }] : next;
    });
  }

  function actualizarMonto(id, field, value) {
    setMontosEntregados(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  }

  const totalEntregado = montosEntregados.reduce((s, m) => s + (Number(m.monto) || 0), 0);

  // ── Datos para filtro DÍA ──────────────────────────────────────────────
  const diasDeSemana = getSemanaFechas(semanaKey);
  const diaIndex = diasDeSemana.indexOf(diaSeleccionado);

  const filasDia = registros
    .filter(r => {
      const t = trabajadoresMap[r.trabajador_id];
      if (!t) return false;
      if (filtroRama !== 'todas' && t.rama !== filtroRama) return false;
      if (diaIndex < 0) return false;
      const key = DIAS_KEYS[diaIndex];
      return (r.dias?.[key] || 0) > 0;
    })
    .map(r => {
      const t = trabajadoresMap[r.trabajador_id];
      const key = DIAS_KEYS[diaIndex];
      const val = r.dias?.[key] || 0;
      const diario = (t.sueldo || 0) / 6;
      return { t, r, diasTrabajados: val, pagoDia: val * diario };
    });

  // ── Datos para filtro SEMANA ───────────────────────────────────────────
  const filasSemana = registros
    .filter(r => {
      const t = trabajadoresMap[r.trabajador_id];
      return t && (filtroRama === 'todas' || t.rama === filtroRama);
    })
    .map(r => {
      const t = trabajadoresMap[r.trabajador_id];
      const dias = DIAS_KEYS.reduce((s, d) => s + (r.dias?.[d] || 0), 0);
      const pago = calcPago(t, r);
      const extra = (r.extras || []).reduce((s, e) => s + e.monto, 0);
      const reembolso = (r.reembolsos || []).reduce((s, e) => s + e.monto, 0);
      const anticipo = (r.anticipos || []).reduce((s, e) => s + e.monto, 0);
      return { t, r, dias, pago, extra, reembolso, anticipo };
    })
    .sort((a, b) => a.t.nombre.localeCompare(b.t.nombre));

  // ── Datos para filtro MES ──────────────────────────────────────────────
  const acuMes = {};
  for (const r of registrosMes) {
    const t = trabajadoresMap[r.trabajador_id];
    if (!t) continue;
    if (filtroRama !== 'todas' && t.rama !== filtroRama) continue;
    if (!acuMes[r.trabajador_id]) acuMes[r.trabajador_id] = { t, dias: 0, pago: 0, extra: 0, reembolso: 0, anticipo: 0, semanas: 0 };
    const dias = DIAS_KEYS.reduce((s, d) => s + (r.dias?.[d] || 0), 0);
    acuMes[r.trabajador_id].dias += dias;
    acuMes[r.trabajador_id].pago += calcPago(t, r);
    acuMes[r.trabajador_id].extra += (r.extras || []).reduce((s, e) => s + e.monto, 0);
    acuMes[r.trabajador_id].reembolso += (r.reembolsos || []).reduce((s, e) => s + e.monto, 0);
    acuMes[r.trabajador_id].anticipo += (r.anticipos || []).reduce((s, e) => s + e.monto, 0);
    acuMes[r.trabajador_id].semanas += 1;
  }
  const filasMes = Object.values(acuMes).sort((a, b) => a.t.nombre.localeCompare(b.t.nombre));

  const totalDia = filasDia.reduce((s, f) => s + f.pagoDia, 0);
  const totalSemana = filasSemana.reduce((s, f) => s + f.pago, 0);
  const totalMes = filasMes.reduce((s, f) => s + f.pago, 0);

  const filas = filtro === 'dia' ? filasDia : filtro === 'semana' ? filasSemana : filasMes;
  const total = filtro === 'dia' ? totalDia : filtro === 'semana' ? totalSemana : totalMes;

  const sobrante = totalEntregado > 0 ? totalEntregado - total : null;

  function exportarCSV() {
    let headers, rows;
    if (filtro === 'dia') {
      headers = ['Trabajador', 'Rama', 'Asistencia', 'Total'];
      rows = filas.map(f => [
        f.t.nombre,
        ramaMap[f.t.rama]?.label || f.t.rama,
        f.diasTrabajados === 1 ? 'Completo' : 'Medio día',
        fmt(f.pagoDia),
      ]);
    } else {
      headers = ['Trabajador', 'Rama', 'Días', 'Extra', 'Reembolso', 'Anticipo', 'Total', filtro === 'semana' ? 'Estado' : null].filter(Boolean);
      rows = filas.map(f => {
        const row = [f.t.nombre, ramaMap[f.t.rama]?.label || f.t.rama, f.dias, fmt(f.extra), fmt(f.reembolso), fmt(f.anticipo), fmt(f.pago)];
        if (filtro === 'semana') row.push(f.r?.pagado ? 'Pagado' : 'Pendiente');
        return row;
      });
      const totRow = ['', '', '', '', '', 'TOTAL', fmt(total)];
      if (filtro === 'semana') totRow.push('');
      rows.push(totRow);
    }
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filtro === 'dia'
      ? `Nomina_${diaSeleccionado}.csv`
      : filtro === 'semana'
      ? `Nomina_Semana_${semanaKey}.csv`
      : `Nomina_${MESES[mesMonth - 1]}_${mesYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Print header con fecha — solo visible al imprimir */}
      <div className="print-header" style={{ display: 'none', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, textAlign: 'center' }}>
          GRUPO MUÑOZ — Control de Pagos
        </div>
        <div style={{ fontSize: '13px', textAlign: 'center', marginTop: '2px', color: '#444' }}>
          {filtro === 'dia' && `Nómina del día ${new Date(diaSeleccionado + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`}
          {filtro === 'semana' && `Nómina Semana ${formatSemana(semanaKey)} ${new Date(semanaKey + 'T12:00:00').getFullYear()}`}
          {filtro === 'mes' && `Nómina ${MESES[mesMonth - 1]} ${mesYear}`}
        </div>
      </div>

      {/* Header */}
      <div className="section-header">
        <span className="section-title">Reporte</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline btn-sm no-print" onClick={exportarCSV} disabled={filas.length === 0}>
            📥 CSV
          </button>
          <button className="btn btn-outline btn-sm no-print" style={{ minHeight: 44, padding: '0.5rem 1rem' }} onClick={() => {
            const prev = document.title;
            if (filtro === 'dia') {
              const d = new Date(diaSeleccionado + 'T12:00:00');
              document.title = `Nomina_${d.toLocaleDateString('sv-SE', { timeZone: 'America/El_Salvador' })}`;
            } else if (filtro === 'semana') {
              document.title = `Nomina_Semana_${semanaKey}`;
            } else {
              document.title = `Nomina_${MESES[mesMonth - 1]}_${mesYear}`;
            }
            window.print();
            setTimeout(() => { document.title = prev; }, 1000);
          }}>🖨 Imprimir</button>
        </div>
      </div>

      {/* Barra de filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>

        {/* Tipo de filtro */}
        <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {['dia','semana','mes'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: '0.45rem 1rem', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              background: filtro === f ? 'var(--gold)' : 'transparent',
              color: filtro === f ? '#000' : 'var(--text-dim)',
              textTransform: 'capitalize', transition: 'all 0.15s',
            }}>{f === 'dia' ? 'Día' : f === 'semana' ? 'Semana' : 'Mes'}</button>
          ))}
        </div>

        {/* Controles según filtro */}
        {filtro === 'dia' && (
          <input type="date" className="form-input" value={diaSeleccionado}
            onChange={e => setDiaSeleccionado(e.target.value)}
            style={{ width: 'auto' }} />
        )}
        {filtro === 'semana' && (
          <div className="week-nav">
            <button className="btn btn-icon btn-outline" onClick={() => setSemanaOffset(o => o - 1)}>‹</button>
            <span className="week-label">{formatSemana(semanaKey)}</span>
            <button className="btn btn-icon btn-outline" onClick={() => setSemanaOffset(o => o + 1)}>›</button>
            {semanaOffset !== 0 && <button className="btn btn-sm btn-outline" onClick={() => setSemanaOffset(0)}>Hoy</button>}
          </div>
        )}
        {filtro === 'mes' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn btn-icon btn-outline" onClick={() => {
              if (mesMonth === 1) { setMesMonth(12); setMesYear(y => y - 1); }
              else setMesMonth(m => m - 1);
            }}>‹</button>
            <span style={{ fontWeight: 600, minWidth: 120, textAlign: 'center' }}>{MESES[mesMonth - 1]} {mesYear}</span>
            <button className="btn btn-icon btn-outline" onClick={() => {
              if (mesMonth === 12) { setMesMonth(1); setMesYear(y => y + 1); }
              else setMesMonth(m => m + 1);
            }}>›</button>
          </div>
        )}

        {/* Filtro rama */}
        <select className="form-input" value={filtroRama} onChange={e => setFiltroRama(e.target.value)} style={{ width: 'auto' }}>
          <option value="todas">Todas las ramas</option>
          {ramas.map(r => <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>)}
        </select>
      </div>

      {/* Tabla */}
      {loadingMes ? (
        <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>Cargando...</div>
      ) : filas.length === 0 ? (
        <div className="empty-state"><p>No hay registros para este período.</p></div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Trabajador</th>
                  <th>Rama</th>
                  {filtro === 'dia' && <th style={{ textAlign: 'center' }}>Asistencia</th>}
                  {filtro !== 'dia' && <th style={{ textAlign: 'right' }}>Días</th>}
                  {filtro !== 'dia' && <th style={{ textAlign: 'right' }}>Extra</th>}
                  {filtro !== 'dia' && <th style={{ textAlign: 'right' }}>Reembolso</th>}
                  {filtro !== 'dia' && <th style={{ textAlign: 'right' }}>Anticipo</th>}
                  <th style={{ textAlign: 'right' }}>Total</th>
                  {filtro === 'semana' && <th style={{ textAlign: 'center' }}>Estado</th>}
                </tr>
              </thead>
              <tbody>
                {filas.map((fila, i) => {
                  const t = fila.t;
                  const rama = ramaMap[t.rama];
                  return (
                    <tr key={t.id + (fila.r?.semana || i)}>
                      <td style={{ fontWeight: 600 }}>{t.nombre}</td>
                      <td>
                        {rama ? (
                          <span className="badge" style={{ background: rama.color + '22', color: rama.color, border: `1px solid ${rama.color}44` }}>
                            {rama.emoji} {rama.label}
                          </span>
                        ) : '—'}
                      </td>
                      {filtro === 'dia' && (
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ color: fila.diasTrabajados === 1 ? 'var(--green)' : 'var(--gold)', fontWeight: 700 }}>
                            {fila.diasTrabajados === 1 ? '● Completo' : '◐ Medio día'}
                          </span>
                        </td>
                      )}
                      {filtro !== 'dia' && (
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fila.dias}</td>
                      )}
                      {filtro !== 'dia' && (
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: fila.extra > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                          {fila.extra > 0 ? `+$${fmt(fila.extra)}` : '—'}
                        </td>
                      )}
                      {filtro !== 'dia' && (
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: fila.reembolso > 0 ? 'var(--blue)' : 'var(--text-muted)' }}>
                          {fila.reembolso > 0 ? `+$${fmt(fila.reembolso)}` : '—'}
                        </td>
                      )}
                      {filtro !== 'dia' && (
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: fila.anticipo > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                          {fila.anticipo > 0 ? `-$${fmt(fila.anticipo)}` : '—'}
                        </td>
                      )}
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--gold)', fontWeight: 700 }}>
                        ${fmt(filtro === 'dia' ? fila.pagoDia : fila.pago)}
                      </td>
                      {filtro === 'semana' && (
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 99,
                            background: fila.r?.pagado ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                            color: fila.r?.pagado ? 'var(--green)' : 'var(--red)',
                          }}>
                            {fila.r?.pagado ? '✓ Pagado' : 'Pendiente'}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface)', fontWeight: 700 }}>
                  <td colSpan={filtro === 'dia' ? 3 : filtro === 'semana' ? 7 : 6} style={{ paddingTop: '0.75rem', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                    TOTAL · {filas.length} trabajadores
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '1.1rem', color: 'var(--gold)', fontWeight: 700 }}>
                    ${fmt(total)}
                  </td>
                  {filtro === 'semana' && <td />}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Montos entregados */}
          <div className="print-sobrante" style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '1rem', marginTop: '1rem',
          }}>
            {/* Fila de encabezado */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Montos entregados
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                  Total nómina: <strong style={{ color: 'var(--gold)', fontFamily: 'DM Mono, monospace' }}>${fmt(total)}</strong>
                </span>
                <button
                  className="btn btn-outline btn-sm no-print"
                  onClick={agregarMonto}
                  style={{ fontSize: '0.8rem' }}
                >
                  + Agregar
                </button>
              </div>
            </div>

            {/* Lista de casillas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {montosEntregados.map((m, idx) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', minWidth: 20, textAlign: 'right' }}>
                    {idx + 1}.
                  </span>
                  <input
                    className="form-input no-print"
                    type="text"
                    placeholder="Descripción (opcional)"
                    value={m.label}
                    onChange={e => actualizarMonto(m.id, 'label', e.target.value)}
                    style={{ width: 180, fontSize: '0.88rem' }}
                  />
                  <input
                    className="form-input no-print"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={m.monto}
                    onChange={e => actualizarMonto(m.id, 'monto', e.target.value)}
                    style={{ width: 120, fontSize: '0.95rem', fontFamily: 'DM Mono, monospace' }}
                  />
                  {Number(m.monto) > 0 && (
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.95rem', color: 'var(--text-dim)', minWidth: 90 }}>
                      ${fmt(Number(m.monto))}
                    </span>
                  )}
                  {/* Descripción para impresión */}
                  <span className="print-only" style={{ display: 'none', fontSize: '0.88rem' }}>
                    {m.label ? `${m.label}: ` : ''}<strong>${fmt(Number(m.monto) || 0)}</strong>
                  </span>
                  {montosEntregados.length > 1 && (
                    <button
                      className="btn btn-icon btn-outline no-print"
                      onClick={() => eliminarMonto(m.id)}
                      title="Eliminar"
                      style={{ color: 'var(--red)', borderColor: 'var(--red)', opacity: 0.7, fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Fila de totales */}
            {totalEntregado > 0 && (
              <div style={{
                marginTop: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                  Total entregado:{' '}
                  <strong style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>${fmt(totalEntregado)}</strong>
                </div>
                <div style={{
                  background: sobrante >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  border: `1px solid ${sobrante >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  borderRadius: 8, padding: '0.5rem 1rem', textAlign: 'right',
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {sobrante >= 0 ? 'Sobrante' : 'Faltante'}
                  </div>
                  <div style={{
                    fontFamily: 'DM Mono, monospace', fontSize: '1.3rem', fontWeight: 700,
                    color: sobrante >= 0 ? 'var(--green)' : 'var(--red)',
                  }}>
                    ${fmt(Math.abs(sobrante))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Resumen por rama */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '1.5rem' }}>
            {ramas.map(rama => {
              const sub = filas.filter(f => f.t.rama === rama.id);
              if (sub.length === 0) return null;
              const subTotal = sub.reduce((s, f) => s + (filtro === 'dia' ? f.pagoDia : f.pago), 0);
              return (
                <div key={rama.id} style={{ background: 'var(--surface)', border: `1px solid ${rama.color}44`, borderTop: `2px solid ${rama.color}`, borderRadius: 8, padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: rama.color, marginBottom: '0.3rem' }}>{rama.emoji} {rama.label}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: 'var(--gold)', fontWeight: 700 }}>${fmt(subTotal)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>{sub.length} trabajadores</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
