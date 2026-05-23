import React, { useState, useEffect } from 'react';
import { DIAS_KEYS, DIAS_LABELS, fmt, calcPago } from '../../utils/week';
import { upsertRegistro, updateTrabajador } from '../../api';

function cycleDay(current) {
  if (current === 0) return 1;
  if (current === 1) return 0.5;
  return 0;
}

function todaySV() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/El_Salvador' });
}

function MovimientosList({ items, onAdd, onRemove, tipo }) {
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(todaySV);
  const [desc, setDesc] = useState('');

  const color = tipo === 'extra' ? 'var(--gold)' : tipo === 'reembolso' ? 'var(--blue)' : 'var(--red)';
  const label = tipo === 'extra' ? 'Pago Extra' : tipo === 'reembolso' ? 'Reembolso' : 'Anticipo';

  // Parsear el monto tolerando comas y espacios (ej. "1,500" o "1.500")
  function parseMonto(str) {
    return parseFloat(String(str).replace(/,/g, '.').trim());
  }

  function agregar() {
    const val = parseMonto(monto);
    if (!monto.trim() || isNaN(val) || val <= 0) return;
    onAdd({ monto: val, fecha, descripcion: desc.trim() });
    setMonto('');
    setDesc('');
  }

  const canAdd = monto.trim() !== '' && !isNaN(parseMonto(monto)) && parseMonto(monto) > 0;
  const total = items.reduce((s, i) => s + i.monto, 0);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem', marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        {total > 0 && <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', color }}>${fmt(total)}</span>}
      </div>

      {/* Lista de entradas existentes */}
      {items.length > 0 && (
        <div style={{ marginBottom: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg)', borderRadius: 6, padding: '0.35rem 0.6rem' }}>
              <span style={{ fontFamily: 'monospace', color, minWidth: 60 }}>${fmt(it.monto)}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', minWidth: 80 }}>{it.fecha}</span>
              <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.descripcion || '—'}</span>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.85rem', padding: '0 0.2rem' }}
                onClick={() => onRemove(i)}
                title="Eliminar"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario para agregar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
        {/* Monto — type="text" inputMode="decimal" para evitar problemas en iOS Safari */}
        <input
          className="form-input"
          type="text"
          inputMode="decimal"
          value={monto}
          onChange={e => setMonto(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && agregar()}
          placeholder="$0.00"
          style={{ width: 90, fontSize: '0.88rem', padding: '0.35rem 0.5rem' }}
        />
        <input
          type="date"
          className="form-input"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          style={{ width: 130, fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
        />
        <input
          className="form-input"
          type="text"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && agregar()}
          placeholder="Descripción (opcional)"
          style={{ flex: '1 1 120px', minWidth: 100, fontSize: '0.82rem', padding: '0.35rem 0.5rem' }}
        />
        <button
          type="button"
          className="btn btn-sm"
          onClick={agregar}
          style={{
            whiteSpace: 'nowrap',
            background: canAdd ? color : 'transparent',
            color: canAdd ? (tipo === 'extra' ? '#000' : '#fff') : 'var(--text-muted)',
            border: `1px solid ${canAdd ? color : 'var(--border)'}`,
            cursor: canAdd ? 'pointer' : 'not-allowed',
            opacity: canAdd ? 1 : 0.5,
            transition: 'all 0.15s',
          }}
        >+ Agregar</button>
      </div>
    </div>
  );
}

export default function PagoModal({ trabajador, record, semanaKey, onClose, onSaved }) {
  const [dias, setDias] = useState({ L: 0, M: 0, X: 0, J: 0, V: 0, S: 0 });
  const [extras, setExtras] = useState([]);
  const [anticipos, setAnticipos] = useState([]);
  const [reembolsos, setReembolsos] = useState([]);
  const [notas, setNotas] = useState('');
  const [sueldo, setSueldo] = useState(String(trabajador?.sueldo || ''));
  const [nombre, setNombre] = useState(trabajador?.nombre || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSueldo(String(trabajador?.sueldo || ''));
    setNombre(trabajador?.nombre || '');
    if (record) {
      setDias({ L: 0, M: 0, X: 0, J: 0, V: 0, S: 0, ...(record.dias || {}) });
      // Compatibilidad con registros viejos (extra/anticipo como número)
      const extrasArr = Array.isArray(record.extras)
        ? record.extras
        : (record.extra ? [{ monto: record.extra, fecha: semanaKey, descripcion: '' }] : []);
      const anticiposArr = Array.isArray(record.anticipos)
        ? record.anticipos
        : (record.anticipo ? [{ monto: record.anticipo, fecha: semanaKey, descripcion: '' }] : []);
      const reembolsosArr = Array.isArray(record.reembolsos)
        ? record.reembolsos
        : (record.reembolso ? [{ monto: record.reembolso, fecha: semanaKey, descripcion: '' }] : []);
      setExtras(extrasArr);
      setAnticipos(anticiposArr);
      setReembolsos(reembolsosArr);
      setNotas(record.notas || '');
    } else {
      setDias({ L: 0, M: 0, X: 0, J: 0, V: 0, S: 0 });
      setExtras([]); setAnticipos([]); setReembolsos([]); setNotas('');
    }
  }, [record, trabajador, semanaKey]);

  const totalDias = DIAS_KEYS.reduce((s, d) => s + (dias[d] || 0), 0);
  const sueldoNum = Number(sueldo) || 0;
  const totalExtra = extras.reduce((s, e) => s + e.monto, 0);
  const totalAnticipo = anticipos.reduce((s, a) => s + a.monto, 0);
  const totalReembolso = reembolsos.reduce((s, r) => s + r.monto, 0);
  const preview = calcPago(
    { ...trabajador, sueldo: sueldoNum },
    { dias, extras, anticipos, reembolsos }
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = [
        upsertRegistro(semanaKey, {
          trabajador_id: trabajador.id,
          dias,
          extras,
          anticipos,
          reembolsos,
          extra: totalExtra,
          anticipo: totalAnticipo,
          reembolso: totalReembolso,
          notas,
          pagado: record?.pagado,
          pagado_at: record?.pagado_at || null,
        }),
      ];
      const workerUpdates = {};
      if (sueldoNum !== (trabajador?.sueldo || 0)) workerUpdates.sueldo = sueldoNum;
      if (nombre.trim() && nombre.trim() !== trabajador?.nombre) workerUpdates.nombre = nombre.trim();
      if (Object.keys(workerUpdates).length > 0) {
        promises.push(updateTrabajador(trabajador.id, workerUpdates));
      }
      await Promise.all(promises);
      onSaved();
    } catch (e) {
      alert('Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay open">
      <div className="modal">
        <div className="modal-header">
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            style={{
              background: 'transparent', border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.15)',
              color: 'inherit', fontFamily: 'inherit',
              fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.04em',
              padding: '0.1rem 0.3rem', width: '100%', outline: 'none',
            }}
          />
          <button type="button" className="btn btn-icon btn-outline" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {/* Días */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label>Días trabajados · click para cambiar estado</label>
              <div className="day-picker" style={{ marginTop: '0.4rem' }}>
                {DIAS_KEYS.map(d => {
                  const val = dias[d] || 0;
                  const cls = val === 1 ? 'full' : val === 0.5 ? 'half' : '';
                  return (
                    <button
                      type="button"
                      key={d}
                      className={`day-btn${cls ? ' ' + cls : ''}`}
                      onClick={() => setDias(prev => ({ ...prev, [d]: cycleDay(prev[d] || 0) }))}
                      title={val === 1 ? 'Día completo' : val === 0.5 ? 'Medio día' : 'Ausente'}
                    >
                      {DIAS_LABELS[d]}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                ○ ausente → ● completo → ◐ medio día
              </div>
            </div>
          </div>

          {/* Sueldo */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Sueldo Semanal ($)</label>
            <input type="number" min="0" step="0.01" value={sueldo} onChange={e => setSueldo(e.target.value)} placeholder="0.00" style={{ maxWidth: 160 }} />
          </div>

          {/* Extras */}
          <MovimientosList
            tipo="extra"
            items={extras}
            onAdd={item => setExtras(prev => [...prev, item])}
            onRemove={i => setExtras(prev => prev.filter((_, idx) => idx !== i))}
          />

          {/* Anticipos */}
          <MovimientosList
            tipo="anticipo"
            items={anticipos}
            onAdd={item => setAnticipos(prev => [...prev, item])}
            onRemove={i => setAnticipos(prev => prev.filter((_, idx) => idx !== i))}
          />

          {/* Reembolsos */}
          <MovimientosList
            tipo="reembolso"
            items={reembolsos}
            onAdd={item => setReembolsos(prev => [...prev, item])}
            onRemove={i => setReembolsos(prev => prev.filter((_, idx) => idx !== i))}
          />

          {/* Notas */}
          <div className="form-group">
            <label>Notas</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas opcionales…" rows={2} />
          </div>

          {/* Resumen */}
          <div style={{
            background: 'var(--gold-dim)', border: '1px solid rgba(212,168,83,0.25)',
            borderRadius: 8, padding: '1rem', marginTop: '0.5rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {totalDias} días × ${fmt(sueldoNum / 6)}/día
                {totalExtra > 0 && ` + $${fmt(totalExtra)} extra`}
                {totalReembolso > 0 && ` + $${fmt(totalReembolso)} reembolso`}
                {totalAnticipo > 0 && ` − $${fmt(totalAnticipo)} anticipo`}
              </div>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1rem', letterSpacing: '0.06em', marginTop: '0.25rem' }}>
                Total a pagar
              </div>
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '1.6rem', color: 'var(--gold)', fontWeight: 700 }}>
              ${fmt(preview)}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
