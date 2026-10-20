---
name: testing
description: >-
  Úsala al ejecutar o escribir tests en wacrm: Vitest unitario, qué cubre
  hoy el repo, fixtures, cobertura, y cómo proponer e2e sin añadir
  dependencias. No hay suite Playwright ni Cypress en el proyecto.
---

# Testing — wacrm

Dueña de la revisión: Ángela Calidad (`code-review`). Quien escribe el
test es quien toca el módulo (Leonardo el Backend, Camila Frontend,
Gonzalo el DBA si el cambio es SQL comprobable desde TypeScript).

## Cómo se ejecuta

| Comando | Qué hace |
| --- | --- |
| `npm test` | `vitest run`. Es lo que corre CI |
| `npm run test:watch` | Vitest en watch |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | `next build` (también typechequea) |

CI: `.github/workflows/ci.yml`, job único en Node 20, `npm ci` y luego
lint, typecheck, test, build. Variables ficticias de build:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ENCRYPTION_KEY`, `META_APP_SECRET`. No las copies a documentación ni
a logs. Deben seguir coincidiendo con `vitest.config.ts` para
`ENCRYPTION_KEY` y el secreto de Meta: `encryption.ts` y
`webhook-signature.ts` leen el entorno al cargar el módulo.

Configuración (`vitest.config.ts`):

- `environment: "node"`. No hay jsdom ni Testing Library.
- `include`: `src/**/*.test.ts` y `src/**/*.test.tsx`.
- `resolve.tsconfigPaths: true` para el alias `@/`.
- `clearMocks: true`.
- Entorno de test con `ENCRYPTION_KEY` (64 hex) y `META_APP_SECRET`.

No hay umbral de cobertura, ni `coverage` en la config, ni reporter
especial. `/coverage` está en `.gitignore`. No añadas un porcentaje
inventado. Si mides, `npx vitest run --coverage` solo como exploración
local; el repo no declara `@vitest/coverage-v8` en `package.json`.

## Cómo está escrito un test de este repo

Colocado junto al módulo: `phone-utils.test.ts` al lado de
`phone-utils.ts`. `describe` / `it` / `expect` de `vitest`. El título
del `it` dice el comportamiento, en inglés, como el código.

Patrones que ya se usan:

- **Función pura.** Entradas y salidas, sin red. Referencia:
  `src/lib/whatsapp/phone-utils.test.ts`,
  `src/lib/auth/roles.test.ts`,
  `src/lib/api-keys/scopes.test.ts`,
  `src/lib/whatsapp/template-validators.test.ts`.
- **Reloj y estado de módulo.** `src/lib/rate-limit.test.ts` usa
  `__resetRateLimitForTests()`. No dejes buckets vivos entre archivos.
- **Red que no debe ocurrir.** `src/lib/whatsapp/meta-api.test.ts`
  hace `vi.stubGlobal("fetch", vi.fn(neverFetch))` con una promesa que
  no resuelve, y `vi.unstubAllGlobals()` en `afterEach`. Si la
  validación no corta antes del `fetch`, el test cuelga en lugar de
  pegarle a `graph.facebook.com`. Copia ese patrón. Nunca apuntes un
  test a la API real de Meta ni a un proyecto Supabase de verdad.
- **Dependencias de I/O.** `vi.mock` del módulo (`supabaseAdmin` en
  `src/lib/auth/api-context.test.ts` y
  `src/lib/automations/engine.test.ts`).

`src/components/flows/flow-editor-state.test.ts` y
`shared.test.ts` prueban lógica extraída del editor, no el DOM. No
hay tests de render.

## Qué se espera al cambiar código

- Lógica nueva en `src/lib` que sea pura: test colocalizado en el
  mismo PR. Ángela Calidad trata la ausencia como hallazgo
  Importante, o Bloqueante si la función decide auth, cifrado, firma,
  teléfonos o un límite de Meta.
- Un bugfix: un test que falle con el código anterior y pase con el
  fix.
- No hace falta test de render para un cambio de clases Tailwind.
  Sí hace falta si extraes una función (como en flows).
- Migración SQL: no hay harness de Postgres en CI. El test de la
  regla que deba coincidir con SQL vive en TypeScript
  (`roles.test.ts` espeja `is_account_member`). Describe en el PR
  cómo se aplicó la migración en un proyecto de prueba
  (`npm run db:migrate` contra un proyecto desechable, nunca contra
  producción).

## Fixtures

No hay carpeta `fixtures/` ni factories compartidas. Los datos van
inline en el test (`BASE_ARGS` en `meta-api.test.ts`). Teléfonos de
ejemplo: los que ya usan los tests (`+370…`, `+14155551212`). No
pegues números ni mensajes reales de clientes.

Secretos de test: solo los de `vitest.config.ts`. No leas `.env` ni
`.env.local` desde un test.

## E2E — no existe, propuesta mínima (solo documentación)

No hay Playwright, Cypress ni script `test:e2e` en `package.json`.
`@playwright/test` aparece solo como dependencia opcional transitiva
de Vitest. No lo instales como parte de un cambio de producto salvo
que Rodrigo lo pida.

Propuesta mínima, para cuando se autorice un harness:

1. Proyecto Playwright en `e2e/`, un spec de humo: `/login` renderiza
   el formulario y un usuario no autenticado que abre `/inbox` acaba
   en `/login` (lo hace `middleware.ts`).
2. Arranque: `npm run dev`, `baseURL` `http://localhost:3000`.
3. Sin proyecto Supabase real: el humo solo cubre redirects y HTML
   público. Los flujos con webhook de Meta se quedan en Vitest, con
   `fetch` simulado.
4. CI: job aparte, después de que el humo sea estable. No lo metas en
   el job actual hasta que exista el spec y Rodrigo lo apruebe.
5. `TODO: confirmar con Rodrigo` el momento de añadir la dependencia
   y si el humo debe correr en el workflow de `.github/workflows/ci.yml`.

Hasta entonces, la verificación de UI es manual y se anota en el plan
de prueba del PR (plantilla en `pr-guidelines`).

## Si un test falla

- Cifrado o firma: compara el entorno del proceso con
  `vitest.config.ts` antes de tocar la aserción.
- Orden de clases Tailwind: corre Prettier
  (`prettier-plugin-tailwindcss`) en lugar de reordenar a mano.
- No debilites un `toThrow(/…/)` para que pase. El mensaje es parte
  del contrato que ve el usuario.
