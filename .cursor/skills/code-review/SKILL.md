---
name: code-review
description: >-
  Úsala cuando Ángela Calidad revisa un diff de wacrm, o cuando alguien
  pide una revisión de código antes del merge. Checklist de corrección,
  casos límite, errores, tests, estilo, rendimiento y contratos, con
  veredicto approve o request-changes.
---

# Revisión de código — Ángela Calidad

Ángela Calidad es la dueña de esta skill. Enrique Coordinador de
Desarrollo le pasa el PR cuando el diff está listo para lectura.
Mateo Seguridad no sustituye esta pasada: si el cambio toca auth,
webhooks, RLS o cifrado, se suman las dos.

Lee el diff completo y los archivos vecinos que el diff llama
(`requireRole`, `RATE_LIMITS`, el módulo de `src/lib` que la ruta
usa). No apruebes solo por el resumen del autor.

## Checklist

### Corrección

- El cambio hace lo que el PR dice, en el camino de datos real
  (cliente de sesión con RLS, o `supabaseAdmin` si el comentario del
  módulo justifica saltársela).
- Roles: se usa un predicado de `src/lib/auth/roles.ts` o
  `requireRole`. Un `if (role === "admin")` nuevo es un hallazgo.
- Scopes de `/api/v1`: el endpoint declara un `ApiScope` existente y
  `hasScope`. El envelope es el de `src/lib/api/v1/respond.ts`.
- Multi-cuenta: las queries filtran por `account_id` (o RLS lo hace).
  Un `select` sin ese alcance, usando service role, es sospechoso.
- WhatsApp: texto libre solo dentro de la ventana de 24 h; fuera,
  plantilla. Teléfonos pasan por `sanitizePhoneForMeta` /
  `isValidE164`. Argumentos a Meta son un objeto, como en `meta-api.ts`.

### Casos límite

- Listas vacías, id ajeno a la cuenta, rol `viewer`, key sin scopes.
- Webhook: firma ausente, body no JSON, `phone_number_id` duplicado
  entre cuentas, reintento de Meta (`message_id` no es único).
- Migración: `IF NOT EXISTS` donde el resto de migraciones lo usa;
  no se reescribe una migración ya numerada.
- Rate limit: la ruta nueva usa `checkRateLimit` + `RATE_LIMITS` si
  es pública o costosa (envío, IA, invitaciones, admin).

### Errores

- Dashboard: `toErrorResponse`. No se filtra `err.message` en un 500.
- API v1: `ApiError` con `code` estable.
- Validación: mensaje accionable, en inglés, como
  `template-validators.ts`.
- `after()` en el webhook y en broadcasts: un fallo del motor no
  puede convertir el acuse a Meta en 500 una vez aceptado el POST.
  Los motores de automatización, flujos e IA capturan sus propios
  errores.

### Tests

- Lógica nueva en `src/lib` tiene `*.test.ts` al lado, o el PR explica
  por qué no es comprobable sin red.
- El test no llama a Meta ni a Supabase real. `fetch` se sustituye
  como en `meta-api.test.ts`.
- Un fix de regresión incluye el caso que fallaba.
- No se pide test de DOM: el repo no tiene jsdom.

### Estilo y lectura

- Alias `@/`, kebab-case, `cn()` para clases.
- Prettier en lo tocado. No exigir reescritura de comillas en
  archivos que el PR no necesitaba formatear.
- Comentario solo si explica un porqué no obvio (RLS, ventana de 24 h,
  service role, issue).
- Sin `any` nuevo ni `eslint-disable` de archivo completo.

### Rendimiento

- N+1 contra Supabase en un listado de bandeja o de broadcasts.
- `select('*')` de `messages` o `contacts` cuando bastan columnas.
- Trabajo pesado en el camino del acuse del webhook, en lugar de
  `after()`.
- Fan-out de IA o de broadcast sin el rate limit ya definido.

### Contratos

- `/api/v1` y `docs/public-api.md` coinciden (status, `code`, scopes).
- Columnas nuevas coinciden con `src/types/index.ts`.
- No se rompe el formato de cifrado `iv:ciphertext:authTag`.
- Textos de UI en inglés. Skills y el cuerpo del PR pueden ir en
  español; la interfaz no se traduce en un PR de lógica.

## Formato de salida

Ordena los hallazgos. Si no hay ninguno de un nivel, omite el nivel.
Cada hallazgo lleva archivo y línea, por qué importa y un arreglo
concreto.

```markdown
## Revisión — Ángela Calidad

### Bloqueante
- `src/app/api/ejemplo/route.ts:42` — La query usa service role y no
  filtra `account_id`, así que una cuenta lee filas de otra.
  Arreglo: usar `requireRole` y el cliente de sesión, o filtrar por
  `ctx.accountId` si el service role es inevitable.

### Importante
- `src/lib/ejemplo.ts:10` — La rama de teléfono vacío no tiene test.
  Arreglo: un `it` en `ejemplo.test.ts` que espere el rechazo.

### Sugerencia
- `src/components/ejemplo.tsx:18` — El `className` concatena strings.
  Arreglo: `cn()`.

## Veredicto
request-changes
```

El veredicto es exactamente `approve` o `request-changes`.

- `request-changes` si hay cualquier Bloqueante, o un Importante que
  deje el comportamiento mal (auth, datos cruzados, pérdida de
  mensajes, test que falta en cifrado o en firma).
- `approve` si solo quedan Sugerencias, o ninguna. Las Sugerencias no
  bloquean.

No apruebes el merge: eso es de Rodrigo (`pr-guidelines`). Tu
veredicto es la revisión de código.
