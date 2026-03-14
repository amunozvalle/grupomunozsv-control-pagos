import React from 'react';

export default function Header({ onImportar }) {
  return (
    <header>
      <div className="logo">
        GRUPO MUÑOZ<span>Control de Pagos</span>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button className="btn btn-outline" onClick={onImportar}>
          Importar WhatsApp
        </button>
      </div>
    </header>
  );
}
