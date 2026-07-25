import React, { useState } from 'react';

export default function Topbar({ title, onImportar, onMenu }) {
  const [backupStatus, setBackupStatus] = useState('idle'); // idle | saving | ok | error

  const handleBackup = async () => {
    setBackupStatus('saving');
    try {
      const res = await fetch('/api/backup-github', { method: 'POST' });
      const data = await res.json();
      setBackupStatus(data.ok ? 'ok' : 'error');
    } catch {
      setBackupStatus('error');
    }
    setTimeout(() => setBackupStatus('idle'), 3000);
  };

  const backupLabel = { idle: '☁️ Backup', saving: '⏳ Guardando...', ok: '✅ Guardado', error: '❌ Error' }[backupStatus];

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="menu-btn" onClick={onMenu} aria-label="Abrir menú">☰</button>
        <h1 className="page-title">{title}</h1>
      </div>
      <div className="topbar-actions">
        <button className="btn btn-outline btn-sm" onClick={onImportar}>Importar WhatsApp</button>
        <button
          className="btn btn-outline btn-sm"
          onClick={handleBackup}
          disabled={backupStatus === 'saving'}
          title="Guardar copia de seguridad en GitHub"
        >
          {backupLabel}
        </button>
      </div>
    </div>
  );
}
