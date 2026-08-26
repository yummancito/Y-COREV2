-- 0001_initial.sql
-- Esquema inicial de ycore_updates (roadmap C.3, ADR-0005). Tres tablas:
-- releases (catálogo de versiones publicadas), maintenance_log (auditoría
-- de encendido/apagado del modo mantenimiento) y check_stats (agregado sin
-- PII de cuántos clientes comprobaron qué). Nunca se edita una vez aplicada:
-- un cambio de esquema es una migración nueva numerada.

CREATE TABLE releases (
  version TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'win32',
  arch TEXT NOT NULL DEFAULT 'x64',
  r2_key TEXT NOT NULL,
  blockmap_key TEXT,
  size INTEGER NOT NULL,
  sha512 TEXT NOT NULL,
  blockmap_sha512 TEXT,
  estimated_delta_size INTEGER,
  notes_json TEXT NOT NULL,
  mandatory INTEGER NOT NULL DEFAULT 0,
  rollout INTEGER NOT NULL DEFAULT 100,
  published_at TEXT NOT NULL,
  yanked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_releases_channel_published ON releases (channel, published_at DESC);

CREATE TABLE maintenance_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enabled INTEGER NOT NULL,
  actor TEXT NOT NULL,
  note TEXT,
  at TEXT NOT NULL
);

CREATE TABLE check_stats (
  day TEXT NOT NULL,
  version TEXT NOT NULL,
  channel TEXT NOT NULL,
  outcome TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, version, channel, outcome)
);
