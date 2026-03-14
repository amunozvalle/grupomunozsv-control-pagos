import React, { useState, useEffect } from 'react';
import { DIAS_KEYS, DIAS_LABELS, fmt, calcPago } from '../../utils/week';
import { upsertRegistro, updateTrabajador } from '../../api';

function cycleDay(current) {
  if (current === 0) return 1;
  if (current === 1) return 0.5;
  return 0;
}

export default function PagoModal({ trabajador, record, semanaKey, onClose, onSaved }) {
  const [dias, setDias] = useState({ L: 0, M: 0, X: 0, J: 0, V: 0, S: 0 });
  const [extra, setExtra] = useState('');
  const [anticipo, setAnticipo] = useState('');
  const [notas, setNotas] = useState('');
  const [sueldo, setSueldo] = useState(String(trabajador?.sueldo || ''));
  const [nombre, setNombre] = useState(trabajador?.nombre || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSueldo(String(trabajador?.sueldo || ''));
    setNombre(trabajador?.nombre || '');
    if (record) {
      setDias({ L: 0, M: 0, X: 0, J: 0, V: 0, S: 0, ...(record.dias || {}) });
      setExtra(record.extra ? String(record.extra) : '');
      setAnticipo(record.anticipo ? String(record.anticipo) : '');
      setNotas(record.notas || '');
    } else {
      setDias({ L: 0, M: 0, X: 0, J: 0, V: 0, S: 0 });
      setExtra(''); setAnticipo(''); setNotas('');
    }
  }, [record, trabajador]);

  const totalDias = DIAS_KEYS.reduce((s, d) => s + (dias[d] || 0), 0);
  const sueldoNum = Number(sueldo) || 0;
  const preview = calcPago({ ...trabajador, sueldo: sueldoNum }, { dias, extra: Number(extra) || 0, anticipo: Number(anticipo) || 0 });

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = [
        upsertRegistro(semanaKey, {
          trabajador_id: trabajador.id,
          dias,
          extra: Number(extra) || 0,
          anticipo: Number(anticipo) || 0,
          notas,
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
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.15)',
              color: 'inherit',
              fontFamily: 'inherit',
              fontSize: '1.1rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              padding: '0.1rem 0.3rem',
              width: '100%',
              outline: 'none',
            }}
          />
          <button className="btn btn-icon btn-outline" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label>Días trabajados · click para cambiar estado</label>
              <div className="day-picker" style={{ marginTop: '0.4rem' }}>
                {DIAS_KEYS.map(d => {
                  const val = dias[d] || 0;
                  const cls = val === 1 ? 'full' : val === 0.5 ? 'half' : '';
                  return (
                    <button
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

          <div className="form-grid">
            <div className="form-group">
              <label>Sueldo Semanal ($)</label>
              <input type="number" min="0" step="0.01" value={sueldo} onChange={e => setSueldo(e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group" />
            <div className="form-group">
              <label>Pago Extra ($)</label>
              <input type="number" min="0" step="0.01" value={extra} onChange={e => setExtra(e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Anticipo ($)</label>
              <input type="number" min="0" step="0.01" value={anticipo} onChange={e => setAnticipo(e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group full">
              <label>Notas</label>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas opcionales…" rows={2} />
            </div>
          </div>

          <div style={{
            background: 'var(--gold-dim)',
            border: '1px solid rgba(212,168,83,0.25)',
            borderRadius: '8px',
            padding: '1rem',
            marginTop: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {totalDias} días × ${fmt(sueldoNum / 6)}/día
                {Number(extra) > 0 && ` + $${fmt(extra)} extra`}
                {Number(anticipo) > 0 && ` − $${fmt(anticipo)} anticipo`}
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
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
