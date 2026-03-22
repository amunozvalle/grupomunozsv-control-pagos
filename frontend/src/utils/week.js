export const DIAS_KEYS = ['L', 'M', 'X', 'J', 'V', 'S'];
export const DIAS_LABELS = { L: 'Lun', M: 'Mar', X: 'Mie', J: 'Jue', V: 'Vie', S: 'Sab' };

export function getSemanaKey(offset = 0) {
  const today = new Date();
  const dow = today.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff + offset * 7);
  // Use local date (not UTC) to avoid timezone shift after 6 PM in UTC-6
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatSemana(key) {
  const start = new Date(`${key}T12:00:00`);
  const end = new Date(`${key}T12:00:00`);
  end.setDate(end.getDate() + 5);
  const fmt = (d) => d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace('.', '');
  return `${fmt(start)} - ${fmt(end)}`;
}

export function formatSemanaWhatsapp(key) {
  const start = new Date(`${key}T12:00:00`);
  const end = new Date(`${key}T12:00:00`);
  end.setDate(end.getDate() + 5);
  const fmt = (d) => {
    const day = d.toLocaleDateString('es-MX', { day: '2-digit' });
    const month = d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
    return `${day}-${month}`;
  };
  return `${fmt(start)} - ${fmt(end)}`;
}

export function formatSemanaWhatsappNatural(key) {
  const start = new Date(`${key}T12:00:00`);
  const end = new Date(`${key}T12:00:00`);
  end.setDate(end.getDate() + 5);
  const fmt = (d) => {
    const day = d.toLocaleDateString('es-MX', { day: '2-digit' });
    const month = d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
    return `${day}-${month}`;
  };
  return `del ${fmt(start)} al ${fmt(end)}`;
}

export function fmt(n) {
  return Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function calcPago(trabajador, record) {
  if (!record) return 0;
  const dias = Object.values(record.dias || {}).reduce((s, v) => s + v, 0);
  const diario = (trabajador?.sueldo || 0) / 6;
  // Usar arrays si existen, si no usar campos legacy
  const extra = record.extras?.length
    ? record.extras.reduce((s, e) => s + e.monto, 0)
    : (record.extra || 0);
  const anticipo = record.anticipos?.length
    ? record.anticipos.reduce((s, a) => s + a.monto, 0)
    : (record.anticipo || 0);
  const reembolso = (record.reembolsos || []).reduce((s, r) => s + r.monto, 0);
  return dias * diario + extra + reembolso - anticipo;
}
