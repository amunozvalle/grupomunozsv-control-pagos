const crypto = require('crypto');

const SECRET = process.env.REGISTRAR_SECRET || 'grupomunoz-timesheet-secret';

function base64urlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64urlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function sign(payload) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function encodeToken(payload) {
  const encoded = base64urlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function createRegistrarToken(semana, trabajadorId) {
  return encodeToken({ type: 'weekly', semana, trabajadorId });
}

function createPermanentRegistrarToken(trabajadorId) {
  return encodeToken({ type: 'permanent', trabajadorId });
}

function verifyRegistrarToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new Error('Token invalido');
  }

  const [encoded, signature] = token.split('.');
  const expected = sign(encoded);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    provided.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(provided, expectedBuffer)
  ) {
    throw new Error('Token invalido');
  }

  const parsed = JSON.parse(base64urlDecode(encoded));
  if (!parsed?.trabajadorId) {
    throw new Error('Token invalido');
  }

  return parsed;
}

module.exports = {
  createRegistrarToken,
  createPermanentRegistrarToken,
  verifyRegistrarToken,
};
