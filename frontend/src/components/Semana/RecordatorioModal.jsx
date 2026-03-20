import React, { useState } from 'react';
import { fmt, calcPago, DIAS_KEYS, formatSemanaWhatsappNatural } from '../../utils/week';

export default function RecordatorioModal({ trabajadores, registros, semanaKey, onClose }) {
  const [copied, setCopied] = useState(false);

  const recordMap = Object.fromEntries(registros.map((r) => [r.trabajador_id, r]));

  const sinRegistro = trabajadores.filter((t) => {
    const rec = recordMap[t.id];
    if (!rec) return true;
    const dias = DIAS_KEYS.reduce((s, d) => s + (rec.dias?.[d] || 0), 0);
    return dias === 0;
  });

  const conAnticipo = trabajadores
    .filter((t) => {
      const rec = recordMap[t.id];
      return rec && (rec.anticipo || 0) > 0;
    })
    .map((t) => ({ ...t, anticipo: recordMap[t.id].anticipo }));

  const semanaLabel = formatSemanaWhatsappNatural(semanaKey);

  const lines = [];
  lines.push(`📋 *Recordatorio de nómina - semana ${semanaLabel}*`);
  lines.push('');
  lines.push('Buenos días a todos. Por favor recuerden llenar su hoja de trabajo del sábado antes de terminar el día.');
  lines.push('');

  if (sinRegistro.length > 0) {
    lines.push('⚠️ *Sin días registrados esta semana:*');
    sinRegistro.forEach((t) => lines.push(`  • ${t.nombre}`));
    lines.push('');
  }

  if (conAnticipo.length > 0) {
    lines.push('💰 *Con adelanto pendiente:*');
    conAnticipo.forEach((t) => lines.push(`  • ${t.nombre} (-$${fmt(t.anticipo)})`));
    lines.push('');
  }

  lines.push('Gracias 🙏');

  const mensaje = lines.join('\n');

  async function copiar() {
    await navigator.clipboard.writeText(mensaje);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">Recordatorio Sábado — WhatsApp</div>
          <button className="btn btn-icon btn-outline" onClick={onClose}>x</button>
        </div>

        <div className="modal-body">
          <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
            Copia este mensaje y pégalo en tu grupo de WhatsApp.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', fontSize: '0.82rem' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ color: 'var(--text-dim)', marginBottom: '0.35rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sin registro ({sinRegistro.length})</div>
              {sinRegistro.length === 0
                ? <span style={{ color: 'var(--green)' }}>Todos tienen registro ✓</span>
                : sinRegistro.map((t) => <div key={t.id} style={{ color: 'var(--red)' }}>• {t.nombre}</div>)
              }
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ color: 'var(--text-dim)', marginBottom: '0.35rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Con adelanto ({conAnticipo.length})</div>
              {conAnticipo.length === 0
                ? <span style={{ color: 'var(--green)' }}>Sin adelantos ✓</span>
                : conAnticipo.map((t) => <div key={t.id} style={{ color: 'var(--gold)' }}>• {t.nombre} <span style={{ color: 'var(--red)' }}>-${fmt(t.anticipo)}</span></div>)
              }
            </div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text)' }}>
            {mensaje}
          </div>
        </div>

        <div className="modal-footer">
          {copied && <span style={{ marginRight: 'auto', color: 'var(--green)', fontSize: '0.8rem' }}>Copiado al portapapeles ✓</span>}
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={copiar}>
            {copied ? '✓ Copiado' : 'Copiar mensaje'}
          </button>
        </div>
      </div>
    </div>
  );
}
