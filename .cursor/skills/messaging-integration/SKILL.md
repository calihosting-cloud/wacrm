---
name: messaging-integration
description: >-
  Úsala al cambiar el webhook de WhatsApp, el envío, las plantillas,
  los broadcasts, los flujos o la API pública de mensajes en wacrm.
  Cubre Cloud API v21.0, ventanas de 24 h, consentimiento, límites,
  reintentos y la prohibición de loguear cuerpos o teléfonos.
---

# Integración de mensajería — WhatsApp

Leonardo el Backend implementa. Gonzalo el DBA si hay columnas nuevas.
Mateo Seguridad revisa firma, cifrado y logs. Catalina Producto UX
decide el texto que ve el agente en la bandeja; los literales de UI
siguen en inglés.

API: Meta WhatsApp Cloud API, versión fijada en
`src/lib/whatsapp/meta-api.ts` como `META_API_VERSION = 'v21.0'`,
base `https://graph.facebook.com/v21.0`. Todas las llamadas son
servidor, con `Authorization: Bearer <access token descifrado>`.
Argumentos con nombre (`phoneNumberId`, `accessToken`, `to`, …).

El token y el `verify_token` se guardan cifrados en `whatsapp_config`
(`src/lib/whatsapp/encryption.ts`). Registrar el número en la tabla no
basta para recibir tráfico: hacen falta `POST /{phone-number-id}/register`
(PIN de 6 dígitos) y la suscripción de la app. Lo documenta el bloque
«Cloud API registration» de `meta-api.ts` y la ruta
`src/app/api/whatsapp/config/verify-registration/route.ts`.

## Webhook

Ruta: `src/app/api/whatsapp/webhook/route.ts`. `maxDuration = 60`.

- **GET** `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`.
  Compara el token con cada `verify_token` descifrado. Respuesta
  correcta: el challenge en `text/plain`, 200. Si no hay match: 403.
- **POST** firma `x-hub-signature-256` sobre los bytes crudos
  (`verifyMetaWebhookSignature`). 401 si falla. No uses 200 para
  “tragar” una firma mala: el comentario del route lo explica (el
  panel de Meta debe mostrar el fallo).
- Procesa en `after()`. Un acuse lento provoca reintentos de Meta.
- `message_id` en `messages` **no es único**. Un reintento puede
  insertar otra fila. No asumas idempotencia. El índice único de
  verdad para estados de broadcast es
  `broadcast_recipients.whatsapp_message_id` (migración 003, parcial).
- Un `phone_number_id` debe mapear a una sola cuenta (migración 013).
  Si el lookup es ambiguo, el webhook suelta el mensaje y lo deja en
  el log sin el teléfono.
- Reacciones: `message_actions`, único
  `(message_id, actor_type, actor_id)` (migración 009).
- Campos de plantilla (`message_template_status_update` y afines):
  `handleTemplateWebhookChange` en
  `src/lib/whatsapp/template-webhook.ts`.

No loguees el JSON entrante. Los `console.error` actuales llevan
prefijo `[webhook]` y un motivo, no el cuerpo.

## Envío

| Camino | Auth | Límite local |
| --- | --- | --- |
| Bandeja, `POST /api/whatsapp/send` | sesión, `canSendMessages` | `RATE_LIMITS.send`: 60/min por usuario |
| Reacción, `POST /api/whatsapp/react` | sesión | `RATE_LIMITS.react`: 120/min |
| Broadcast UI, `POST /api/whatsapp/broadcast` | sesión | `RATE_LIMITS.broadcast`: 5 lanzamientos/min por usuario. No limita los destinatarios de dentro |
| `POST /api/v1/messages` | API key, scope `messages:send` | `RATE_LIMITS.publicApi`: 120/min por key |
| `POST /api/v1/broadcasts` | scope `broadcasts:send` | el mismo presupuesto de API pública. Tope de destinatarios en el handler: 1..1000 |

Texto libre: `sendTextMessage`. Solo dentro de la ventana de atención
de 24 h desde el último mensaje del cliente. La bandeja lo calcula en
`message-thread.tsx` (`differenceInHours` ≥ 24 → `sessionExpired`) y
el compositor obliga a usar plantilla. La IA automática no chequea la
ventana aparte: solo corre al llegar un inbound, así que la ventana
acaba de abrirse (`src/lib/ai/auto-reply.ts`).

Plantilla: `sendTemplate` / builder
`src/lib/whatsapp/template-send-builder.ts`. Hace falta una plantilla
aprobada por Meta. Nombre local: `^[a-z0-9_]{1,512}$`
(`TEMPLATE_LIMITS` en `template-validators.ts`). Categorías guardadas
en el tipo: `'Marketing' | 'Utility' | 'Authentication'`
(`src/types/index.ts`).

Interactivos (flujos): `INTERACTIVE_LIMITS` — 1 a 3 botones, título
≤ 20, listas hasta 10 filas, título de fila ≤ 24, descripción ≤ 72.
El id del botón vuelve en el webhook como
`interactive.button_reply.id` y avanza el run del flujo.

