---
name: nuevo-adr
description: Crea el siguiente ADR numerado en docs/adr/ desde la plantilla y lo enlaza en el índice. Úsalo antes de tomar cualquier decisión de arquitectura — dependencia nueva, cambio de frontera, elección entre enfoques.
---

# Escribir un ADR

Un ADR (Architecture Decision Record) documenta **por qué** se decidió algo, no cómo se
implementó. En el v1 había ~90 `.md` contradictorios en la raíz porque nadie sabía cuál
seguía vigente. Aquí un ADR aceptado es **inmutable**.

## 1. Comprueba que hace falta

Necesita ADR si: introduce una dependencia, cambia una frontera del monorepo, elige entre
enfoques no obvios, o alguien podría preguntar en 6 meses "¿por qué está hecho así?".

No necesita ADR una feature rutinaria que sigue el molde existente.

## 2. Busca el siguiente número libre

Mira `docs/adr/`. Si el último es `0007-*.md`, el tuyo es `0008-`.
Nombre: `NNNN-titulo-corto-en-kebab.md`.

## 3. Escribe desde la plantilla

Copia `docs/adr/0000-template.md` y rellena **todas** las secciones. Las dos que la gente
se salta y son las importantes:

- **Alternativas descartadas** — con el motivo real de cada una. Si no descartaste nada,
  no estabas decidiendo.
- **Cómo se verifica que se cumple** — el comando de lint o test que impide que la
  decisión se erosione. **Un ADR sin checker es papel mojado.** Si no se te ocurre uno,
  probablemente la decisión no es verificable y hay que replantearla.

Restricciones que condicionan toda decisión aquí: presupuesto 0 €, Windows-only,
closed-source, cero deuda técnica por encima de velocidad.

## 4. Enlázalo

Añádelo al índice en `docs/README.md`.

## 5. Si reemplaza a otro ADR

Marca el viejo como `Estado: Reemplazado por ADR-NNNN` y añade una línea explicando
qué cambió. **No edites su contenido** — el histórico es el valor.
