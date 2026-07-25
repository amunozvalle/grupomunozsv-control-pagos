import React from 'react';

const NAV = [
  {
    group: 'Nómina',
    items: [
      { id: 'semana', label: 'Semana', icon: '📆' },
      { id: 'trabajadores', label: 'Trabajadores', icon: '👷' },
      { id: 'cobros', label: 'Cobros', icon: '💵' },
    ],
  },
  {
    group: 'Reportes',
    items: [
      { id: 'reporte', label: 'Reporte', icon: '📊' },
      { id: 'anual', label: 'Anual', icon: '📅' },
    ],
  },
  {
    group: 'Sistema',
    items: [
      { id: 'whatsapp', label: 'WhatsApp Bot', icon: '🤖' },
      { id: 'admins', label: 'Admins', icon: '⚙️' },
    ],
  },
];

export default function Sidebar({ activeTab, setActiveTab, currentAdmin, onLogout, open, onClose }) {
  const nombre = currentAdmin?.displayName || currentAdmin?.username || 'Admin';
  const inicial = nombre.charAt(0).toUpperCase();

  const ir = (id) => {
    setActiveTab(id);
    if (onClose) onClose();
  };

  return (
    <>
      <div className={`sidebar-overlay${open ? ' show' : ''}`} onClick={onClose} />
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="side-brand">
          <img src="/logo.png" alt="Grupo Muñoz" className="side-logo" />
          <div className="side-brand-sub">Control de Pagos</div>
        </div>

        <nav className="side-nav">
          {NAV.map((g) => (
            <div key={g.group} className="nav-group">
              <div className="nav-group-label">{g.group}</div>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  className={`nav-item${activeTab === it.id ? ' active' : ''}`}
                  onClick={() => ir(it.id)}
                >
                  <span className="nav-ic">{it.icon}</span>
                  {it.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="side-user">
          <div className="side-avatar">{inicial}</div>
          <div className="side-user-info">
            <div className="side-user-name">{nombre}</div>
            <button className="side-logout" onClick={onLogout}>Cerrar sesión</button>
          </div>
        </div>
      </aside>
    </>
  );
}
