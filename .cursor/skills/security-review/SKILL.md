---
name: security-review
description: >-
  Úsala cuando Mateo Seguridad revisa un diff o un despliegue de wacrm:
  OWASP Top 10, búsqueda de secretos, npm audit, autorización, servicios
  expuestos y datos sensibles en logs. Nunca imprimas el valor de un secreto.
---

# Revisión de seguridad — Mateo Seguridad

Mateo Seguridad es el dueño de esta skill. La pasada de corrección
general sigue siendo de Ángela Calidad. Esta revisión se centra en
impacto de seguridad.

No pegues valores de tokens, cookies, teléfonos, cuerpos de WhatsApp
ni filas de `.env`. Si encuentras un secreto, di el nombre de la
variable, el archivo y la línea, y pide rotación. El valor no entra
en el informe, ni en el PR, ni en un comentario.

## Mapa OWASP Top 10 (2021) en este repo

| Riesgo | Dónde mirar en wacrm |
| --- | --- |
| A01 Broken Access Control | `requireRole`, predicados de `src/lib/auth/roles.ts`, scopes en `src/lib/api-keys/scopes.ts`, RLS de `supabase/migrations/`. Service role en `supabaseAdmin` y en el webhook. `protectedPaths` de `src/middleware.ts` no cubre `/flows`, `/agents`, `/notifications` |
| A02 Cryptographic Failures | `src/lib/whatsapp/encryption.ts` (AES-256-GCM; CBC solo lectura). Hash SHA-256 de API keys. HMAC del webhook. Comparación en tiempo constante (copiar `/api/flows/cron`, no el `!==` de `/api/automations/cron`) |
| A03 Injection | Consultas del cliente Supabase. SQL solo en migraciones. Sin `child_process` en `src/`. SSRF: `src/lib/webhooks/ssrf.ts` |
| A04 Insecure Design | Ventana de 24 h, plantillas, dedupe de teléfonos por últimos 8 dígitos (`phonesMatch`), `message_id` no único, rate limit en memoria de un solo proceso |
| A05 Security Misconfiguration | Cabeceras de `next.config.ts`. CSP sigue en Report-Only. `META_APP_SECRET` vacío debe fallar cerrado. Cron sin secreto → 503 |
| A06 Vulnerable Components | `npm audit`, Dependabot (`.github/dependabot.yml`), `overrides` de `package.json` |
| A07 Identification and Authentication Failures | `getUser()` en middleware, cookies rotadas (issue `#288`), API keys de un solo uso visible, invitaciones con rate limit |
| A08 Software and Data Integrity Failures | Firma `x-hub-signature-256` sobre el body crudo. Firma saliente `X-Wacrm-Signature`. Lockfile `package-lock.json` |
| A09 Security Logging and Monitoring Failures | `console.error` con prefijo. No debe haber cuerpos, teléfonos ni secretos. 500 genérico en `toErrorResponse` |
| A10 SSRF | URLs de webhooks salientes y cualquier `fetch` nuevo con host elegido por el usuario. `redirect: 'manual'` |

## Secretos

Busca en el diff y, si el encargo es el árbol, en el repo. No imprimas
la coincidencia completa si parece un secreto: trunca a los 4 primeros
caracteres del nombre de la variable y el número de línea.

Patrones ripgrep (desde la raíz):

```bash
rg -n -i --glob '!.git/**' --glob '!package-lock.json' --glob '!node_modules/**' \
  -e 'SUPABASE_SERVICE_ROLE_KEY\s*=' \
  -e 'META_APP_SECRET\s*=' \
  -e 'ENCRYPTION_KEY\s*=' \
  -e 'AUTOMATION_CRON_SECRET\s*=' \
  -e 'wacrm_live_[A-Za-z0-9_-]{8,}' \
  -e 'sk-[A-Za-z0-9]{10,}' \
  -e 'AKIA[0-9A-Z]{16}' \
  -e 'BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY' \
  -e 'xox[baprs]-' \
  src .env.example .env.local.example .github
```

Los ejemplos de `.env.local.example` deben ser marcadores
(`your-…`), no claves. Los dummies de CI y de `vitest.config.ts` son
conocidos: menciónalos solo si alguien los copia fuera de esos dos
archivos.

Si `gitleaks` está en el `PATH`, corre `gitleaks detect --no-banner
--redact` desde la raíz y adjunta el informe ya redactado. Si no está,
dilo en una línea y quédate con los `rg` de arriba. No lo instales
como dependencia del proyecto.

## Dependencias

```bash
npm audit --omit=dev
npm audit
```

Separa hallazgos de runtime y de desarrollo. Una vulnerabilidad solo
en la cadena de build no es lo mismo que una en `next` o
`@supabase/supabase-js`. Cruza con los `overrides` de `package.json`
antes de pedir un override duplicado. No subas `next`, `react` ni
`tailwindcss` en esta revisión: están fijados y fuera de Dependabot.

## Autorización y superficie

- ¿El route handler nuevo comprueba sesión o API key antes de leer
  el body útil?
- ¿El webhook sigue verificando la firma antes de `JSON.parse` con
  efectos, y responde 401 si falla?
- ¿Una policy RLS nueva usa `auth.uid()` / membresía de cuenta, no
  `USING (true)` para un rol de usuario? `WITH CHECK (true)` en
  inserts de service role ya existe en `messages` (migración 001):
  no lo copies a tablas que lee el cliente.
- ¿`NEXT_PUBLIC_` en una variable que es secreta? Eso es Crítico.
- Cron y webhook son públicos por diseño. Deben seguir exigiendo
  secreto o firma.
- Invitaciones: el host de la URL no debe salir de un `Host` sin
  `NEXT_PUBLIC_SITE_URL` o `ALLOWED_INVITE_HOSTS` si el despliegue
  está expuesto.

## Datos en logs

Busca en el diff: `console.log`, `console.error`, `console.warn` junto
a `content_text`, `text`, `phone`, `wa_id`, `access_token`, `decrypt(`,
`authorization`. Un log de diagnóstico que imprime el payload del
webhook es Alto como mínimo.

## Formato de salida

```markdown
## Revisión de seguridad — Mateo Seguridad

### Crítico
- `src/ruta.ts:12` — Evidencia: la variable pública `NEXT_PUBLIC_…`
  recibe el service role. Remediación: moverla a variable de servidor
  y rotar el valor en Supabase. No se reproduce el valor.

### Alto
- …

### Medio
- …

### Bajo
- …

## Veredicto
request-changes
```

Severidad:

- **Crítico** — secreto filtrado, RLS ausente en datos de mensajes o
  tokens, webhook que acepta POST sin firma, service role en cliente.
- **Alto** — control de acceso que se puede saltar, SSRF, comparación
  no constante de un secreto nuevo, log de cuerpos o teléfonos.
- **Medio** — rate limit que falta en una ruta cara, CSP tocada sin
  motivo, dependencia con advisory de runtime y exploit no demostrado
  en este código.
- **Bajo** — endurecimiento (cabecera, comentario que cita un secreto
  de ejemplo, `!==` copiado del cron de automatizaciones).

Veredicto `request-changes` si hay Crítico o Alto. `approve` si el
peor hallazgo es Medio o Bajo, y los Medios quedan escritos con
remediación para un PR de seguimiento. La aprobación de merge sigue
siendo de Rodrigo.
