import React, { useState, useEffect, useCallback } from 'react';

function fmt(n) {
  return Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CobrosTab() {
  const [cobros, setCobros] = useState([]);
  const [texto, setTexto] = useState('');
  const [notas, setNotas] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/El_Salvador' }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/cobros');
    const data = await res.json();
    setCobros(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function guardar() {
    if (!texto.trim()) return;
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/cobros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, fecha, notas }),
      });
      const data = await res.json();
      if (!data.ok || data.added.length === 0) {
        setError('No se pudo interpretar el texto. Formato: NOMBRE MONTO');
      } else {
        setTexto('');
        setNotas('');
        await load();
      }
    } catch { setError('Error de red'); }
    setGuardando(false);
  }

  async function eliminar(id) {
    await fetch(`/api/cobros/${id}`, { method: 'DELETE' });
    await load();
  }

  const filtrados = filtroFecha
    ? cobros.filter(c => c.fecha === filtroFecha)
    : cobros;

  // Agrupar por fecha
  const grupos = {};
  for (const c of filtrados) {
    if (!grupos[c.fecha]) grupos[c.fecha] = [];
    grupos[c.fecha].push(c);
  }

  const totalFiltrado = filtrados.reduce((s, c) => s + c.monto, 0);
  const totalGeneral = cobros.reduce((s, c) => s + c.monto, 0);

  function formatFecha(f) {
    const d = new Date(f + 'T12:00:00');
    return d.toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  return (
    <div>
      {/* Entrada rápida */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
          Registrar cobro
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <textarea
            className="form-input"
            rows={3}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder={'IVAN 420\nBEYLI 500\nCARLOS 350'}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) guardar(); }}
            style={{ fontFamily: 'var(--font-mono, monospace)', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              type="date"
              className="form-input"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
            />
            <input
              className="form-input"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Notas (opcional)"
            />
            <button
              className="btn btn-primary"
              onClick={guardar}
              disabled={guardando || !texto.trim()}
              style={{ flex: 1 }}
            >
              {guardando ? 'Guardando...' : '+ Guardar'}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger" style={{ marginTop: '0.5rem' }}>{error}</div>}
        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
          Formato: <code>NOMBRE MONTO</code> — uno por línea o separados por coma. Ctrl+Enter para guardar.
        </div>
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="summary-card gold">
          <div className="summary-label">Total General</div>
          <div className="summary-value gold">${fmt(totalGeneral)}</div>
        </div>
        <div className="summary-card green">
          <div className="summary-label">{filtroFecha ? 'Total del día' : 'Total registros'}</div>
          <div className="summary-value green">{filtroFecha ? `$${fmt(totalFiltrado)}` : cobros.length}</div>
        </div>
      </div>

      {/* Filtro por fecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Filtrar por fecha:</span>
        <input
          type="date"
          className="form-input"
          style={{ width: 'auto' }}
          value={filtroFecha}
          onChange={e => setFiltroFecha(e.target.value)}
        />
        {filtroFecha && (
          <button className="btn btn-sm btn-outline" onClick={() => setFiltroFecha('')}>Mostrar todos</button>
        )}
      </div>

      {/* Lista agrupada por fecha */}
      {Object.keys(grupos).length === 0 ? (
        <div className="empty-state"><p>No hay cobros registrados.</p></div>
      ) : (
        Object.entries(grupos).map(([fecha, items]) => {
          const totalDia = items.reduce((s, c) => s + c.monto, 0);
          return (
            <div key={fecha} style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                  {formatFecha(fecha)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--gold)', fontSize: '0.9rem', fontWeight: 600 }}>
                  ${fmt(totalDia)}
                </div>
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
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: 'var(--green)' }}>
                          ${fmt(c.monto)}
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>{c.notas || '—'}</td>
                        <td>
                          <button
                            className="btn btn-icon btn-outline"
                            style={{ color: 'var(--red)', borderColor: 'transparent', fontSize: '0.8rem' }}
                            onClick={() => { if (confirm(`¿Eliminar cobro de ${c.nombre}?`)) eliminar(c.id); }}
                            title="Eliminar"
                          >✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
