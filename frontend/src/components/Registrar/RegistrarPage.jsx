import React, { useEffect, useMemo, useState } from 'react';
import { getRegistrarPayload, saveRegistrarPayload } from '../../api';
import { DIAS_KEYS, DIAS_LABELS, calcPago, fmt, formatSemana } from '../../utils/week';

function cycleDay(current) {
  if (current === 0) return 1;
  if (current === 1) return 0.5;
  return 0;
}

function getTokenFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[1] || '';
}

function isWhatsAppBrowser() {
  return /WhatsApp/i.test(navigator.userAgent);
}

function MovimientoRow({ item, color, onRemove, index }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      background: 'rgba(255,255,255,0.05)', borderRadius: 8,
      padding: '0.5rem 0.75rem', marginBottom: '0.4rem',
    }}>
      <span style={{ fontFamily: 'monospace', color, fontWeight: 700, minWidth: 60 }}>${fmt(item.monto)}</span>
      <span style={{ flex: 1, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{item.descripcion || '—'}</span>
      <button
        onClick={() => onRemove(index)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.2rem' }}
      >✕</button>
    </div>
  );
}

function MovimientosSection({ label, color, items, onAdd, onRemove }) {
  const [monto, setMonto] = useState('');
  const [desc, setDesc] = useState('');
  const total = items.reduce((s, i) => s + i.monto, 0);

  function agregar() {
    const m = parseFloat(monto);
    if (!m || m <= 0) return;
    onAdd({ monto: m, descripcion: desc.trim() });
    setMonto(''); setDesc('');
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}33`,
      borderRadius: 12, padding: '1rem', marginBottom: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <span style={{ fontSize: '0.72rem', color, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{label}</span>
        {total > 0 && <span style={{ fontFamily: 'monospace', color, fontWeight: 700 }}>${fmt(total)}</span>}
      </div>

      {items.map((it, i) => (
        <MovimientoRow key={i} item={it} color={color} onRemove={onRemove} index={i} />
      ))}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: items.length > 0 ? '0.5rem' : 0 }}>
        <input
          type="number" min="0" step="0.01"
          value={monto}
          onChange={e => setMonto(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && agregar()}
          placeholder="$0.00"
          style={{
            flex: '0 0 90px', padding: '0.6rem 0.75rem', borderRadius: 8,
            border: `1px solid ${color}44`, background: 'rgba(0,0,0,0.3)',
            color: '#fff', fontSize: '0.9rem', outline: 'none',
          }}
        />
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && agregar()}
          placeholder="Descripción..."
          style={{
            flex: 1, padding: '0.6rem 0.75rem', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)',
            color: '#fff', fontSize: '0.9rem', outline: 'none',
          }}
        />
        <button
          onClick={agregar}
          disabled={!monto || parseFloat(monto) <= 0}
          style={{
            padding: '0.6rem 1rem', borderRadius: 8, border: `1px solid ${color}`,
            background: 'transparent', color, fontWeight: 700, cursor: 'pointer',
            fontSize: '0.85rem', whiteSpace: 'nowrap', opacity: (!monto || parseFloat(monto) <= 0) ? 0.4 : 1,
          }}
        >+ Add</button>
      </div>
    </div>
  );
}

export default function RegistrarPage() {
  const token = useMemo(() => getTokenFromPath(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [semana, setSemana] = useState('');
  const [trabajador, setTrabajador] = useState(null);
  const [dias, setDias] = useState({ L: 0, M: 0, X: 0, J: 0, V: 0, S: 0 });
  const [extras, setExtras] = useState([]);
  const [anticipos, setAnticipos] = useState([]);
  const [reembolsos, setReembolsos] = useState([]);
  const [notasDias, setNotasDias] = useState({ L: '', M: '', X: '', J: '', V: '', S: '' });
  const [notas, setNotas] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await getRegistrarPayload(token);
        if (!active) return;
        setSemana(data.semana);
        setTrabajador(data.trabajador);
        setDias({ L: 0, M: 0, X: 0, J: 0, V: 0, S: 0, ...(data.record?.dias || {}) });
        // Cargar arrays o convertir legacy
        const rec = data.record;
        if (rec?.extras?.length) setExtras(rec.extras);
        else if (rec?.extra) setExtras([{ monto: rec.extra, descripcion: '' }]);
        if (rec?.anticipos?.length) setAnticipos(rec.anticipos);
        else if (rec?.anticipo) setAnticipos([{ monto: rec.anticipo, descripcion: '' }]);
        if (rec?.reembolsos?.length) setReembolsos(rec.reembolsos);
        else if (rec?.reembolso) setReembolsos([{ monto: rec.reembolso, descripcion: '' }]);
        setNotasDias({ L: '', M: '', X: '', J: '', V: '', S: '', ...(rec?.notasDias || {}) });
        setNotas(rec?.notas || '');
      } catch {
        if (!active) return;
        setError('No pudimos abrir esta hoja de trabajo. Revisa que el link siga vigente.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [token]);

  const totalDias = DIAS_KEYS.reduce((sum, key) => sum + (dias[key] || 0), 0);
  const totalExtra = extras.reduce((s, e) => s + e.monto, 0);
  const totalAnticipo = anticipos.reduce((s, a) => s + a.monto, 0);
  const totalReembolso = reembolsos.reduce((s, r) => s + r.monto, 0);
  const totalGanado = calcPago(trabajador, { dias, extras, anticipos, reembolsos });

  async function handleSave() {
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      await saveRegistrarPayload(token, {
        semana,
        dias,
        extras,
        anticipos,
        reembolsos,
        extra: totalExtra,
        anticipo: totalAnticipo,
        reembolso: totalReembolso,
        notasDias,
        notas,
      });
      setSuccess('Tu hoja de trabajo semanal quedo guardada. La nomina ya se actualizo en el sistema.');
    } catch (err) {
      setError(`Error al guardar: ${err.message || 'Intenta de nuevo. Si el problema persiste, abre el link en Chrome o Safari.'}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="registrar-shell"><div className="registrar-card">Cargando...</div></div>;

  if (error && !trabajador) {
    return (
      <div className="registrar-shell">
        <div className="registrar-card">
          <div className="registrar-eyebrow">Grupo Munoz</div>
          <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>
          {isWhatsAppBrowser() && (
            <div style={{ background: 'rgba(255,200,0,0.12)', border: '1px solid rgba(255,200,0,0.3)', borderRadius: 8, padding: '0.65rem 0.85rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#ffe066' }}>
              ⚠️ Intenta abrir este link en <strong>Chrome</strong> o <strong>Safari</strong> (toca ⋮ → Abrir en Chrome).
            </div>
          )}
          <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="registrar-shell">
      <div className="registrar-card">
        <div className="registrar-eyebrow">Grupo Munoz</div>
        <h1 className="registrar-title">Hoja de trabajo semanal</h1>
        <p className="registrar-subtitle">{trabajador?.nombre} · {formatSemana(semana)}</p>

        {isWhatsAppBrowser() && (
          <div style={{ background: 'rgba(255,200,0,0.12)', border: '1px solid rgba(255,200,0,0.3)', borderRadius: 8, padding: '0.65rem 0.85rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#ffe066' }}>
            ⚠️ Estas usando el navegador de WhatsApp. Si tienes problemas guardando, toca los tres puntos (⋮) y selecciona <strong>"Abrir en Chrome"</strong> o <strong>"Abrir en Safari"</strong>.
          </div>
        )}

        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

        {/* Días */}
        <div className="registrar-panel">
          <div className="form-group">
            <label>Dias trabajados</label>
            <div className="registrar-day-grid">
              {DIAS_KEYS.map((key) => {
                const value = dias[key] || 0;
                const cls = value === 1 ? 'full' : value === 0.5 ? 'half' : '';
                return (
                  <button
                    key={key}
                    type="button"
                    className={`registrar-day-btn${cls ? ` ${cls}` : ''}`}
                    onClick={() => setDias((prev) => ({ ...prev, [key]: cycleDay(prev[key] || 0) }))}
                  >
                    <strong>{DIAS_LABELS[key]}</strong>
                    <span>{value === 1 ? 'Completo' : value === 0.5 ? 'Medio' : 'Ausente'}</span>
                  </button>
                );
              })}
            </div>
            <div className="registrar-hint">Toca cada dia para cambiar entre ausente, completo y medio dia.</div>
          </div>

          <div className="form-group full" style={{ marginTop: '0.85rem' }}>
            <label>Notas por día (opcional)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {DIAS_KEYS.map((key) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 34, flexShrink: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{DIAS_LABELS[key]}</span>
                  <input
                    value={notasDias[key] || ''}
                    onChange={(e) => setNotasDias((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="Nota del día (opcional)..."
                    style={{
                      flex: 1, padding: '0.5rem 0.7rem', borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.3)',
                      color: '#fff', fontSize: '0.85rem', outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Movimientos */}
        <div style={{ marginTop: '1rem' }}>
          <MovimientosSection
            label="Pago Extra"
            color="#d4a842"
            items={extras}
            onAdd={item => setExtras(prev => [...prev, item])}
            onRemove={i => setExtras(prev => prev.filter((_, idx) => idx !== i))}
          />
          <MovimientosSection
            label="Anticipo"
            color="#ef4444"
            items={anticipos}
            onAdd={item => setAnticipos(prev => [...prev, item])}
            onRemove={i => setAnticipos(prev => prev.filter((_, idx) => idx !== i))}
          />
          <MovimientosSection
            label="Reembolso"
            color="#5b95dd"
            items={reembolsos}
            onAdd={item => setReembolsos(prev => [...prev, item])}
            onRemove={i => setReembolsos(prev => prev.filter((_, idx) => idx !== i))}
          />
        </div>

        {/* Notas */}
        <div className="registrar-panel" style={{ marginTop: '0.25rem' }}>
          <div className="form-group full">
            <label>Notas</label>
            <textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Opcional: horas extra, material, pendiente..."
            />
          </div>
        </div>

        {/* Total ganado (sin mostrar el sueldo por dia) */}
        <div className="registrar-summary">
          <div>
            <div className="registrar-summary-label">
              {totalDias} dias
              {totalExtra > 0 && ` · +$${fmt(totalExtra)} extra`}
              {totalReembolso > 0 && ` · +$${fmt(totalReembolso)} reembolso`}
              {totalAnticipo > 0 && ` · -$${fmt(totalAnticipo)} anticipo`}
            </div>
            <div className="registrar-summary-title">Total ganado esta semana</div>
          </div>
          <div className="registrar-summary-amount">${fmt(totalGanado)}</div>
        </div>

        <button className="btn btn-primary registrar-submit" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar hoja de trabajo'}
        </button>
      </div>
    </div>
  );
}
