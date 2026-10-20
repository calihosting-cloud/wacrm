---
name: architecture
description: >-
  Úsala al añadir módulos, rutas, tablas, pantallas o integraciones en
  wacrm: capas, flujo de datos, directorios, Supabase, Meta, IA y dónde
  colocar el código nuevo.
---

# Arquitectura — wacrm

Plantilla de CRM autoalojable para WhatsApp (v0.7.0). Bandeja
compartida, contactos, embudos, broadcasts, automatizaciones, flujos
visuales (beta) y asistente de IA con clave propia. No es un SaaS
multi-tenant de wacrm: cada instalación es un despliegue con su
proyecto de Supabase. Dentro de esa instalación, los datos se aíslan
por `account_id`.

Dueños habituales: Leonardo el Backend (aplicación y APIs), Gonzalo el
DBA (SQL, RLS, migraciones), Diego DevOps (CI y entorno). Enrique
Coordinador de Desarrollo reparte el trabajo.

## Capas

```
navegador
  páginas App Router + componentes cliente
  hooks (use-auth, use-realtime, use-can)
        │ cookies de Supabase
        ▼
middleware.ts          sesión, redirecciones, 401 de /api/whatsapp/*
        │
        ▼
route handlers         src/app/api/**/route.ts
  requireRole / requireApiKey / HMAC / x-cron-secret
        │
        ▼
src/lib/<dominio>      dominio, validación, clientes Meta y de IA
        │
        ▼
Supabase               Postgres + Auth + Storage + Realtime + RLS
Meta Cloud API         graph.facebook.com/v21.0  (solo servidor)
OpenAI / Anthropic     clave por cuenta, cifrada (solo servidor)
```

La UI no llama a `graph.facebook.com`. El CSP de `next.config.ts`
limita `connect-src` a `'self'` y `*.supabase.co`.

## Directorios

| Ruta | Rol |
| --- | --- |
| `src/app/(auth)/` | `/login`, `/signup`, `/forgot-password` |
| `src/app/(dashboard)/` | shell autenticado. Rutas: `/dashboard`, `/inbox`, `/notifications`, `/contacts`, `/pipelines`, `/broadcasts`, `/automations`, `/flows` (beta), `/agents`, `/settings` |
| `src/app/join/[token]/` | aceptar invitación |
| `src/app/api/whatsapp/` | config, send, react, broadcast, media, templates, webhook |
| `src/app/api/v1/` | API pública con API keys. Contrato en `docs/public-api.md` |
| `src/app/api/account/` | cuenta, miembros, invitaciones, API keys |
| `src/app/api/automations/`, `src/app/api/flows/` | CRUD, engine, cron |
| `src/app/api/ai/` | config, draft, knowledge, playground, test |
| `src/app/api/invitations/` | peek y redeem públicos |
| `src/components/ui/` | primitivos shadcn (`components.json`, estilo `base-nova`) |
| `src/components/<feature>/` | inbox, contacts, pipelines, broadcasts, automations, flows, settings, dashboard, layout, agents, presence |
| `src/hooks/` | estado de cliente |
| `src/lib/` | dominio. Ver tabla de módulos abajo |
| `src/types/index.ts` | tipos de filas y de plantillas |
| `supabase/migrations/` | esquema, de `001_initial_schema.sql` a `030_ai_knowledge.sql` |
| `scripts/apply-migrations.mjs` | aplica el directorio de migraciones con `pg` (`npm run db:migrate`). Lee `.env` (`SUPABASE_DB_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`) |

`src/app/(dashboard)/layout.tsx` es un server component que solo exporta
`metadata` (`noindex`). El shell cliente está en `dashboard-shell.tsx`:
`AuthProvider`, sidebar, header, presencia.

## Módulos de `src/lib`

| Carpeta | Responsabilidad |
| --- | --- |
| `auth/` | rol, cuenta (`requireRole`), invitaciones, contexto de API key |
| `api-keys/` | generación `wacrm_live_`, hash SHA-256, scopes, store |
| `api/v1/` | contactos, conversaciones, paginación, envelope |
| `whatsapp/` | cifrado, firma de webhook, `meta-api.ts`, teléfonos, plantillas, envío, broadcasts |
| `automations/` | motor por pasos, waits, plantillas de recetas, envío Meta |
| `flows/` | motor de flujos, aristas, fallback, layout (`@xyflow/react`) |
| `ai/` | config cifrada, borrador, auto-reply, knowledge, embeddings, proveedores |
| `webhooks/` | endpoints salientes, firma `X-Wacrm-Signature`, SSRF, entrega |
| `contacts/` | dedupe, CSV, tags de importación |
| `inbox/` | conversaciones |
| `dashboard/` | queries y fechas del panel |
| `storage/` | subida a buckets con prefijo `account-<uuid>/` |
| `supabase/` | clientes de sesión |
| `rate-limit.ts` | ventanas en memoria. Presupuestos en `RATE_LIMITS` |
| `themes.ts` | acentos y modo claro/oscuro. Los tokens viven en `src/app/globals.css` |

## Dónde poner código nuevo

- Regla de negocio sin HTTP: `src/lib/<dominio>/<nombre>.ts` +
  `<nombre>.test.ts`.
- Endpoint de dashboard: `src/app/api/.../route.ts` que llama a
  `requireRole` y a ese módulo.
