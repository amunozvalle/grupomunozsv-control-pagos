import React, { useEffect, useState } from 'react';
import { createAdminUser, getAdminUsers } from '../../api';
import WhatsappBotPanel from './WhatsappBotPanel';

export default function AdminsTab({ ramas = [] }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      setAdmins(await getAdminUsers());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const created = await createAdminUser({ username, password });
      setMessage(`Admin creado: ${created.displayName}`);
      setUsername('');
      setPassword('');
      await loadAdmins();
    } catch (err) {
      setError(err.message || 'No se pudo crear el admin');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-grid">
      <section className="admin-panel">
        <div className="section-header">
          <span className="section-title">Admins</span>
        </div>
        {loading ? (
          <div className="empty-state"><p>Cargando admins...</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Creado por</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.username}>
                    <td style={{ fontWeight: 600 }}>{admin.displayName}</td>
                    <td>{admin.createdBy || 'admin'}</td>
                    <td>{new Date(admin.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="section-header">
          <span className="section-title">Nuevo Admin</span>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Usuario</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="gerencia"
            />
          </div>
          <div className="form-group">
            <label>Contrasena</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimo 8 caracteres"
            />
          </div>
          {message && <div className="alert alert-success">{message}</div>}
          {error && <div className="alert alert-danger">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Crear admin'}
          </button>
        </form>
      </section>
    </div>

    <div style={{ marginTop: '2rem' }}>
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <span className="section-title">WhatsApp Bot</span>
      </div>
      <WhatsappBotPanel ramas={ramas} />
    </div>
  );
}
