import React, { useState } from 'react';

export default function Header({ onImportar, currentAdmin, onLogout }) {
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
    <header>
      <div className="logo">
        <img src="/logo.png" alt="GRUPO MUÑOZ" className="logo-img" />
        <span>Control de Pagos</span>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        {currentAdmin && (
          <span className="admin-chip">
            Admin: {currentAdmin.displayName || currentAdmin.username}
          </span>
        )}
        <button className="btn btn-outline" onClick={onImportar}>
          Importar WhatsApp
        </button>
        <button
          className="btn btn-outline"
          onClick={handleBackup}
          disabled={backupStatus === 'saving'}
          title="Guardar copia de seguridad en GitHub"
        >
          {backupLabel}
        </button>
        {onLogout && (
          <button className="btn btn-outline" onClick={onLogout}>
            Cerrar sesion
          </button>
        )}
      </div>
    </header>
  );
}
