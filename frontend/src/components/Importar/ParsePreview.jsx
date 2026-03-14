import React from 'react';
import { DIAS_KEYS, DIAS_LABELS, fmt } from '../../utils/week';

function DayBadges({ dias }) {
  return (
    <div style={{ display: 'flex', gap: '0.2rem' }}>
      {DIAS_KEYS.map(d => {
        const val = dias?.[d];
        const cls = val === 1 ? 'full' : val === 0.5 ? 'half' : 'absent';
        return (
          <span key={d} className={`day-badge ${cls}`} title={DIAS_LABELS[d]}>
            {val === 1 ? DIAS_LABELS[d] : val === 0.5 ? '½' : DIAS_LABELS[d].charAt(0)}
          </span>
        );
      })}
    </div>
  );
}

function ConfPill({ confidence }) {
  const pct = Math.round(confidence * 100);
  const cls = pct >= 85 ? 'conf-high' : pct >= 65 ? 'conf-mid' : 'conf-low';
  return <span className={`conf-pill ${cls}`}>{pct}%</span>;
}

export default function ParsePreview({ rows, onToggle, selected }) {
  const valid = rows.filter(r => !r.error);
  const errors = rows.filter(r => r.error);

  return (
    <div>
      {valid.length > 0 && (
        <>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
            {valid.length} registro(s) listos para importar
          </div>
          {valid.map((row, i) => {
            const isSelected = selected.has(row.lineIndex);
            const hasConflict = row.hasExisting;

            return (
              <div
                key={i}
                className={`parse-row ${hasConflict ? 'warning' : 'success'}`}
                style={{ cursor: 'pointer', opacity: isSelected ? 1 : 0.45 }}
                onClick={() => onToggle(row.lineIndex)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(row.lineIndex)}
                    onClick={e => e.stopPropagation()}
                    style={{ accentColor: 'var(--gold)', cursor: 'pointer' }}
                  />
                  <strong style={{ color: 'var(--text)' }}>{row.worker.nombre}</strong>
                  <ConfPill confidence={row.confidence} />
                  {hasConflict && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--gold)', background: 'var(--gold-dim)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      ⚠ sobreescribirá datos existentes
                    </span>
                  )}
                  {row.diasSource === 'natural' && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--blue)' }}>lenguaje natural</span>
                  )}
                  {row.diasSource === 'total' && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>días totales</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <DayBadges dias={row.dias} />
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    {row.totalDias} días
                  </span>
                  {row.extra !== null && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--green)' }}>+${fmt(row.extra)} extra</span>
                  )}
                  {row.anticipo !== null && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--red)' }}>-${fmt(row.anticipo)} anticipo</span>
                  )}
                  {row.notas && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>"{row.notas}"</span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  → "{row.rawLine}"
                </div>
              </div>
            );
          })}
        </>
      )}

      {errors.length > 0 && (
        <>
          <div style={{ fontSize: '0.78rem', color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0.8rem 0 0.5rem' }}>
            {errors.length} línea(s) con error
          </div>
          {errors.map((row, i) => (
            <div key={i} className="parse-row error">
              <div style={{ color: 'var(--red)', fontSize: '0.83rem' }}>⚠ {row.error}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>→ "{row.rawLine}"</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
