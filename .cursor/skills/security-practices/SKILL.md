---
name: security-practices
description: >-
  Úsala al tocar secretos, auth, sesiones, API keys, webhooks, SQL,
  subidas, logs o dependencias en wacrm. Prácticas concretas del repo
  para no filtrar tokens, teléfonos ni cuerpos de mensaje.
---

# Prácticas de seguridad — wacrm

Revisión dedicada: Mateo Seguridad, skill `security-review`. Esta
skill es la que se aplica mientras se escribe el código.

## Secretos

Nunca se commitean. `.gitignore` ignora `.env*` y vuelve a incluir
solo `.env.local.example` y `.env.example`. El ejemplo no lleva
valores reales.

| Variable | Uso | Dónde se lee |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente público, sujeto a RLS | `src/lib/supabase/server.ts`, `client.ts`, `middleware.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | salta RLS. Solo servidor | admin clients y el webhook |
| `ENCRYPTION_KEY` | 64 hex = 32 bytes, AES-256-GCM | `src/lib/whatsapp/encryption.ts`. Rotarla invalida tokens ya cifrados |
| `META_APP_SECRET` | HMAC del webhook. Obligatorio: sin él se rechaza todo | `src/lib/whatsapp/webhook-signature.ts` |
| `META_APP_ID` | subida reanudable de cabeceras de plantilla | opcional, `.env.local.example` |
| `AUTOMATION_CRON_SECRET` | header `x-cron-secret` | `/api/automations/cron`, `/api/flows/cron` |
| `ALLOWED_INVITE_HOSTS` | allow-list de hostnames en URLs de invitación | `src/app/api/account/invitations/route.ts` |
| `NEXT_PUBLIC_SITE_URL` | URL canónica (sitemap, OG). No es un secreto | público a propósito |

Claves de OpenAI o Anthropic: no hay variable global. Se guardan
cifradas por cuenta (migración `029_ai_reply.sql`). API keys del
producto: el plaintext `wacrm_live_` se muestra una vez; en
`api_keys` solo entra el SHA-256 (`src/lib/api-keys/keys.ts`).

En CI los valores son ficticios y viven en el workflow y en
`vitest.config.ts`. No los reproduzcas en un PR, en un log ni en un
comentario.

Generación documentada en `.env.local.example`:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
para `ENCRYPTION_KEY`, `openssl rand -hex 32` para el cron.

## Autenticación

- Dashboard: cookies de Supabase. `middleware.ts` llama a `getUser()`
  (no a `getSession()` solo) y reescribe las cookies rotadas en cada
  respuesta, incluidos los redirects.
- Rutas de página protegidas por el middleware: `/dashboard`,
  `/inbox`, `/contacts`, `/pipelines`, `/broadcasts`, `/automations`,
  `/settings`. `/flows`, `/agents` y `/notifications` quedan fuera de
  esa lista; el shell cliente redirige a `/login` si no hay usuario.
  Una ruta nueva de páginas se añade a `protectedPaths`.
- `/api/whatsapp/*` excepto el webhook: 401 JSON si no hay usuario.
- Autorización de verdad: `requireRole` + predicados de
  `src/lib/auth/roles.ts`, y RLS en Postgres. El middleware no mira
  el rol.
- API pública: `requireApiKey` en `src/lib/auth/api-context.ts`.
  Bearer `wacrm_live_`, lookup por hash, scopes con `hasScope`. Crear
  keys exige admin (`canManageMembers` / rutas de
  `src/app/api/account/api-keys/`).
- Invitaciones: token de alta entropía, peek limitado por IP
  (`RATE_LIMITS.invitationPeek`), redeem más estricto.

Service role solo en código de servidor que ya lo usa. Un route
handler de usuario normal usa el cliente de cookies para que RLS
aplique.

## CSRF, XSS, cabeceras

No hay token CSRF propio. Las mutaciones del dashboard van con la
cookie de sesión de Supabase (SameSite que fija `@supabase/ssr`). La
API pública no usa esa cookie: usa Bearer. No aceptes un API key en
query string.

XSS: React escapa el texto. No introduzcas `dangerouslySetInnerHTML`
salvo el script de arranque de tema en `src/app/layout.tsx`, que es
una cadena construida en el servidor con `JSON.stringify` de ids
conocidos. Markdown o HTML de clientes no se renderiza como HTML.

Cabeceras en `next.config.ts`: HSTS, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`
(cámara y geolocalización denegadas; micrófono solo `self` para notas
de voz). CSP en **Report-Only** (`Content-Security-Policy-Report-Only`),
con `script-src 'unsafe-inline' 'unsafe-eval'`. No la pases a modo
enforce sin un pase por las rutas: el comentario del archivo explica
el motivo. `frame-ancestors 'none'` y `form-action 'self'` ya están.

`/api/*` lleva `Cache-Control: no-store`.

## Inyección

- SQL de aplicación: el cliente de Supabase (consultas filtradas por
  método, no cadenas concatenadas). SQL crudo solo en
  `supabase/migrations/*.sql` y en `scripts/apply-migrations.mjs`.
- Comandos: no hay `child_process` en `src/`. No lo añadas para
  “convertir un archivo”.
- SSRF: cualquier URL que el servidor vaya a pedir y que venga del
  usuario pasa por `isDeliverableUrl`. Réplica el `redirect: 'manual'`
  de `src/lib/webhooks/deliver.ts`.
- Plantillas de mensaje: valida con `src/lib/whatsapp/template-validators.ts`
  antes de llamar a Meta. No interpoles texto de contacto dentro de
  SQL ni de una shell.

## Subidas

`uploadAccountMedia` (`src/lib/storage/upload-media.ts`):

- Ruta `account-<account_id>/<timestamp>-<basename>.<ext>`. El primer
  segmento es lo que casa la policy del bucket. No armes la ruta a mano.
- Techo del bucket: `MEDIA_MAX_BYTES` = 16 MB.
- Techos por tipo, alineados con Meta: imagen 5 MB, vídeo / audio /
  documento 16 MB (`MEDIA_MAX_BYTES_BY_KIND`).
- El basename se recorta a 40 caracteres y se le quitan los caracteres
  que no son `a-zA-Z0-9_-`.

El navegador sube con la sesión del usuario; RLS del bucket rechaza
un prefijo de otra cuenta.

## Datos sensibles en logs y en respuestas

- `toErrorResponse` no devuelve el mensaje de un error desconocido.
- No hagas `console.log` del body del webhook, de `content_text`, de
  `from` / `wa_id`, ni del access token descifrado.
- El evento saliente `message.received` incluye `text` a propósito
  hacia el endpoint que la cuenta registró (`dispatchWebhookEvent`).
  Eso es entrega, no un log. No lo copies a `console.*`.
- En un PR o en un hallazgo de revisión, cita el nombre de la variable
  y el archivo. Nunca el valor.

## Dependencias e higiene

- `npm audit` es la herramienta de este stack (npm, lockfile
  `package-lock.json`). No añadas otro auditor como dependencia.
- Dependabot: `.github/dependabot.yml`, semanal, grupos para
  `@supabase/*` y devDependencies. `next`, `react`, `react-dom`,
  `tailwindcss` y `eslint-config-next` están ignorados a propósito:
  se suben a mano.
- Overrides de seguridad en `package.json` (`postcss`, `ip-address`,
  `fast-uri`, `hono`, `js-yaml`, `@babel/core`). No los quites al
  “limpiar” el manifiesto.
- Una dependencia nueva se justifica en el cuerpo del commit o del PR
  (lo pide la plantilla de `.github/pull_request_template.md`).

## Cifrado y comparación de secretos

- `encrypt()` escribe siempre GCM: `iv:ciphertext:authTag`. `decrypt()`
  aún lee CBC legado (dos partes). Al tocar una fila, el patrón de
  re-cifrado está en el webhook (`isLegacyFormat`).
- Compara secretos con `crypto.timingSafeEqual` y un chequeo de
  longitud previo. Referencia correcta: `GET /api/flows/cron`.
  `GET /api/automations/cron` todavía usa `!==` contra
  `AUTOMATION_CRON_SECRET`; el código nuevo no copia ese `!==`.
- Firma de Meta: HMAC-SHA256 del body crudo, prefijo `sha256=`,
  comparación en tiempo constante (`webhook-signature.ts`).
- Firma saliente: `t=<unix>,v1=<hex>` sobre `` `${t}.${rawBody}` ``
  (`src/lib/webhooks/sign.ts`).

## Rate limiting

Una sola tabla, `RATE_LIMITS` en `src/lib/rate-limit.ts`. Es memoria
del proceso: en más de una instancia no se sostiene. No lo sustituyas
por un contador ad hoc. Si el despliegue deja de ser un solo Node, el
cambio es la función `check`, no cada llamada.

Presupuestos vigentes: `send` 60/min por usuario, `broadcast` 5/min,
`react` 120/min, `invitationPeek` 30/min por IP, `invitationRedeem`
10/min, `adminAction` 30/min, `publicApi` 120/min por key, `aiDraft`
20/min por usuario y 60/min por cuenta.
