const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    let message = await res.text();
    try {
      const parsed = JSON.parse(message);
      message = parsed.error || message;
    } catch {}
    const error = new Error(message || 'Request failed');
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export const getSession = () => req('GET', '/auth/session');
export const login = (data) => req('POST', '/auth/login', data);
export const logout = () => req('POST', '/auth/logout');
export const getAdminUsers = () => req('GET', '/admin-users');
export const createAdminUser = (data) => req('POST', '/admin-users', data);

export const getTrabajadores = () => req('GET', '/trabajadores');
export const createTrabajador = (data) => req('POST', '/trabajadores', data);
export const updateTrabajador = (id, data) => req('PUT', `/trabajadores/${id}`, data);
export const deleteTrabajador = (id) => req('DELETE', `/trabajadores/${id}`);

export const getRamas = () => req('GET', '/ramas');
export const createRama = (data) => req('POST', '/ramas', data);
export const deleteRama = (id) => req('DELETE', `/ramas/${id}`);

export const getRegistros = (semana) => req('GET', `/registros/${semana}`);
export const getRegistrosMes = (year, month) => req('GET', `/registros/mes/${year}/${month}`);
export const upsertRegistro = (semana, data) => req('POST', `/registros/${semana}`, data);
export const deleteRegistro = (semana, trabajadorId) => req('DELETE', `/registros/${semana}/${trabajadorId}`);

export const parseWhatsapp = (text, semana) => req('POST', '/whatsapp/parse', { text, semana });
export const applyWhatsapp = (semana, rows) => req('POST', '/whatsapp/apply', { semana, rows });

export const getCobros = () => req('GET', '/cobros');

export const getRegistrarLinks = (semana) => req('GET', `/registrar/links/${semana}`);
export const getRegistrarPayload = (token) => req('GET', `/registrar/${token}`);
export const saveRegistrarPayload = (token, data) => req('POST', `/registrar/${token}`, data);