Medios: topes en `MEDIA_MAX_BYTES_BY_KIND` (imagen 5 MB, resto 16 MB).
Audio sin caption (Meta lo rechaza); el compositor ya lo omite.

Teléfonos: `sanitizePhoneForMeta` deja solo dígitos (sin `+`).
`isValidE164` acepta `+` opcional, 7 a 15 dígitos, sin empezar por 0.
`phonesMatch` compara también los últimos 8 dígitos para el prefijo
de troncal. Ese recorte puede juntar números distintos: no lo uses
como identidad de cuenta, solo como ayuda de dedupe
(`src/lib/contacts/dedupe.ts`). `phoneVariants` reintenta el error
131030 de sandbox («not in allowed list») insertando o quitando un 0
tras un prefijo de país de 1, 2 o 3 dígitos.

Errores de Meta: `throwMetaError` propaga `error.message` de Meta.
No los tragues en un 200.

## Plantillas

UI: `src/components/settings/template-manager.tsx`. Submit:
`POST /api/whatsapp/templates/submit`. Sync:
`POST /api/whatsapp/templates/sync`.

Validar en local con `validateTemplate` antes del POST a
`/{wabaId}/message_templates`. Límites de Meta codificados:
cuerpo 1024, footer 60, header de texto 60, botón 25, máx. 10 botones,
2 URL, 1 teléfono, 1 copy-code. Variables `{{1}}`, `{{2}}` contiguas
desde 1.

Cabecera con imagen: hace falta `META_APP_ID` (Resumable Upload). Sin
él, el submit de ese tipo debe fallar con error claro; las de solo
texto siguen funcionando.

`WHATSAPP_TEMPLATES_DRY_RUN=true` no llama a Meta y guarda
`meta_template_id` sintético `dry-run-<uuid>`. Solo CI y local. En
producción tiene que estar ausente o en `false`.

Editar una plantilla APPROVED o REJECTED relanza la revisión de Meta.
PENDING / DISABLED / IN_APPEAL no se editan (comentario en
`meta-api.ts`).

## Opt-in y consentimiento

El esquema no tiene columna de consentimiento ni de opt-in (no hay
matches en `src/` ni en `supabase/migrations/`). Un contacto importado
por CSV o creado por API **no** es una prueba de opt-in.

Regla de este repo hasta que exista un campo:

- No dispares broadcasts de categoría `Marketing` a una lista entera
  solo porque los teléfonos están en `contacts`.
- No añadas un booleano `opt_in = true` por defecto en un import.
- Un mensaje de sesión (el cliente escribió en las últimas 24 h) es
  el único caso que el código trata como ventana abierta, y eso no
  es un opt-in de marketing.
- `TODO: confirmar con Rodrigo` el modelo de consentimiento (dónde se
  guarda, quién lo carga, si bloquea `broadcasts:send`) antes de
  crear la columna. Gonzalo el DBA no migra eso sin esa confirmación.

Utility y Authentication siguen las reglas de Meta para esas
categorías; no las rebautices a Marketing para saltarte la revisión.

## Límites y reintentos

Límites que el código sí impone: la tabla `RATE_LIMITS` y los topes
de arriba. El throughput y el tier de calidad de la línea (1K / 10K /
100K conversaciones únicas / 24 h, según Meta) **no** están
codificados. `verifyPhoneNumber` lee `quality_rating` para mostrarlo;
no corta el envío. No inventes un número de “mensajes por segundo” en
un comentario como si fuera una constante del repo.
`TODO: confirmar con Rodrigo` si hay que persistir el tier y frenar
broadcasts cuando Meta baje la calidad.

Reintentos:

- Meta reintenta el webhook si no hay 200 rápido. Por eso `after()`.
  No añadas otro retry infinito delante de un insert.
- `phoneVariants` es el único reintento de destino, y solo para 131030.
- Broadcasts de la API v1 avanzan en `after()` destinatario a
  destinatario. Si el proceso muere, las filas se quedan `pending` y
  el broadcast `sending` (comentario en
  `src/app/api/v1/broadcasts/route.ts`). No lances un segundo barrido
  paralelo sin un claim tipo el de
  `automation_pending_executions` (`status` de `pending` a `running`).
- El cron de automatizaciones reclama filas antes de ejecutarlas
  (`GET /api/automations/cron`, lote de 50).

## Logs

Prohibido en `console.*` y en el texto del PR:

- cuerpo del mensaje, caption, parámetros de plantilla, transcripción;
- teléfono, `wa_id`, `display_phone_number`;
- access token, verify token, `ENCRYPTION_KEY`, firma HMAC.

Permitido: `accountId`, ids UUID internos, `message_id` de Meta cuando
hace falta atar un fallo de persistencia, códigos de error de Meta,
status HTTP.

El webhook saliente hacia la URL del cliente incluye `text` en
`message.received`. Es el contrato de `docs/public-api.md`, no un log.
No lo dupliques en consola al depurar.
