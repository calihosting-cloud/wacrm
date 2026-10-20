---
name: pr-guidelines
description: >-
  Úsala al crear una rama, escribir un commit o abrir un pull request
  en wacrm. Incluye la plantilla de descripción en español, el checklist
  previo al merge y la regla de aprobación de Rodrigo para merges y
  despliegues a producción.
---

# Pull requests — wacrm

Diego DevOps mira CI y entorno. Ángela Calidad revisa el diff con
`code-review`. Mateo Seguridad entra si el diff toca auth, webhooks,
RLS, cifrado o dependencias. El merge y el despliegue a producción
los aprueba Rodrigo. Enrique Coordinador de Desarrollo asigna quién
abre el cambio.

## Rama

`CONTRIBUTING.md` no impone un prefijo. La regla que sí está escrita:

- Sal de `main` actualizado. No reutilices una rama ya mergeada.
- Un cambio lógico por PR.
- Nombre corto, en minúsculas, con guiones. Forma usada por el
  historial reciente: `feat/<asunto>` (ejemplo real de asunto en
  commits: `feat: AI Agents sidebar section`). Para docs o fixes,
  `docs/<asunto>` o `fix/<asunto>` es coherente con ese historial.
- `TODO: confirmar con Rodrigo` si este fork pasa a exigir un prefijo
  distinto del que ya usa el upstream.

No hagas push a `main`. En el despliegue recomendado (Hostinger,
README), un push a `main` construye y publica. Mergear es desplegar.

## Commits

Primera línea en imperativo, breve, en inglés (es el idioma de
`CONTRIBUTING.md` y del historial: `feat: …`, `Add script to …`).
El cuerpo dice el porqué. El diff muestra el qué.

Un commit no mezcla un refactor de formato con el cambio de
comportamiento. No reformatees el repo entero: CI no corre
`format:check` y el árbol tiene comillas mezcladas.

## Plantilla de descripción (español)

La plantilla del upstream (`.github/pull_request_template.md`) está en
inglés y se respeta. Además, rellena este bloque. Si abres el PR a
mano, puedes usarlo como cuerpo completo.

```markdown
## Resumen

<!-- Una o dos frases. Qué cambia para quien usa el CRM. -->

## Qué cambió

<!-- Lista de archivos o módulos. Una línea por pieza relevante. -->

- `ruta`: …

## Plan de prueba

- [ ] `npm run typecheck` limpio.
- [ ] `npm run lint` sin errores nuevos.
- [ ] `npm test` pasa.
- [ ] `npm run build` pasa, si el cambio afecta al bundle o a rutas.
- [ ] Probado a mano en el navegador, o por qué no aplica.
- [ ] Migración aplicada en un proyecto de Supabase de prueba, o no hay SQL.

## Riesgo y aprobación

- [ ] No hay secretos, teléfonos ni cuerpos de mensaje en el diff ni en los logs.
- [ ] Si hay dependencia nueva, está justificada aquí.
- [ ] Merge y despliegue a producción: pendiente de aprobación de Rodrigo.

## Relacionado

<!-- Issue, o "Sin issue". -->
```

No describas vulnerabilidades en el PR. El cauce está en
`.github/SECURITY.md` (aviso privado, no un issue público).

## Checklist antes del merge

1. CI verde en `.github/workflows/ci.yml`: lint, typecheck, test, build.
2. `npm run format` sobre los archivos tocados, sin reformateo masivo.
3. RLS y `requireRole` / scopes revisados si hay tabla o endpoint nuevo.
4. `docs/public-api.md` actualizado si cambia `/api/v1`.
5. `.env.local.example` actualizado si hay variable nueva, sin valores reales.
6. Tests colocalizados para lógica nueva de `src/lib` (skill `testing`).
7. Revisión de Ángela Calidad. Si el diff es de seguridad, también
   Mateo Seguridad.
8. Aprobación explícita de Rodrigo para el merge.
9. Aprobación explícita de Rodrigo para el despliegue a producción.
   En Hostinger eso coincide con entrar en `main`. No lances un
   deploy manual ni un “redeploy” del panel sin esa aprobación.

`.github/CODEOWNERS` pide revisión de `@ArnasDon` en el upstream.
Eso no sustituye la aprobación de Rodrigo en este equipo.

## Qué no entra en un PR de producto

- `.env`, `.env.local`, volcados de `whatsapp_config`, capturas con
  números de teléfono o texto de chats.
- Subidas de `node_modules`, `.next` o `coverage`.
- Cambios de versión de `next`, `react`, `react-dom` o `tailwindcss`
  mezclados con una feature (Dependabot los deja fuera a propósito).
