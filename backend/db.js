const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'pagos.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS ramas (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🔧',
    color TEXT NOT NULL DEFAULT '#888888'
  );

  CREATE TABLE IF NOT EXISTS trabajadores (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    rama TEXT NOT NULL,
    sueldo REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS registros (
    semana TEXT NOT NULL,
    trabajador_id TEXT NOT NULL,
    dias TEXT NOT NULL DEFAULT '{}',
    extra REAL DEFAULT 0,
    anticipo REAL DEFAULT 0,
    notas TEXT DEFAULT '',
    PRIMARY KEY (semana, trabajador_id),
    FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id) ON DELETE CASCADE
  );
`);

// Seed default branches if empty
const ramasCount = db.prepare('SELECT COUNT(*) as c FROM ramas').get();
if (ramasCount.c === 0) {
  const insert = db.prepare('INSERT INTO ramas (id, label, emoji, color) VALUES (?, ?, ?, ?)');
  insert.run('carpintero', 'Carpintero', '🪚', '#c97b3a');
  insert.run('albanil', 'Albañil', '🧱', '#7b9bc9');
  insert.run('tablaroca', 'Tabla Roca', '📦', '#9b7bc9');
  insert.run('vidrieria', 'Vidriería', '🪟', '#5cb8b2');
}

module.exports = db;
