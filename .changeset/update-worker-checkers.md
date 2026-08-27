---
"@ycore/update-worker": patch
---

Añade los dos checkers que el ADR-0005 exigía y que habían quedado pendientes:
`pnpm check:worker-routes` (garantiza un único `export default { fetch }` en
`services/update-worker`, sin `addEventListener('fetch')` sueltos) y
`pnpm check:no-private-key` (bloquea cualquier `PRIVATE_KEY`/`SIGNING_KEY` bajo
`services/` o en `wrangler.jsonc`). Ambos corren en `pnpm check:all` y el segundo
también en el hook de pre-commit vía `check-staged.mjs`. `check-docs.mjs` ahora también
exige `docs/03-services/<servicio>/README.md` para cada carpeta de `services/*`, igual
que ya hacía con `docs/02-features/`.
