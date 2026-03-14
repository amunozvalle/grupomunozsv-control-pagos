import React, { useEffect, useState } from 'react';
import { getRegistrarLinks, PUBLIC_APP_URL } from '../../api';
import { formatSemana, formatSemanaWhatsappNatural } from '../../utils/week';

function getPublicTimesheetUrl(item) {
  return `${PUBLIC_APP_URL}/registrar/${item.permanentToken || item.token}`;
}

function buildWhatsappText(item) {
  return `Hola ${item.trabajador.nombre}, aqui esta tu hoja de trabajo semanal ${formatSemanaWhatsappNatural(item.semana)}.\n\n${getPublicTimesheetUrl(item)}\n\nPor favor llenala y toca Guardar.`;
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export default function CompartirModal({ semanaKey, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await getRegistrarLinks(semanaKey);
        if (active) setItems(data);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [semanaKey]);

  async function copyText(label, text) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1600);
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">Compartir Hojas de Trabajo</div>
          <button className="btn btn-icon btn-outline" onClick={onClose}>x</button>
        </div>

        <div className="modal-body">
          <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
            Usa el enlace fijo de cada trabajador para que puedan dejarlo pinned en su WhatsApp. La hoja actual corresponde a {formatSemana(semanaKey)}.
          </div>

          {loading ? (
            <div className="empty-state"><p>Cargando enlaces...</p></div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {items.map((item) => {
                const publicUrl = getPublicTimesheetUrl(item);
                const whatsappText = buildWhatsappText(item);
                const phone = normalizePhone(item.trabajador.telefono);
                const whatsappUrl = phone
                  ? `https://wa.me/${phone}?text=${encodeURIComponent(whatsappText)}`
                  : '';

                return (
                  <div key={item.trabajador.id} className="share-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.trabajador.nombre}</div>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                          {item.trabajador.telefono || 'Sin telefono guardado'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => copyText(item.trabajador.id, publicUrl)}>Copiar link</button>
                        <button className="btn btn-primary btn-sm" onClick={() => copyText(`${item.trabajador.id}-wa`, whatsappText)}>Copiar WhatsApp</button>
                        {whatsappUrl && (
                          <a className="btn btn-outline btn-sm" href={whatsappUrl} target="_blank" rel="noreferrer">
                            Abrir WhatsApp
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="share-message">
                      <div className="share-message-label">Enlace fijo de la hoja de trabajo</div>
                      <div className="share-link mono" style={{ marginTop: 0 }}>{publicUrl}</div>
                    </div>

                    <div className="share-message">
                      <div className="share-message-label">Mensaje listo para WhatsApp</div>
                      <div className="share-message-body">{whatsappText}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {copied && <span style={{ marginRight: 'auto', color: 'var(--green)', fontSize: '0.8rem' }}>Copiado.</span>}
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
