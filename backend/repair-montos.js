// Reparación única de "montos entregados" perdidos/corrompidos.
//
// Contexto: el guardado de montos vivía solo en el navegador y una condición
// de carrera (25-jul-2026) borró y duplicó datos. Estos valores se recuperaron
// de los PDF de nómina impresos en su momento, que son la fuente confiable.
//
// Corre una sola vez: deja una marca en la base para no repetirse.
// No pisa nada a ciegas — solo actúa si el período está vacío o si tiene
// exactamente el valor corrupto conocido. La versión anterior siempre queda
// en el historial (/api/montos/historial) por si hay que revertir.

const db = require('./store');

const MARCA = 'repair_montos_2026_08_v1';

// Fuente: PDF "Nómina Semana 29-jun - 04-jul 2026" — total entregado $2,970.00
// El servidor tenía $3,423.15 aquí, que en realidad pertenece a la semana 06-jul.
const SEMANA_29_JUN = [
  { label: '', monto: 2000 },
  { label: '', monto: 500 },
  { label: '', monto: 470 },
];

// Fuente: PDF "Nómina Semana 20-jul - 25-jul 2026" — total entregado $4,520.00
const SEMANA_20_JUL = [
  { label: 'ALEX', monto: 1470 },
  { label: 'ALEX', monto: 400 },
  { label: 'LACHO', monto: 2000 },
  { label: 'ANDREW PUERTAS EL CALVARIO', monto: 650 },
];

function total(lista) {
  return lista.reduce((s, m) => s + (Number(m.monto) || 0), 0);
}

function repararMontos() {
  try {
    if (db.getFlag && db.getFlag(MARCA)) return; // ya corrió

    const hechos = [];

    // 1) 29-jun: corregir el duplicado de $3,423.15
    const actual29 = db.getMontosPeriodo('semana_2026-06-29') || [];
    const t29 = total(actual29);
    const corrupto = Math.abs(t29 - 3423.15) < 0.01;
    if (actual29.length === 0 || corrupto) {
      db.setMontosPeriodo('semana_2026-06-29', SEMANA_29_JUN);
      hechos.push(`29-jun corregido a $2,970.00 (antes $${t29.toFixed(2)})`);
    }

    // 2) 20-jul: restaurar lo que se había perdido
    const actual20 = db.getMontosPeriodo('semana_2026-07-20') || [];
    if (total(actual20) === 0) {
      db.setMontosPeriodo('semana_2026-07-20', SEMANA_20_JUL);
      hechos.push('20-jul restaurado: $4,520.00 con sus 4 descripciones');
    }

    if (db.setFlag) db.setFlag(MARCA, new Date().toISOString());

    if (hechos.length) {
      console.log('[repair-montos] ' + hechos.join(' | '));
    } else {
      console.log('[repair-montos] nada que reparar');
    }
  } catch (e) {
    console.error('[repair-montos] error (no bloquea el arranque):', e.message);
  }
}

module.exports = { repararMontos };
