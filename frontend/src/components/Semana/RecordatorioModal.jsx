import React, { useState, useEffect } from 'react';
import { formatSemanaWhatsappNatural } from '../../utils/week';

export default function RecordatorioModal({ trabajadores, registros, semanaKey, onClose }) {
  const [copied, setCopied] = useState(false);
  const [botStatus, setBotStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const semanaLabel = formatSemanaWhatsappNatural(semanaKey);

  const lines = [];
  lines.push(`📋 *Recordatorio de nómina - semana ${semanaLabel}*`);
  lines.push('');
  lines.push('Buenos días a todos. Por favor recuerden llenar su hoja de trabajo del sábado antes de terminar el día.');
  lines.push('');
  lines.push('Gracias 🙏');
  const mensaje = lines.join('\n');

  useEffect(() => {
    fetch('/api/whatsapp/bot/status').then(r => r.json()).then(setBotStatus).catch(() => {});
  }, []);

  async function copiar() {
    await navigator.clipboard.writeText(mensaje);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function enviarBot() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/whatsapp/bot/recordatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semanaKey, semanaLabel }),
      });
      const data = await res.json();
      setSendResult(data);
    } catch {
      setSendResult({ ok: false, error: 'Error de red' });
    }
    setSending(false);
  }

  const botListo = botStatus?.status === 'ready';

  return (
    <div className="modal-overlay open">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">Recordatorio Sábado — WhatsApp</div>
          <button className="btn btn-icon btn-outline" onClick={onClose}>x</button>
        </div>

        <div className="modal-body">
          {botListo ? (
            <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
              🤖 Bot conectado — puedes enviar automáticamente a todos los grupos.
            </div>
          ) : (
            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
              Copia este mensaje y pégalo en tu grupo de WhatsApp. Para envío automático, configura el bot en la pestaña <strong>Admins → WhatsApp Bot</strong>.
            </div>
          )}

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text)', marginBottom: '1rem' }}>
            {mensaje}
          </div>

          {sendResult && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', fontSize: '0.82rem' }}>
              {sendResult.resultados?.map((r) => (
                <div key={r.rama} style={{ color: r.ok ? 'var(--green)' : 'var(--red)', marginBottom: '0.2rem' }}>
                  {r.ok ? '✓' : '✗'} {r.rama} {r.error ? `— ${r.error}` : ''}
                </div>
              ))}
              {sendResult.error && <div style={{ color: 'var(--red)' }}>✗ {sendResult.error}</div>}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {copied && <span style={{ marginRight: 'auto', color: 'var(--green)', fontSize: '0.8rem' }}>Copiado ✓</span>}
          <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          <button className="btn btn-outline" onClick={copiar}>{copied ? '✓ Copiado' : 'Copiar'}</button>
          {botListo && (
            <button className="btn btn-primary" onClick={enviarBot} disabled={sending}>
              {sending ? 'Enviando...' : '🤖 Enviar por bot'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
