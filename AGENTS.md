<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# wacrm — guía para agentes

## Propósito

CRM autoalojable conectado a WhatsApp Business (Cloud API). Una
instalación, un proyecto de Supabase, bandeja compartida para varios
agentes. Incluye contactos, embudos, broadcasts con plantillas de
Meta, automatizaciones, flujos visuales (beta) y un asistente de IA
con clave propia de la cuenta. El producto está en este repo; el sitio
de marketing vive aparte.

Versión de `package.json`: 0.7.0. Licencia MIT. Textos de la interfaz
en inglés. Esta guía y las skills de `.cursor/skills/` están en español.

## Stack

- Next.js 16.2 (App Router), React 19, TypeScript estricto. Alias `@/*` → `src/*`.
- Tailwind CSS v4, shadcn `base-nova`, Base UI, lucide-react.
- Supabase: Postgres, Auth, Storage, Realtime, RLS. Migraciones en `supabase/migrations/`.
- WhatsApp Cloud API `v21.0` (`src/lib/whatsapp/meta-api.ts`).
- IA opcional: OpenAI o Anthropic, clave cifrada por cuenta.
- Node `>=20`. CI en `.github/workflows/ci.yml` (Node 20).
- Despliegue documentado: Hostinger Managed Node.js, push a `main`. No hay Docker en el repo.

Antes de escribir código de aplicación, lee la guía de Next que
corresponda en `node_modules/next/dist/docs/`. Esta versión no coincide
con la de los datos de entrenamiento.

## Cómo ejecutar, construir y probar

```bash
npm install
cp .env.local.example .env.local   # Supabase + Meta; sin commitear secretos
npm run dev          # next dev, puerto 3000
npm run build        # next build
npm run start        # next start
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run format       # prettier --write .
npm test             # vitest run
npm run db:migrate   # scripts/apply-migrations.mjs (proyecto de prueba)
```

No hay suite e2e. Detalle en `.cursor/skills/testing/SKILL.md`.

## Mapa skill → tarea

| Tarea | Skill | Quién |
| --- | --- | --- |
| Nombres, formato, errores, logs | `code-conventions` | Quien escribe el código |
| Módulos, rutas, datos, integraciones | `architecture` | Leonardo el Backend; SQL con Gonzalo el DBA |
| Tests Vitest, hueco de e2e | `testing` | Quien escribe el código; la barra la pone Ángela Calidad |
| Secretos, auth, subidas, logs | `security-practices` | Quien escribe; revisión de Mateo Seguridad |
| Rama, commit, descripción, merge | `pr-guidelines` | Quien abre el PR; Diego DevOps mira CI |
| Revisión del diff | `code-review` | Ángela Calidad |
| Revisión de seguridad | `security-review` | Mateo Seguridad |
| Plan visual de una pantalla | `frontend-design` | Andrés el Diseñador; criterio de flujo de Catalina Producto UX |
| JSX del día a día | `baseline-ui` | Camila Frontend |
| Webhook, plantillas, envíos, opt-in | `messaging-integration` | Leonardo el Backend |

## Equipo

Enrique Coordinador de Desarrollo reparte cada encargo a una sola
persona de esta lista y no deja dos dueños sobre el mismo diff.

| Persona | Alcance |
| --- | --- |
| Andrés el Diseñador | Plan visual (`frontend-design`) antes de maquetar |
| Camila Frontend | Implementación UI (`baseline-ui`) |
| Leonardo el Backend | Rutas, dominio, WhatsApp, API pública |
| Gonzalo el DBA | Migraciones, RLS, índices |
| Diego DevOps | CI, variables de entorno, el hecho de que `main` despliega |
| Ángela Calidad | Revisión de código (`code-review`) |
| Mateo Seguridad | Revisión de seguridad (`security-review`) |
| Catalina Producto UX | Recorrido del agente, del admin y del viewer |

## Aprobaciones

- Merge a `main`: solo con aprobación explícita de Rodrigo, con CI
  verde y con el veredicto de Ángela Calidad. Si el diff toca auth,
  webhooks, RLS, cifrado o dependencias, también el de Mateo Seguridad.
- Despliegue a producción: aprobación explícita de Rodrigo. En el
  camino de Hostinger, publicar es entrar en `main`. No hay un segundo
  botón que un agente pueda pulsar por su cuenta.
- `.github/CODEOWNERS` sigue pidiendo a `@ArnasDon` en el upstream.
  Eso no reemplaza a Rodrigo en este equipo.
- Vulnerabilidades: no se abren en un issue público. Cauce en
  `.github/SECURITY.md`.

## Qué no hacer en este árbol

- No commitear `.env`, `.env.local` ni secretos.
- No llamar a Meta desde el cliente ni loguear mensajes o teléfonos.
- No editar migraciones ya aplicadas; añadir la siguiente numerada.
- No añadir dependencias para “dejar el repo más completo” (cobertura,
  Playwright, gitleaks). Si hace falta, se documenta y se confirma
  con Rodrigo.
