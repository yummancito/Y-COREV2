# Registro de excepciones

Toda desviación de las reglas de `.claude/CLAUDE.md` se anota aquí, con su motivo y
su fecha. **Que esta lista sea corta es una métrica de salud del proyecto.**

Formato: qué regla, dónde, por qué, y qué haría falta para eliminarla.

---

## Excepciones a reglas de lint

*(ninguna — no hay ningún `eslint-disable` en el repo)*

---

## Desviaciones de herramientas

### Hooks de git nativos en vez de lefthook

- **Fecha**: 2026-08-03
- **Dónde**: `.githooks/`, `package.json` → script `prepare`
- **Regla afectada**: ninguna regla de código; es una decisión de tooling.

**Por qué**: `lefthook` distribuye su funcionalidad como un binario nativo
(`lefthook.exe`, 14 MB, sin firmar). En la máquina de desarrollo, **Windows App Control
bloquea su ejecución**:

```
Error al ejecutar el programa 'lefthook.exe':
Una directiva de Control de aplicaciones bloqueó este archivo
```

No es un fallo de configuración: es la política de la máquina rechazando binarios sin
firma. El mismo tipo de bloqueo que sufre el instalador de Y-CORE con Defender y que
motiva el [ADR-0005](adr/0005-firma-ed25519-sin-certificado.md).

**Qué hacemos en su lugar**: hooks `sh` en `.githooks/`, activados con
`git config core.hooksPath .githooks` desde el script `prepare`. Llaman a los mismos
checkers de `tools/scripts/`, así que la protección es idéntica.

**Ventaja secundaria**: una dependencia menos y cero binarios en el árbol de instalación.

**Para eliminarla**: haría falta que lefthook publicase binarios firmados, o que la
política de App Control de la máquina los permitiese. Dado que los hooks `sh` cumplen
igual y sin dependencias, **probablemente no merezca la pena revertirlo**.
