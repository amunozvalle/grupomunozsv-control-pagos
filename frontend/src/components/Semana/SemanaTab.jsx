import React, { useState, useRef } from 'react';
import SemanaTable from './SemanaTable';
import PagoModal from './PagoModal';
import CompartirModal from './CompartirModal';
import RecordatorioModal from './RecordatorioModal';
import { formatSemana } from '../../utils/week';

function fmt(n) {
  return Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SemanaTab({ trabajadores, ramas, registros, cobros = [], semanaKey, semanaOffset, setSemanaOffset, onRefresh, onRefreshCobros }) {
  const [filtroRama, setFiltroRama] = useState('todos');
  const [editando, setEditando] = useState(null);
  const [compartirOpen, setCompartirOpen] = useState(false);
  const [recordatorioOpen, setRecordatorioOpen] = useState(false);

  // Cobro rápido inline
  const [cobroNombre, setCobroNombre] = useState('');
  const [cobroMonto, setCobroMonto] = useState('');
  const [cobroGuardando, setCobroGuardando] = useState(false);
  const nombreRef = useRef(null);

  const ramasFiltradas = filtroRama === 'todos'
    ? trabajadores
    : trabajadores.filter((t) => t.rama === filtroRama);

  const recordMap = Object.fromEntries(registros.map((r) => [r.trabajador_id, r]));

  // Filtrar cobros de esta semana (lunes a sábado)
  const monday = new Date(semanaKey + 'T12:00:00');
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const cobrosSemana = cobros.filter(c => {
    const d = new Date(c.fecha + 'T12:00:00');
    return d >= monday && d <= saturday;
  });
  const totalCobros = cobrosSemana.reduce((s, c) => s + c.monto, 0);

  async function guardarCobro() {
    if (!cobroNombre.trim() || !cobroMonto) return;
    setCobroGuardando(true);
    try {
      await fetch('/api/cobros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: cobroNombre.trim().toUpperCase(),
          monto: parseFloat(cobroMonto),
          fecha: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/El_Salvador' }),
        }),
      });
      setCobroNombre('');
      setCobroMonto('');
      onRefreshCobros?.();
      nombreRef.current?.focus();
    } catch {}
    setCobroGuardando(false);
  }

  async function eliminarCobro(id) {
    await fetch(`/api/cobros/${id}`, { method: 'DELETE' });
    onRefreshCobros?.();
  }

  return (
    <>
      <div className="section-header">
        <span className="section-title">Semana</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => setRecordatorioOpen(true)}>
            Recordatorio Sábado
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setCompartirOpen(true)}>
            Compartir timesheets
          </button>
          <div className="week-nav">
            <button className="btn btn-icon btn-outline" onClick={() => setSemanaOffset((o) => o - 1)}>‹</button>
            <span className="week-label">{formatSemana(semanaKey)}</span>
            <button className="btn btn-icon btn-outline" onClick={() => setSemanaOffset((o) => o + 1)}>›</button>
            {semanaOffset !== 0 && (
              <button className="btn btn-sm btn-outline" onClick={() => setSemanaOffset(0)}>Hoy</button>
            )}
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <button className={`filter-chip${filtroRama === 'todos' ? ' active' : ''}`} onClick={() => setFiltroRama('todos')}>Todos</button>
        {ramas.map((rama) => (
          <button key={rama.id} className={`filter-chip${filtroRama === rama.id ? ' active' : ''}`} onClick={() => setFiltroRama(rama.id)}>
            <span className="dot" style={{ background: rama.color }} />
            {rama.emoji} {rama.label}
          </button>
        ))}
      </div>

      <SemanaTable
        trabajadores={ramasFiltradas}
        ramas={ramas}
        recordMap={recordMap}
        semanaKey={semanaKey}
        onEdit={(t) => setEditando({ trabajador: t, record: recordMap[t.id] || null })}
        onRefresh={onRefresh}
      />

      {/* ── DINERO RECIBIDO ── */}
      <div style={{ marginTop: '2rem', background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '2px solid var(--green)', borderRadius: 8, padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>💵 Dinero Recibido — {formatSemana(semanaKey)}</div>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 600, color: 'var(--green)' }}>${fmt(totalCobros)}</div>
        </div>

        {/* Entrada rápida */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input
            ref={nombreRef}
            className="form-input"
            value={cobroNombre}
            onChange={e => setCobroNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && document.getElementById('cobro-monto')?.focus()}
            placeholder="Nombre"
            style={{ flex: 2, textTransform: 'uppercase' }}
          />
          <input
            id="cobro-monto"
            className="form-input"
            type="number"
            min="0"
            step="0.01"
            value={cobroMonto}
            onChange={e => setCobroMonto(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && guardarCobro()}
            placeholder="Monto"
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={guardarCobro}
            disabled={cobroGuardando || !cobroNombre.trim() || !cobroMonto}
            style={{ whiteSpace: 'nowrap' }}
          >
            + Agregar
          </button>
        </div>

        {/* Lista de cobros de la semana */}
        {cobrosSemana.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem', textAlign: 'center', padding: '0.5rem 0' }}>Sin cobros esta semana</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {cobrosSemana.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>{c.fecha}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--green)' }}>${fmt(c.monto)}</td>
                    <td>
                      <button
                        className="btn btn-icon btn-outline"
                        style={{ color: 'var(--red)', borderColor: 'transparent' }}
                        onClick={() => eliminarCobro(c.id)}
                        title="Eliminar"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {compartirOpen && <CompartirModal semanaKey={semanaKey} onClose={() => setCompartirOpen(false)} />}
      {recordatorioOpen && <RecordatorioModal trabajadores={trabajadores} registros={registros} semanaKey={semanaKey} onClose={() => setRecordatorioOpen(false)} />}
      {editando && (
        <PagoModal
          trabajador={editando.trabajador}
          record={editando.record}
          semanaKey={semanaKey}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); onRefresh(); }}
        />
      )}
    </>
  );
}
