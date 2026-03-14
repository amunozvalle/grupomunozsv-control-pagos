const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Trabajadores
export const getTrabajadores = () => req('GET', '/trabajadores');
export const createTrabajador = (data) => req('POST', '/trabajadores', data);
export const updateTrabajador = (id, data) => req('PUT', `/trabajadores/${id}`, data);
export const deleteTrabajador = (id) => req('DELETE', `/trabajadores/${id}`);

// Ramas
export const getRamas = () => req('GET', '/ramas');
export const createRama = (data) => req('POST', '/ramas', data);
export const deleteRama = (id) => req('DELETE', `/ramas/${id}`);

// Registros
export const getRegistros = (semana) => req('GET', `/registros/${semana}`);
export const upsertRegistro = (semana, data) => req('POST', `/registros/${semana}`, data);
export const deleteRegistro = (semana, trabajadorId) => req('DELETE', `/registros/${semana}/${trabajadorId}`);

// WhatsApp
export const parseWhatsapp = (text, semana) => req('POST', '/whatsapp/parse', { text, semana });
export const applyWhatsapp = (semana, rows) => req('POST', '/whatsapp/apply', { semana, rows });

// Timesheet publico
export const getRegistrarLinks = (semana) => req('GET', `/registrar/links/${semana}`);
export const getRegistrarPayload = (token) => req('GET', `/registrar/${token}`);
export const saveRegistrarPayload = (token, data) => req('POST', `/registrar/${token}`, data);
