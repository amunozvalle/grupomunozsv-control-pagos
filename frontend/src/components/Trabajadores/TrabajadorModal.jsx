import React, { useState } from 'react';
import { createTrabajador, updateTrabajador } from '../../api';

export default function TrabajadorModal({ trabajador, ramas, onClose, onSaved }) {
  const isNew = !trabajador?.id;
  const [nombre, setNombre] = useState(trabajador?.nombre || '');
  const [rama, setRama] = useState(trabajador?.rama || ramas[0]?.id || '');
  const [sueldo, setSueldo] = useState(trabajador?.sueldo ? String(trabajador.sueldo) : '');
  const [telefono, setTelefono] = useState(trabajador?.telefono || '');
  const [activo, setActivo] = useState(trabajador?.activo !== undefined ? trabajador.activo : true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nombre.trim() || !rama) return alert('Nombre y especialidad requeridos.');
    setSaving(true);
    try {
      if (isNew) {
        await createTrabajador({ nombre, rama, sueldo: Number(sueldo) || 0, telefono, activo });
      } else {
        await updateTrabajador(trabajador.id, { nombre, rama, sueldo: Number(sueldo) || 0, telefono, activo });
      }
      onSaved();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay open">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isNew ? 'Nuevo Trabajador' : 'Editar Trabajador'}</div>
          <button className="btn btn-icon btn-outline" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group full">
              <label>Nombre Completo</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Juan García López"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Especialidad</label>
              <select value={rama} onChange={e => setRama(e.target.value)}>
                {ramas.map(r => (
                  <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Sueldo Semanal ($)</label>
              <input
                type="number"
                value={sueldo}
                onChange={e => setSueldo(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div className="form-group full">
              <label>Telefono WhatsApp</label>
              <input
                type="text"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="Ej. 14105551234"
              />
            </div>
            {!isNew && (
              <div className="form-group full">
                <label>Estado</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setActivo(true)}
                    style={{
                      flex: 1, padding: '0.55rem', borderRadius: 8, border: '1px solid',
                      cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s',
                      background: activo ? 'rgba(34,197,94,0.15)' : 'transparent',
                      borderColor: activo ? 'var(--green)' : 'var(--border)',
                      color: activo ? 'var(--green)' : 'var(--text-dim)',
                    }}
                  >● Activo</button>
                  <button
                    type="button"
                    onClick={() => setActivo(false)}
                    style={{
                      flex: 1, padding: '0.55rem', borderRadius: 8, border: '1px solid',
                      cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s',
                      background: !activo ? 'rgba(239,68,68,0.12)' : 'transparent',
                      borderColor: !activo ? 'var(--red)' : 'var(--border)',
                      color: !activo ? 'var(--red)' : 'var(--text-dim)',
                    }}
                  >○ Inactivo</button>
                </div>
              </div>
            )}
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
