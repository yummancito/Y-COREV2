-- 0003_manifest_key.sql
-- Cierra el hueco entre el ADR-0003 (exige verificar la firma Ed25519 del
-- manifest antes de instalar) y el esquema original de `releases`, que solo
-- guardaba sha512 suelto sin ningún manifest.json firmado que servir.
-- manifest_key es la clave R2 del manifest.json ya firmado por el pipeline
-- de CI (mismo patrón que r2_key/blockmap_key).
-- Nunca se edita una vez aplicada: un cambio de esquema es una migración nueva.

ALTER TABLE releases ADD COLUMN manifest_key TEXT NOT NULL DEFAULT '';
