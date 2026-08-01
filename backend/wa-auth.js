/**
 * Auth state duradero para Baileys.
 *
 * Guarda TODA la sesion (creds + llaves signal) en UN solo archivo JSON,
 * y permite restaurarla desde la variable de entorno WA_SESSION (base64).
 *
 * Motivo: el hosting usa almacenamiento efimero -> en cada deploy se borra
 * el filesystem. Con WA_SESSION (que sobrevive a los deploys) la sesion se
 * restaura al arrancar y NO hay que volver a escanear el QR.
 */
const fs = require('fs');
const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');

async function useDurableAuthState(filePath, { envVarName = 'WA_SESSION', ignoreEnv = false } = {}) {
  let data = { creds: initAuthCreds(), keys: {} };

  const tryParse = (raw) => JSON.parse(raw, BufferJSON.reviver);

  // 1. Preferir archivo local (estado en runtime)
  if (fs.existsSync(filePath)) {
    try {
      data = tryParse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.log('[whatsapp] archivo de sesion corrupto, ignorando:', e.message);
    }
  } else if (!ignoreEnv && process.env[envVarName]) {
    // 2. Restaurar desde variable de entorno (sobrevive a deploys)
    try {
      const decoded = Buffer.from(process.env[envVarName], 'base64').toString('utf8');
      data = tryParse(decoded);
      fs.writeFileSync(filePath, JSON.stringify(data, BufferJSON.replacer, 2));
      console.log('[whatsapp] Sesion restaurada desde ' + envVarName + ' (sin QR)');
    } catch (e) {
      console.log('[whatsapp] ' + envVarName + ' invalida:', e.message);
    }
  } else if (ignoreEnv) {
    console.log('[whatsapp] Forzando sesion nueva (ignorando ' + envVarName + ')');
  }

  const write = () => {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, BufferJSON.replacer, 2));
    } catch (e) {
      console.log('[whatsapp] error guardando sesion:', e.message);
    }
  };

  return {
    state: {
      creds: data.creds,
      keys: {
        get: (type, ids) => {
          const store = data.keys[type] || {};
          return ids.reduce((dict, id) => {
            let value = store[id];
            if (value) {
              if (type === 'app-state-sync-key') {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              dict[id] = value;
            }
            return dict;
          }, {});
        },
        set: (dataToSet) => {
          for (const type in dataToSet) {
            data.keys[type] = data.keys[type] || {};
            for (const id in dataToSet[type]) {
              const value = dataToSet[type][id];
              if (value) data.keys[type][id] = value;
              else delete data.keys[type][id];
            }
          }
          write();
        },
      },
    },
    saveCreds: () => write(),
    // Exporta la sesion como base64 para pegar en la env var WA_SESSION
    exportBase64: () => Buffer.from(JSON.stringify(data, BufferJSON.replacer)).toString('base64'),
    // Borra la sesion (logout / reset)
    clear: () => {
      data = { creds: initAuthCreds(), keys: {} };
      try { fs.rmSync(filePath, { force: true }); } catch (_) {}
    },
  };
}

module.exports = { useDurableAuthState };
