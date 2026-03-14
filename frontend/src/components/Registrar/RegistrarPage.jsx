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

export default function RegistrarPage() {
  const token = useMemo(() => getTokenFromPath(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [semana, setSemana] = useState('');
  const [trabajador, setTrabajador] = useState(null);
  const [dias, setDias] = useState({ L: 0, M: 0, X: 0, J: 0, V: 0, S: 0 });
  const [extra, setExtra] = useState('');
  const [anticipo, setAnticipo] = useState('');
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
        setExtra(data.record?.extra ? String(data.record.extra) : '');
        setAnticipo(data.record?.anticipo ? String(data.record.anticipo) : '');
        setNotas(data.record?.notas || '');
      } catch (err) {
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
  const preview = calcPago(
    trabajador,
    { dias, extra: Number(extra) || 0, anticipo: Number(anticipo) || 0 }
  );

  async function handleSave() {
    setSaving(true);
    setSuccess('');
    setError('');

    try {
      await saveRegistrarPayload(token, {
        dias,
        extra: Number(extra) || 0,
        anticipo: Number(anticipo) || 0,
        notas,
      });
      setSuccess('Tu hoja de trabajo semanal quedo guardada. La nomina ya se actualizo en el sistema.');
    } catch (err) {
      setError('No se pudo guardar la hoja de trabajo. Intenta de nuevo en unos segundos.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="registrar-shell"><div className="registrar-card">Cargando...</div></div>;
  }

  if (error && !trabajador) {
    return (
      <div className="registrar-shell">
        <div className="registrar-card">
          <div className="alert alert-danger">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="registrar-shell">
      <div className="registrar-card">
        <div className="registrar-eyebrow">Grupo Munoz</div>
        <h1 className="registrar-title">Hoja de trabajo semanal</h1>
        <p className="registrar-subtitle">
          {trabajador?.nombre} · {formatSemana(semana)}
        </p>

        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

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

          <div className="form-grid">
            <div className="form-group">
              <label>Pago extra ($)</label>
              <input type="number" min="0" step="0.01" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Anticipo ($)</label>
              <input type="number" min="0" step="0.01" value={anticipo} onChange={(e) => setAnticipo(e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group full">
              <label>Notas</label>
              <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional: horas extra, material, pendiente..." />
            </div>
          </div>
        </div>

        <div className="registrar-summary">
          <div>
            <div className="registrar-summary-label">{totalDias} dias registrados</div>
            <div className="registrar-summary-title">Total estimado</div>
          </div>
          <div className="registrar-summary-amount">${fmt(preview)}</div>
        </div>

        <button className="btn btn-primary registrar-submit" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar hoja de trabajo'}
        </button>
      </div>
    </div>
  );
}
