import React, { useState, useRef } from 'react';

function fmt(n) {
  return Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CobrosTab({ cobros = [], onRefresh }) {
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [notas, setNotas] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/El_Salvador' }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const nombreRef = useRef(null);

  async function guardar() {
    if (!nombre.trim() || !monto) return;
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/cobros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, monto: parseFloat(monto), fecha, notas }),
      });
      const data = await res.json();
      if (!data.ok) { setError('Error al guardar'); }
      else {
        setNombre('');
        setMonto('');
        setNotas('');
        onRefresh?.();
        nombreRef.current?.focus();
      }
    } catch { setError('Error de red'); }
    setGuardando(false);
  }

  async function eliminar(id, nombreCobro) {
    if (!confirm(`¿Eliminar cobro de ${nombreCobro}?`)) return;
    await fetch(`/api/cobros/${id}`, { method: 'DELETE' });
    onRefresh?.();
  }

  const filtrados = filtroFecha ? cobros.filter(c => c.fecha === filtroFecha) : cobros;

  const grupos = {};
  for (const c of filtrados) {
    if (!grupos[c.fecha]) grupos[c.fecha] = [];
    grupos[c.fecha].push(c);
  }

  const totalGeneral = cobros.reduce((s, c) => s + c.monto, 0);
  const totalFiltrado = filtrados.reduce((s, c) => s + c.monto, 0);

  function formatFecha(f) {
    return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  return (
    <div>
      {/* Formulario de entrada */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
          Registrar cobro
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>Nombre</label>
            <input
              ref={nombreRef}
              className="form-input"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && document.getElementById('monto-input')?.focus()}
              placeholder="Ej: IVAN"
              style={{ textTransform: 'uppercase' }}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>Monto ($)</label>
            <input
              id="monto-input"
              className="form-input"
              type="number"
              min="0"
              step="0.01"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && guardar()}
              placeholder="0.00"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>Fecha</label>
            <input
              type="date"
              className="form-input"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.35rem' }}>Notas (opcional)</label>
            <input
              className="form-input"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Descripción..."
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={guardar}
            disabled={guardando || !nombre.trim() || !monto}
            style={{ whiteSpace: 'nowrap' }}
          >
            {guardando ? 'Guardando...' : '+ Agregar'}
          </button>
        </div>

        {error && <div className="alert alert-danger" style={{ marginTop: '0.75rem' }}>{error}</div>}
        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
          Enter en Nombre pasa al Monto · Enter en Monto guarda el registro
        </div>
      </div>

      {/* Totales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="summary-card gold">
          <div className="summary-label">Total General</div>
          <div className="summary-value gold">${fmt(totalGeneral)}</div>
        </div>
        <div className="summary-card green">
          <div className="summary-label">{filtroFecha ? 'Total del día' : 'Registros'}</div>
          <div className="summary-value green">{filtroFecha ? `$${fmt(totalFiltrado)}` : cobros.length}</div>
        </div>
      </div>

      {/* Filtro por fecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Filtrar:</span>
        <input type="date" className="form-input" style={{ width: 'auto' }} value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)} />
        {filtroFecha && <button className="btn btn-sm btn-outline" onClick={() => setFiltroFecha('')}>Ver todos</button>}
      </div>

      {/* Lista */}
      {Object.keys(grupos).length === 0 ? (
        <div className="empty-state"><p>No hay cobros registrados.</p></div>
      ) : (
        Object.entries(grupos).map(([f, items]) => (
          <div key={f} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>{formatFecha(f)}</div>
              <div style={{ fontFamily: 'monospace', color: 'var(--gold)', fontWeight: 600 }}>${fmt(items.reduce((s, c) => s + c.monto, 0))}</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                    <th>Notas</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--green)' }}>${fmt(c.monto)}</td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>{c.notas || '—'}</td>
                      <td>
                        <button
                          className="btn btn-icon btn-outline"
                          style={{ color: 'var(--red)', borderColor: 'transparent' }}
                          onClick={() => eliminar(c.id, c.nombre)}
                          title="Eliminar"
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
