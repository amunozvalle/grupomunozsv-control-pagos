import React, { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onLogin({ username, password });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesion');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-eyebrow">GRUPO MUNOZ</div>
        <h1 className="auth-title">Control de Pagos</h1>
        <p className="auth-subtitle">
          Ingresa con tu usuario admin para acceder al panel de nomina.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Usuario</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="alfonso"
            />
          </div>

          <div className="form-group">
            <label>Contrasena</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Tu contrasena"
            />
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <button className="btn btn-primary auth-submit" type="submit" disabled={saving}>
            {saving ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
