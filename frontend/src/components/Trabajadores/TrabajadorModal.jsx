import React, { useState, useEffect } from 'react';
import { createTrabajador, updateTrabajador, getPermanentLink, PUBLIC_APP_URL } from '../../api';

export default function TrabajadorModal({ trabajador, ramas, onClose, onSaved }) {
  const isNew = !trabajador?.id;
  const [nombre, setNombre] = useState(trabajador?.nombre || '');
  const [rama, setRama] = useState(trabajador?.rama || ramas[0]?.id || '');
  const [sueldo, setSueldo] = useState(trabajador?.sueldo ? String(trabajador.sueldo) : '');
  const [telefono, setTelefono] = useState(trabajador?.telefono || '');
  const [activo, setActivo] = useState(trabajador?.activo !== undefined ? trabajador.activo : true);
  const [saving, setSaving] = useState(false);
  const [hojaUrl, setHojaUrl] = useState('');
  const [copiado, setCopiado] = useState('');

  useEffect(() => {
    let alive = true;
    if (!isNew && trabajador?.id) {
      getPermanentLink(trabajador.id)
        .then((data) => {
          if (!alive) return;
          const token = data.permanentToken;
          setHojaUrl(data.permanentUrl || `${PUBLIC_APP_URL}/registrar/${token}`);
        })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [isNew, trabajador?.id]);

  const mensajeWhatsapp = `Hola ${nombre || ''}, este es el enlace fijo de tu hoja de trabajo. Guárdalo (fíjalo) en tu WhatsApp y úsalo cada semana para registrar tus horas.\n\n${hojaUrl}\n\nLlénala y toca Guardar. ¡Gracias!`;

  async function copiar(etiqueta, texto) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(etiqueta);
      setTimeout(() => setCopiado(''), 1600);
    } catch {
      window.prompt('Copia el texto:', texto);
    }
  }

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
            {!isNew && (
              <div className="form-group full">
                <label>Enlace fijo de la hoja de trabajo</label>
                {hojaUrl ? (
                  <>
                    <div
                      className="mono"
                      style={{
                        background: 'var(--surface, rgba(255,255,255,0.04))',
                        border: '1px solid var(--border)', borderRadius: 8,
                        padding: '0.6rem 0.75rem', fontSize: '0.8rem',
                        wordBreak: 'break-all', color: 'var(--text-dim)', marginBottom: '0.5rem',
                      }}
                    >{hojaUrl}</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => copiar('link', hojaUrl)}>
                        {copiado === 'link' ? '✓ Copiado' : 'Copiar link'}
                      </button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => copiar('wa', mensajeWhatsapp)}>
                        {copiado === 'wa' ? '✓ Copiado' : 'Copiar mensaje WhatsApp'}
                      </button>
                      <a className="btn btn-outline btn-sm" href={hojaUrl} target="_blank" rel="noreferrer">Abrir hoja</a>
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: '0.4rem' }}>
                      Este enlace es fijo: el trabajador lo puede fijar en su WhatsApp y usarlo cada semana.
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Cargando enlace…</div>
                )}
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
