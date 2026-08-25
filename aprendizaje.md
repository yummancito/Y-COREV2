# Aprendizaje — Y-CORE V2

Registro de errores detectados y resueltos durante el desarrollo. Cada entrada se añade en
cuanto el error se resuelve, no después. Ver la regla correspondiente en `.claude/CLAUDE.md`.

Formato de cada entrada:

```markdown
## AAAA-MM-DD — Título corto del problema

**Contexto:** qué se estaba haciendo.
**Error:** qué falló exactamente.
**Causa:** por qué falló, la razón de fondo, no el síntoma.
**Solución:** qué se hizo para arreglarlo.
**Cómo evitarlo:** qué regla o comprobación evita que vuelva a pasar.
```

Si un error se repite, la entrada existente no era lo bastante clara o no generó una
comprobación automática — se revisa la entrada, no solo el error.

---

## 2026-08-25 — El v1 (Y-CORE) acumuló ~90 `.md` contradictorios en la raíz

**Contexto:** al mapear `../Y-CORE` como referencia para portar algoritmos (parsers ACF/VDF,
detección de DRM) antes de tocar Y-CORE V2.

**Error:** la raíz de `Y-CORE` tiene decenas de archivos `.md` de auditoría, changelog y
resúmenes de implementación (`ARCHITECTURE_COMPLETE.md`, `FIXES_APPLIED.md`,
`DRM_REMOVER_PHASE4_*.md`, etc.) que se contradicen entre sí según la fecha en que se escribieron.

**Causa:** no había una regla que impidiera crear `.md` en la raíz, así que cada sesión de
trabajo dejó su propio informe suelto en vez de actualizar un documento vivo en `docs/`.

**Solución:** Y-CORE V2 prohíbe `.md` en la raíz salvo la allowlist (README, CONTRIBUTING,
LICENSE, SECURITY, CHANGELOG) — ver regla R2 en `.claude/CLAUDE.md`, verificada por
`tools/scripts/check-file-rules.mjs`.

**Cómo evitarlo:** el checker `check-file-rules.mjs` bloquea (`exit 2`) cualquier intento de
escribir un `.md` fuera de esa allowlist en la raíz. Los informes de auditoría se abren como
issue, nunca como archivo.

---

## 2026-08-25 — `pnpm-workspace.yaml` tenía `allowBuilds` a medio configurar

**Contexto:** al añadir `apps/web-landing` (Astro) e instalar dependencias con `pnpm install`,
necesarias para compilar y verificar el sitio.

**Error:** `pnpm install` terminaba con `[ERR_PNPM_IGNORED_BUILDS]` para `esbuild` y `sharp`
(dependencias nativas de Astro/Vite) y pedía correr `pnpm approve-builds`, que es interactivo
y no se puede automatizar desde un agente.

**Causa:** `pnpm-workspace.yaml` ya tenía una sección `allowBuilds` con los placeholders
literales `esbuild: set this to true or false` / `sharp: set this to true or false` sin
completar — quedó a medias de una sesión anterior.

**Solución:** completar `allowBuilds` con `esbuild: true` / `sharp: true` en
`pnpm-workspace.yaml`. (El intento inicial de arreglarlo con `pnpm.onlyBuiltDependencies` en
`package.json` no sirvió: pnpm 11 movió esa opción a `pnpm-workspace.yaml` y avisa con un
`[WARN]` si la encuentra en el sitio viejo.)

**Cómo evitarlo:** no dejar configuración a medias en archivos versionados — un placeholder
sin rellenar en `pnpm-workspace.yaml` bloquea el install de cualquiera que clone el repo.
