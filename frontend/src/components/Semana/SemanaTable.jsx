import React from 'react';
import { DIAS_KEYS, DIAS_LABELS, fmt, calcPago } from '../../utils/week';
import { deleteRegistro } from '../../api';

export default function SemanaTable({ trabajadores, ramas, recordMap, semanaKey, onEdit, onRefresh }) {
  const ramaMap = Object.fromEntries(ramas.map(r => [r.id, r]));

  const handleDelete = async (t) => {
    if (!confirm(`¿Eliminar registro de ${t.nombre}?`)) return;
    await deleteRegistro(semanaKey, t.id);
    onRefresh();
  };

  if (trabajadores.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '2rem' }}>👷</div>
        <p>No hay trabajadores en esta categoría.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Trabajador</th>
            <th>Rama</th>
            {DIAS_KEYS.map(d => <th key={d} style={{ textAlign: 'center' }}>{DIAS_LABELS[d]}</th>)}
            <th style={{ textAlign: 'right' }}>Días</th>
            <th style={{ textAlign: 'right' }}>Extra</th>
            <th style={{ textAlign: 'right' }}>Anticipo</th>
            <th style={{ textAlign: 'right' }}>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {trabajadores.map(t => {
            const rec = recordMap[t.id];
            const dias = rec?.dias || {};
            const totalDias = DIAS_KEYS.reduce((s, d) => s + (dias[d] || 0), 0);
            const pago = calcPago(t, rec);
            const rama = ramaMap[t.rama];

            return (
              <tr key={t.id}>
                <td style={{ fontWeight: 500 }}>{t.nombre}</td>
                <td>
                  {rama ? (
                    <span className="badge" style={{
                      background: rama.color + '22',
                      color: rama.color,
                      border: `1px solid ${rama.color}44`,
                    }}>
                      {rama.emoji} {rama.label}
                    </span>
                  ) : t.rama}
                </td>
                {DIAS_KEYS.map(d => {
                  const val = dias[d] || 0;
                  return (
                    <td key={d} style={{ textAlign: 'center' }}>
                      {val === 1 ? (
                        <span style={{ color: 'var(--green)', fontWeight: 700 }}>●</span>
                      ) : val === 0.5 ? (
                        <span style={{ color: 'var(--gold)', fontWeight: 700 }}>◐</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>○</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{totalDias}</td>
                <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: rec?.extra ? 'var(--green)' : 'var(--text-muted)' }}>
                  {rec?.extra ? `+$${fmt(rec.extra)}` : '—'}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: rec?.anticipo ? 'var(--red)' : 'var(--text-muted)' }}>
                  {rec?.anticipo ? `-$${fmt(rec.anticipo)}` : '—'}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--gold)', fontWeight: 600 }}>
                  ${fmt(pago)}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                    <button className="btn btn-icon btn-outline btn-sm" onClick={() => onEdit(t)} title="Editar">✏️</button>
                    {rec && (
                      <button className="btn btn-icon btn-danger btn-sm" onClick={() => handleDelete(t)} title="Eliminar">🗑</button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
