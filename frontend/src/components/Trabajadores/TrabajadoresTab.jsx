import React, { useState } from 'react';
import { fmt } from '../../utils/week';
import { deleteTrabajador } from '../../api';
import TrabajadorModal from './TrabajadorModal';

export default function TrabajadoresTab({ trabajadores, ramas, onRefresh }) {
  const [editando, setEditando] = useState(null); // null = closed, {} = new, {id,...} = edit
  const ramaMap = Object.fromEntries(ramas.map(r => [r.id, r]));

  const handleDelete = async (t) => {
    if (!confirm(`¿Eliminar a ${t.nombre}? Se eliminarán sus registros.`)) return;
    await deleteTrabajador(t.id);
    onRefresh();
  };

  return (
    <>
      <div className="section-header">
        <span className="section-title">Trabajadores</span>
        <button className="btn btn-primary" onClick={() => setEditando({})}>+ Nuevo Trabajador</button>
      </div>

      {trabajadores.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2rem' }}>👷</div>
          <p>No hay trabajadores registrados.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Especialidad</th>
                <th style={{ textAlign: 'right' }}>Sueldo Semanal</th>
                <th>WhatsApp</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trabajadores.map(t => {
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
                    <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--gold)' }}>
                      ${fmt(t.sueldo)}
                    </td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                      {t.telefono || 'Sin WhatsApp'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-icon btn-outline btn-sm" onClick={() => setEditando(t)}>✏️</button>
                        <button className="btn btn-icon btn-danger btn-sm" onClick={() => handleDelete(t)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando !== null && (
        <TrabajadorModal
          trabajador={editando}
          ramas={ramas}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); onRefresh(); }}
        />
      )}
    </>
  );
}
