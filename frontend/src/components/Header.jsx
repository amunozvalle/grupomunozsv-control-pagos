import React from 'react';

export default function Header({ onImportar, currentAdmin, onLogout }) {
  return (
    <header>
      <div className="logo">
        GRUPO MUNOZ<span>Control de Pagos</span>
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
        {onLogout && (
          <button className="btn btn-outline" onClick={onLogout}>
            Cerrar sesion
          </button>
        )}
      </div>
    </header>
  );
}
