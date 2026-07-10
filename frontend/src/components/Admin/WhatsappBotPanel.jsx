import React, { useState, useEffect, useRef } from 'react';

export default function WhatsappBotPanel({ ramas }) {
  const [status, setStatus] = useState(null);
  const [chats, setChats] = useState([]);
  const [configurados, setConfigurados] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const pollRef = useRef(null);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/whatsapp/bot/status');
      const data = await res.json();
      setStatus(data);
      return data;
    } catch { return null; }
  }

  async function fetchGrupos() {
    try {
      const res = await fetch('/api/whatsapp/bot/grupos');
      const data = await res.json();
      setChats(data.chats || []);
      setConfigurados(data.configurados || {});
    } catch {}
  }

  useEffect(() => {
    fetchStatus();
    fetchGrupos();
  }, []);

  // Polling mientras espera QR o conexión
  useEffect(() => {
    if (!status) return;
    if (status.status === 'ready') { clearInterval(pollRef.current); return; }
    if (status.status === 'qr' || status.status === 'connecting') {
      clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const s = await fetchStatus();
        if (s?.status === 'ready') { clearInterval(pollRef.current); fetchGrupos(); }
      }, 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [status?.status]);

  async function iniciar() {
    setIniciando(true);
    await fetch('/api/whatsapp/bot/init', { method: 'POST' });
    setTimeout(fetchStatus, 2000);
    setIniciando(false);
  }

  async function desconectar() {
    await fetch('/api/whatsapp/bot/disconnect', { method: 'POST' });
    setStatus({ status: 'disconnected', hasQr: false, qr: null });
    setChats([]);
  }

  async function guardar() {
    setGuardando(true);
    await fetch('/api/whatsapp/bot/grupos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configurados }),
    });
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  }

  async function recargarGrupos() {
    await fetchGrupos();
  }

  function getSemanaInfo() {
    const now = new Date();
    const svDate = now.toLocaleDateString('sv-SE', { timeZone: 'America/El_Salvador' });
    const svDay = new Date(svDate + 'T12:00:00');
    const mon = new Date(svDay);
    mon.setDate(svDay.getDate() - ((svDay.getDay() + 6) % 7));
    const semanaKey = mon.toISOString().slice(0, 10);
    const semanaLabel = `${mon.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} - ${svDay.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}`;
    return { semanaKey, semanaLabel };
  }

  async function enviarRecordatorio() {
    const { semanaKey, semanaLabel } = getSemanaInfo();
    try {
      const res = await fetch('/api/whatsapp/bot/recordatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semanaKey, semanaLabel }),
      });
      const data = await res.json();
      const ok = data.resultados?.filter(r => r.ok).length || 0;
      const fail = data.resultados?.filter(r => !r.ok) || [];
      let msg = `✓ Enviado a ${ok} grupo(s).`;
      if (fail.length) msg += '\nFallidos: ' + fail.map(r => `${r.rama}: ${r.error}`).join(', ');
      alert(msg);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function enviarAGrupo(groupId, ramaLabel) {
    if (!groupId) { alert('Este grupo no tiene WhatsApp asignado.'); return; }
    const { semanaLabel } = getSemanaInfo();
    try {
      const res = await fetch('/api/whatsapp/bot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, message: `📋 *Recordatorio de Nómina — ${semanaLabel}*\nBuenos días a todos. Por favor recuerden llenar su hoja de trabajo del sábado antes de terminar el día.\n\nGracias 🙏` }),
      });
      const data = await res.json();
      if (data.ok) alert(`✓ Enviado a ${ramaLabel}`);
      else alert(`Error: ${data.error}`);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  const statusColor = { ready: 'var(--green)', qr: 'var(--gold)', connecting: 'var(--gold)', disconnected: 'var(--red)' };
  const statusLabel = { ready: '✓ Conectado', qr: '📱 Escanea el código QR', connecting: 'Conectando...', disconnected: '● Desconectado' };

  return (
    <div>
      {/* Estado */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.25rem' }}>Estado del Bot</div>
            <div style={{ color: statusColor[status?.status] || 'var(--text-dim)', fontWeight: 600 }}>
              {statusLabel[status?.status] || 'Cargando...'}
            </div>
          </div>
          {status?.status === 'disconnected' && (
            <button className="btn btn-primary" onClick={iniciar} disabled={iniciando}>
              {iniciando ? 'Iniciando...' : '▶ Conectar WhatsApp'}
            </button>
          )}
          {status?.status === 'ready' && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={enviarRecordatorio}>📨 Enviar recordatorio ahora</button>
              <button className="btn btn-outline" onClick={recargarGrupos}>↻ Recargar grupos</button>
              <button className="btn btn-outline" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={desconectar}>✕ Cerrar sesión</button>
            </div>
          )}
        </div>

        {/* QR Code */}
        {status?.status === 'qr' && status.qr && (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
              Escanea este código QR con WhatsApp en tu teléfono:
              <br /><small>Ajustes → Dispositivos vinculados → Vincular dispositivo</small>
            </div>
            <img src={status.qr} alt="QR WhatsApp" style={{ width: 220, height: 220, borderRadius: 8, background: 'white', padding: 8 }} />
          </div>
        )}

        {status?.status === 'connecting' && (
          <div style={{ color: 'var(--gold)', fontSize: '0.85rem' }}>Autenticando... esto puede tardar unos segundos.</div>
        )}
      </div>

      {/* Configurar grupos por rama */}
      {status?.status === 'ready' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem' }}>
            Asignar grupo de WhatsApp por rama
          </div>

          {chats.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              No se encontraron grupos. Asegúrate de estar en al menos un grupo de WhatsApp.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {ramas.map((rama) => (
              <div key={rama.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ minWidth: 140, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <span className="dot" style={{ background: rama.color }} />
                  {rama.emoji} {rama.label}
                </div>
                <select
                  className="form-input"
                  style={{ flex: 1 }}
                  value={configurados[rama.id] || ''}
                  onChange={(e) => setConfigurados({ ...configurados, [rama.id]: e.target.value })}
                >
                  <option value="">— Sin grupo asignado —</option>
                  {chats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  className="btn btn-outline btn-sm"
                  title={`Enviar recordatorio a ${rama.label}`}
                  onClick={() => enviarAGrupo(configurados[rama.id], rama.label)}
                >📨</button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            {guardado && <span style={{ color: 'var(--green)', fontSize: '0.8rem', alignSelf: 'center' }}>✓ Guardado</span>}
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
