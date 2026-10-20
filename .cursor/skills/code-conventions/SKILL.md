---
name: code-conventions
description: >-
  Úsala al escribir o editar TypeScript, TSX, SQL de migraciones o scripts
  de wacrm: nombres, estructura de archivos, formato, lint, errores, logs
  y comentarios. Cubre las convenciones reales del repo, no un estilo genérico.
---

# Convenciones de código — wacrm

CRM autoalojable (Next.js 16, React 19, Supabase, WhatsApp Cloud API).
El alias `@/*` apunta a `src/*` (`tsconfig.json`). TypeScript estricto
(`"strict": true`). Node `>=20`.

## Nombres

| Qué | Convención | Ejemplo real |
| --- | --- | --- |
| Archivos de dominio y rutas | kebab-case | `src/lib/whatsapp/send-message.ts`, `src/app/api/whatsapp/webhook/route.ts` |
| Componentes React | función PascalCase, archivo kebab-case | `DashboardShell` en `src/app/(dashboard)/dashboard-shell.tsx` |
| Hooks | `use-*` | `src/hooks/use-can.ts`, `src/hooks/use-realtime.ts` |
| Tests | mismo nombre + `.test.ts` al lado del módulo | `src/lib/whatsapp/phone-utils.test.ts` |
| Migraciones | `NNN_descripcion.sql`, siguiente número libre | `supabase/migrations/030_ai_knowledge.sql` |
| Tablas y columnas | snake_case | `whatsapp_message_id`, `account_role` |
| Roles y scopes | literales en minúscula | `AccountRole`: `owner` \| `admin` \| `agent` \| `viewer`. Scopes `recurso:accion` en `src/lib/api-keys/scopes.ts` |
| Variables CSS | tokens semánticos, no hex suelto | `bg-background`, `text-muted-foreground`, `bg-primary` |

No renombres tablas ni columnas “para que suene mejor”: las políticas
RLS y los tipos de `src/types/index.ts` dependen de esos nombres.

## Dónde va el código

- Lógica pura y comprobable: `src/lib/<dominio>/`. Sin I/O si el módulo
  ya es puro (`roles.ts`, `scopes.ts`, `phone-utils.ts`, `template-validators.ts`).
- Rutas HTTP delgadas: `src/app/api/**/route.ts`. Autenticación, rate
  limit y mapeo de errores aquí; el trabajo de dominio, en `src/lib`.
- UI por feature: `src/components/<feature>/`. Primitivos en
  `src/components/ui/`.
- Páginas: `src/app/(dashboard)/`, `src/app/(auth)/`, `src/app/join/`.
- Cliente Supabase de sesión (RLS): `createClient` de
  `src/lib/supabase/server.ts` (servidor) o `src/lib/supabase/client.ts`
  (navegador).
- Service role: solo los `supabaseAdmin()` que ya existen
  (`src/lib/automations/admin-client.ts`, `src/lib/flows/admin-client.ts`,
  `src/lib/ai/admin-client.ts`) y el webhook
  `src/app/api/whatsapp/webhook/route.ts`. No crees otro cliente con
  `SUPABASE_SERVICE_ROLE_KEY`.

`src/lib/auth/account.ts` es solo de servidor (usa `next/headers`).
Importarlo desde un componente cliente rompe el build. No añadas el
paquete `server-only`: el repo usa ese fallo de import como frontera.

## Parámetros con nombre

En `src/lib/whatsapp/meta-api.ts` cada llamada a Meta recibe un objeto
de argumentos, no posicionales. El comentario del archivo explica por
qué: el mismo bug de argumentos cambiados apareció varias veces
(`accessToken` vs `phoneNumberId`). Las funciones nuevas de ese módulo
siguen el mismo patrón.

## Formato y lint

Fuente de verdad: `.prettierrc`.

- `semi: true`, `singleQuote: true`, `trailingComma: "es5"`,
  `printWidth: 80`, `tabWidth: 2`, `arrowParens: "always"`,
  `endOfLine: "lf"`.
