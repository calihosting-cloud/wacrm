---
name: baseline-ui
description: >-
  Úsala al escribir o revisar JSX/TSX de wacrm: reglas MUST, SHOULD y
  NEVER de UI atadas a Tailwind v4, los tokens de globals.css, shadcn
  base-nova y el shell del dashboard. Camila Frontend la aplica en cada
  pantalla.
---

# Baseline de UI — wacrm

Camila Frontend es la dueña de implementación. El plan visual, si la
pantalla es nueva o se recompone, lo escribe antes Andrés el
Diseñador con `frontend-design`. Catalina Producto UX valida el
recorrido. Esta skill es el contrato del código, no un moodboard.

Stack real: React 19, Next.js 16 App Router, Tailwind v4
(`src/app/globals.css`, `@import "tailwindcss"`), shadcn `base-nova`
(`components.json`), `@base-ui/react` en primitivos como `Button`,
`class-variance-authority`, `cn()` en `src/lib/utils.ts`, iconos
`lucide-react`, toasts `sonner` (`ThemedToaster`).

## MUST

- Usar los tokens semánticos: `bg-background`, `bg-card`, `bg-card-2`,
  `text-foreground`, `text-muted-foreground`, `bg-primary`,
  `text-primary-foreground`, `bg-primary-soft`, `bg-primary-hover`,
  `border-border`, `bg-destructive`, `text-destructive`, `ring-ring`.
  Están mapeados en `@theme inline` de `globals.css`.
- Respetar `data-mode` y `data-theme`. Un estilo que solo se ve bien
  en violet oscuro está mal. No fijes `oklch(...)` ni hex en un
  componente de producto.
- Componer clases con `cn()`. Variantes de un primitivo, con `cva`,
  como `src/components/ui/button.tsx`.
- Reutilizar `src/components/ui/` antes de crear otro botón, input,
  diálogo o tabla. Iconos solo de `lucide-react`.
- Páginas autenticadas dentro de `(dashboard)`, para heredar
  `DashboardShell`. No dupliques sidebar ni header.
- Padding de página: el `main` ya tiene `p-4 sm:p-6`. Una página no
  añade otro `p-8` de página completa salvo un layout interno que lo
  necesite (el hilo de la bandeja es un caso propio).
- Foco visible en controles nuevos:
  `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`,
  igual que `button.tsx` / `input.tsx`.
- Acciones según rol con `useCan` (`src/hooks/use-can.ts`) o
  `RequireRole` (`src/components/auth/require-role.tsx`). `useCan`
  devuelve `false` mientras carga el perfil: no flashes de “puedes”.
- Textos de UI en inglés, como el resto del producto
  (`Loading...`, `Read-only`, `24-hour session expired`).
- Formularios: estados disabled, error e inválido
  (`aria-invalid:border-destructive` ya está en los primitivos).
- Client components solo si hay estado, efectos o eventos. El layout
  de dashboard es servidor a propósito para poder exportar `metadata`.

## SHOULD

- Densidad de la bandeja y de ajustes, no de landing. Mira
  `src/components/inbox/` y `src/components/settings/` antes de inventar
  un bloque.
- Chips de rol: reutiliza la idea de `ROLE_CHIP` en
  `src/components/layout/sidebar.tsx` (owner ámbar, admin primary,
  agent neutro, viewer apagado). No inventes un color de rol.
- Estados de broadcast y de plantilla: `src/lib/broadcast-status.ts` y
  `src/lib/template-status.ts`, no un `switch` de colores nuevo.
- Vacío: `src/components/dashboard/empty-state.tsx` como referencia de
  tono, no como obligación de copiar el markup.
- Gráficas: lo que ya hay en `src/components/dashboard/` y
  `src/components/tremor/` (Recharts). No añadas otra librería de charts.
- Listas largas de la bandeja: mantén el patrón de la página, no
  metas un virtualizador nuevo sin que el problema esté medido.
- Animación nueva con `motion-reduce:animate-none`. El spinner de
  carga del shell no lo tiene; no lo copies como excusa.
- Touch targets en `< lg`: el header ya abre el cajón. Un icon button
  usa los tamaños `icon` / `icon-sm` del `Button`, no un `div` con
  `onClick`.
- Orden de clases: déjalo a Prettier (`prettier-plugin-tailwindcss`).

## NEVER

- Gradientes violetas, glow, glass, malla, sombras de neón, kit crema
  `#D97757`, cejas en ALL-CAPS (`uppercase tracking-widest` como
  etiqueta decorativa).
- Una segunda fuente (Roboto, otra de Google Fonts, un display). Inter
  ya está cableada a `--font-sans`. No cargues Geist Mono: el token
  `--font-mono` apunta a una variable que el layout no define.
- Hex o `rgb()` sueltos en componentes de producto. Excepción ya
  existente: el swatch de `src/lib/themes.ts`, que debe seguir
  coincidiendo con `--primary` del mismo tema.
- Cards idénticas en rejilla (icono en círculo, título, texto, CTA)
  para llenar un dashboard.
- `dangerouslySetInnerHTML` para contenido de mensajes, notas o
  plantillas. El único uso aceptado es el script `theme-boot`.
- Datos reales de clientes en stories, placeholders o capturas: ni
  teléfonos ni texto de chats.
- Lógica de envío a Meta, descifrado o service role dentro de un
  componente cliente. Eso vive en `src/lib` y en route handlers.
- Comparar roles a mano (`role === "admin"`) en JSX. Usa `useCan`.
- Desactivar el anillo de foco con `outline-none` sin reemplazarlo.
- Introducir Radix u otra capa de primitivos al lado de Base UI /
  shadcn ya vendidos en `src/components/ui/`.

## Composición mínima de una página de dashboard

```tsx
export default function ExamplePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-medium text-foreground">Example</h1>
      {/* contenido: bg-card, border-border, text-sm */}
    </div>
  );
}
```

El ejemplo es el tono, no una plantilla para clonar en cada ruta.
Si la página necesita datos de servidor, cógelos en el server
component y pasa props serializables. No pases el cliente de Supabase
ni un token al cliente.

## Checklist rápido antes de cerrar el PR

- [ ] Se ve en modo oscuro y claro (`wacrm.mode`).
- [ ] Se ve con un acento que no sea violet.
- [ ] Teclado: el foco se ve en los controles nuevos.
- [ ] Ancho ~375 px: el cajón cierra y no hay scroll horizontal.
- [ ] Un viewer no dispara la acción de escritura.
- [ ] `npm run lint` y typecheck no protestan por el TSX.
