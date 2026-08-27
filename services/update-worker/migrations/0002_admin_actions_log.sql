-- 0002_admin_actions_log.sql
-- Auditoría genérica para las operaciones admin que no tenían tabla propia:
-- yank, rollout y block (ADR-0005, punto 5: "la CLI sirve para rollout, yank,
-- block, maintenance y stats"). maintenance ya tiene su propia
-- maintenance_log desde 0001; esta tabla cubre las otras tres para no crear
-- tres tablas casi idénticas de una sola columna de detalle.
-- Nunca se edita una vez aplicada: un cambio de esquema es una migración nueva.

CREATE TABLE admin_actions_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  version TEXT,
  channel TEXT,
  actor TEXT NOT NULL,
  detail TEXT,
  at TEXT NOT NULL
);

CREATE INDEX idx_admin_actions_log_action_at ON admin_actions_log (action, at DESC);