- Plugin `prettier-plugin-tailwindcss`: las clases de `className` se
  ordenan al formatear. Combina clases con `cn()` de `src/lib/utils.ts`
  (`clsx` + `tailwind-merge`), no con concatenación manual.

Comandos: `npm run format` (escribe) y `npm run format:check`.
`npm run lint` es ESLint 9 con `eslint-config-next` (core-web-vitals +
typescript) en `eslint.config.mjs`. Ignora `.next/**`, `out/**`,
`build/**`, `next-env.d.ts` y `public/opus/**`.

CI (`.github/workflows/ci.yml`) ejecuta lint, typecheck, test y build.
No ejecuta `format:check`. Hay archivos históricos con comillas dobles
(por ejemplo `src/lib/auth/account.ts` y varios componentes). No
reformatées un archivo entero si el diff deja de verse. En código
nuevo, sigue `.prettierrc`. Si tocas un archivo ya formateado, no
mezcles el estilo.

`npm run typecheck` es `tsc --noEmit`. `next build` vuelve a
typechequear. No uses `any` nuevo; el webhook ya tiene un
`eslint-disable` puntual para el cliente admin perezoso — no lo copies
como patrón.

## Errores

Tres estilos, no los mezcles en la misma superficie:

1. APIs internas del dashboard (`/api/account`, `/api/whatsapp` salvo
   el webhook, etc.): `requireRole` / `getCurrentAccount` en
   `src/lib/auth/account.ts`. Captura y devuelve `toErrorResponse(err)`.
   `UnauthorizedError` → 401, `ForbiddenError` → 403. Cualquier otra
   excepción → 500 con el texto fijo `"Internal server error"`. No
   reenvíes `err.message` de un error no clasificado.
2. API pública `/api/v1`: envelope de `src/lib/api/v1/respond.ts`.
   Éxito `{ data }`. Fallo `{ error: { code, message } }` con
   `ApiError` (`unauthorized`, `forbidden`, `rate_limited`,
   `bad_request`, `not_found`, `internal`). Los clientes ramifican por
   `code`. El `{ error: string }` interno no se usa aquí.
3. Validación de dominio (plantillas, teléfonos, pasos de
   automatización): `throw new Error("mensaje accionable")`. El
   llamador lo muestra en UI o lo convierte en 400. Los mensajes de
   producto están en inglés, como el resto de la interfaz.

Capacidades de rol: predicados de `src/lib/auth/roles.ts`
(`canManageMembers`, `canEditSettings`, `canSendMessages`, …). En UI,
`useCan` (`src/hooks/use-can.ts`) o `RequireRole`. No compares
`role === "admin"` en un sitio nuevo.

## Logs

`console.error` / `console.warn` con prefijo entre corchetes:
`[webhook]`, `[automations]`, `[flows]`, `[api/v1]`,
`[getCurrentAccount]`. No hay logger de terceros.

No registres tokens, `ENCRYPTION_KEY`, `META_APP_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`, `AUTOMATION_CRON_SECRET`, claves
`wacrm_live_`, cuerpos de mensaje ni teléfonos. Si hace falta
correlacionar, usa ids internos (`accountId`, `conversation.id`,
`message_id` de Meta solo si el log ya es de un fallo de persistencia
y no incluye el texto). Ver `messaging-integration` y
`security-practices`.

## Comentarios

El repo explica el porqué, no el qué. Bloques `// ====` separan
secciones en módulos largos (`roles.ts`, `rate-limit.ts`,
`meta-api.ts`). Un comentario que cita una migración
(`017_account_sharing.sql`) o un issue (`#288`, `#294`) es el estilo
esperado cuando el código existe por un fallo concreto. No añadas
comentarios que repiten el nombre de la función.

## UI en el mismo cambio

Si el cambio también pinta interfaz, aplica `baseline-ui` y, si hay
layout nuevo, `frontend-design`. Los textos visibles siguen en inglés.