- Endpoint externo: `src/app/api/v1/...` + un scope nuevo en
  `API_SCOPES` si hace falta una capacidad nueva. Documenta el cambio
  en `docs/public-api.md`.
- Pantalla: `src/app/(dashboard)/<ruta>/page.tsx` y componentes en
  `src/components/<feature>/`. Si la ruta es nueva, añádela a
  `navItems` en `src/components/layout/sidebar.tsx` y a `protectedPaths`
  en `src/middleware.ts` (hoy esa lista no incluye `/flows`, `/agents`
  ni `/notifications`; el shell cliente redirige, el middleware no).
- Columna o tabla: la siguiente migración numerada. No edites una
  migración ya aplicada. Gonzalo el DBA revisa RLS: `ENABLE ROW LEVEL
  SECURITY` y políticas alineadas con `is_account_member` / el rol de
  `src/lib/auth/roles.ts` (el orden `viewer < agent < admin < owner`
  está duplicado a propósito entre SQL y TypeScript).
- Tema visual: token en `globals.css` y entrada en `src/lib/themes.ts`.
  Los dos archivos se mueven juntos.

## Flujo de un mensaje entrante

`POST /api/whatsapp/webhook`:

1. Lee el body crudo y verifica `x-hub-signature-256` con
   `verifyMetaWebhookSignature` (`META_APP_SECRET`, fallo cerrado).
2. Responde enseguida. El trabajo va en `after()` de Next para no
   pasar el tiempo de acuse de Meta (~20 s) y para que el runtime no
   congele la promesa.
3. Resuelve la cuenta por `phone_number_id` (único desde la migración
   `013`).
4. Normaliza el teléfono (`normalizePhone`), deduplica el contacto
   (`findExistingContact`) y abre o reutiliza la conversación.
5. Inserta `messages`. `message_id` (el id de Meta) **no es único**:
   un reintento de Meta puede duplicar filas. No añadas un `UNIQUE`
   a ciegas; hay un comentario en el propio webhook que lo explica.
6. Estados (`statuses`) actualizan `messages` y
   `broadcast_recipients.whatsapp_message_id`.
7. Dispara automatizaciones (`runAutomationsForTrigger`). Si un flujo
   activo consume el mensaje, la IA no responde (`flows` gana). Si no,
   `dispatchInboundToAiReply`. Después, webhook saliente
   `message.received`.

`GET` del mismo webhook compara `hub.verify_token` con
`whatsapp_config.verify_token` descifrado y devuelve `hub.challenge`
en texto plano.

## Flujo de un mensaje saliente

- UI o `POST /api/whatsapp/send`: sesión + `RATE_LIMITS.send` (60/min
  por usuario) + `canSendMessages`.
- `POST /api/v1/messages`: `Authorization: Bearer wacrm_live_…`, scope
  `messages:send`, `RATE_LIMITS.publicApi` (120/min por key).
- Dentro de las 24 h desde el último mensaje `sender_type = 'customer'`
  se puede enviar texto libre (`sendTextMessage`). Fuera de esa
  ventana solo plantilla aprobada. La UI lo calcula en
  `src/components/inbox/message-thread.tsx` (`sessionInfo`) y bloquea
  el compositor.
- El access token de Meta sale de `whatsapp_config` cifrado
  (AES-256-GCM, `src/lib/whatsapp/encryption.ts`).

## Otras integraciones

- **Auth.** Supabase Auth, cookies vía `@supabase/ssr`. `middleware.ts`
  llama a `getUser()` y copia las cookies refrescadas a cualquier
  redirect (issue `#288`).
- **Realtime.** `src/hooks/use-realtime.ts`, `use-presence.ts`,
  `use-total-unread.ts`. Presencia en `member_presence` (migración 024).
- **Storage.** Avatares (008), `flow-media` (016) y `chat-media` (023).
  Subida única: `uploadAccountMedia` en `src/lib/storage/upload-media.ts`.
- **IA.** Sin clave global. Cada cuenta guarda su clave de OpenAI o
  Anthropic cifrada con `ENCRYPTION_KEY`. Knowledge base: FTS de
  Postgres, o `pgvector` si hay clave de embeddings (migración 030).
- **Webhooks salientes.** El cliente registra una URL; `isDeliverableUrl`
  (`src/lib/webhooks/ssrf.ts`) rechaza loopback, RFC1918, link-local y
  metadata. La entrega usa `redirect: 'manual'`. El riesgo de DNS
  rebinding está documentado en ese archivo y no está cerrado.
- **Cron.** `GET /api/automations/cron` y `GET /api/flows/cron`, header
  `x-cron-secret` = `AUTOMATION_CRON_SECRET`. Si la variable no está,
  503. El de flows compara en tiempo constante; el de automatizaciones,
  con `!==`.
- **Despliegue.** Hostinger Managed Node.js es el camino documentado
  en el README (push a `main`). También corre en cualquier Node 20.
  No hay Docker en el repo.

## Qué no hacer

- No importes `supabaseAdmin` desde un componente cliente.
- No llames a Meta desde el navegador ni pongas el access token en
  props, en un `NEXT_PUBLIC_*` ni en un log.
- No añadas un segundo limitador paralelo a `RATE_LIMITS`.
- No borres ni reescribas migraciones viejas.
