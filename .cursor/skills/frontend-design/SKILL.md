---
name: frontend-design
description: >-
  Úsala antes de maquetar o rediseñar una pantalla de wacrm (bandeja,
  ajustes, embudos, auth). Andrés el Diseñador escribe el plan visual;
  Camila Frontend lo implementa; Catalina Producto UX lo contrasta con
  el flujo. Exige plan con colores, tipos y wireframe antes de codificar.
---

# Diseño de interfaz — wacrm

Andrés el Diseñador dirige el plan. Camila Frontend lo convierte en
componentes con `baseline-ui`. Catalina Producto UX comprueba que el
flujo (agente, admin, viewer) se entiende. No se escribe JSX de una
pantalla nueva hasta que el plan de esta skill pasa la revisión
contra el encargo.

Adaptado de la skill pública frontend-design de Anthropic, licencia
Apache-2.0. El sistema visual es el de este repo, no un tema nuevo.

## Lo que ya existe

- Tailwind v4, tokens en `src/app/globals.css`, catálogo en
  `src/lib/themes.ts`.
- Dos ejes: `data-mode` (`dark` por defecto, `light`) y `data-theme`
  (`violet` por defecto, también `emerald`, `cobalt`, `amber`,
  `rose`). El acento solo pinta `--primary` y afines. Las superficies
  neutras vienen del modo.
- Fuente única cargada: Inter, `next/font/google`, variable
  `--font-sans` en `src/app/layout.tsx`. `--font-heading` apunta a esa
  misma variable. `--font-mono` referencia `--font-geist-mono`, que
  **no** se carga en el layout: no la uses como si estuviera.
- Shell: `src/app/(dashboard)/dashboard-shell.tsx` + `Sidebar` +
  `Header`. En `< lg` el sidebar es cajón; desde `lg` queda fijo.
  `main` usa `p-4 sm:p-6`.
- Primitivos: `src/components/ui/` (shadcn `base-nova`, Base UI en el
  botón, `cva`, `cn`). Iconos: `lucide-react`. Avisos: `sonner` vía
  `ThemedToaster`.
- Arranque sin flash: script `theme-boot` en el layout, claves
  `wacrm.theme` y `wacrm.mode`.

La app ya eligió Inter y un acento violeta por defecto. No añadas una
segunda familia, ni un gradiente violeta, ni un tema paralelo “más de
marca”. El trabajo es encajar en este shell.

## Plan obligatorio (antes de codificar)

Escríbelo en el PR o en el mensaje de trabajo. Cuatro a seis colores
con nombre, tomados de los tokens de abajo (hex aproximado del
`oklch` de `globals.css`; en código se usan las utilidades, no el
hex). Roles de tipo. Wireframe ASCII. Principios. Luego la revisión
contra el encargo.

### Colores con nombre (modo oscuro + acento violet, el default)

| Nombre | Hex aprox. | Token |
| --- | --- | --- |
| Noche | `#05070b` | `--background` en `html[data-mode="dark"]` (`oklch(0.13 0.01 260)`) |
| Carbón | `#0f1216` | `--card` (`oklch(0.18 0.01 260)`) |
| Niebla | `#fafafa` | `--foreground` (`oklch(0.985 0 0)`) |
| Señal | `#7834e8` | `--primary` del tema `violet` (`oklch(0.526 0.247 293)`) |
| Ámbar de espera | `#f0941d` | acento `amber` (`oklch(0.745 0.16 65)`); la UI de sesión caducada ya usa ámbar |
| Alerta | `#e7000b` | `--destructive` (`oklch(0.577 0.245 27.325)`) |

Modo claro, por si el encargo lo menciona: fondo Papel `#fbfcfd`
(`oklch(0.99 0.002 260)`), texto Tinta `#16181d`
(`oklch(0.21 0.01 260)`). No son un séptimo color de marca: son el
otro modo. `viewport.themeColor` del layout es `#020617`.

En implementación: `bg-background`, `bg-card`, `bg-card-2`,
`text-foreground`, `text-muted-foreground`, `bg-primary`,
`bg-primary-soft`, `border-border`, `text-destructive`. Nada de hex
nuevo en un `className`.

### Roles de tipo

| Rol | Tratamiento |
| --- | --- |
| Interfaz | Inter ya cargada, `font-sans`. Controles `text-sm font-medium` (el `Button`) |
| Cuerpo | `text-sm` en paneles densos (bandeja, ajustes). Inputs `text-base` bajo `md` y `md:text-sm`, como `src/components/ui/input.tsx` |
| Meta | `text-xs text-muted-foreground`. Horas, hints, “24-hour session expired” |
| Título de página | misma sans, peso medio, color `text-foreground`. No hay display face |
| Métrica | la misma sans. No introduzcas mono: la variable Geist no está cargada |

### Wireframe del shell (las pantallas nuevas caben aquí)

```
lg y más
┌──────────────┬───────────────────────────────┐
│ Sidebar      │ Header                        │
│ marca + rol  │ (en <lg: botón del cajón)     │
│ Dashboard    ├───────────────────────────────┤
│ Inbox        │ main                          │
│ …            │ p-4  /  sm:p-6                │
│ Settings     │ overflow-y-auto               │
└──────────────┴───────────────────────────────┘

< lg
┌───────────────────────────────┐
│ Header [≡]                    │
├───────────────────────────────┤
│ main (ancho completo)         │
└───────────────────────────────┘
el sidebar es cajón sobre la página, no una segunda columna
```

Bandeja (`/inbox`): lista de conversaciones | hilo | ficha del
contacto. No la conviertas en tres cards idénticas. Ajustes: rail
`settings-rail.tsx` + panel, no un grid de tiles iguales.

### Principios

1. Densidad de herramienta, no de landing. El usuario es un agente
   contestando WhatsApp.
2. Un acento (el `data-theme` elegido). El resto es neutro del modo.
3. Estado vacío, carga y error visibles. El shell ya tiene un spinner
   a pantalla completa mientras `useAuth` resuelve.
4. Viewer es de solo lectura: `useCan` deshabilita, no esconde sin
   explicación (el hook existe para el tooltip “Read-only”).
5. Inglés en la UI. El plan puede escribirse en español.

### Revisión del plan contra el encargo

Antes de codificar, Andrés el Diseñador marca sí o no:

- ¿El encargo cabe en el shell, o pide una página fuera de
  `(dashboard)` (auth, join)?
- ¿Los colores del plan son los seis de la tabla, no una paleta nueva?
- ¿Hay un solo título real, sin cejas en mayúsculas?
- ¿El flujo de Catalina Producto UX (quién pulsa, qué pasa si es
  viewer, qué pasa si la ventana de 24 h cerró) está en el wireframe?
- ¿El plan evita la lista de anti-patrones de abajo?

Si una respuesta es no, se reescribe el plan. No se “adelanta” el JSX.

## Anti-patrones (no usarlos en pantallas nuevas)

Aunque el acento por defecto sea violeta y la fuente sea Inter:

- Gradientes violetas, mallas, glow, sombras de neón.
- Un segundo sans (Roboto u otro) o un display “distintivo”.
- Kits crema con `#D97757`.
- Rejilla de cards redondeadas idénticas con icono + título + párrafo.
- Cejas en ALL-CAPS encima de cada sección (`TRACKING-WIDEST`).
- Glassmorphism, bordes de un píxel con gradiente, hero de marketing
  dentro del dashboard.

Inter se queda porque ya es la fuente del producto. No la vuelvas a
“elegir” ni la cambies en un PR visual.

## Suelo de calidad

- **Responsive.** Prueba el cajón `< lg` y la columna `lg`. El padding
  del `main` no se sustituye por `p-8` fijo.
- **Foco visible.** Los primitivos ya llevan
  `focus-visible:ring-3 focus-visible:ring-ring/50` (ver `button.tsx`).
  Un control nuevo no puede quedarse en `outline-none` sin anillo.
- **Movimiento reducido.** No hay un `@media (prefers-reduced-motion)`
  global. El spinner de `dashboard-shell.tsx` usa `animate-spin` sin
  esa guarda. El código nuevo que anime debe desactivarse con
  `motion-reduce:animate-none` (o equivalente). No hace falta
  reescribir el spinner viejo en un PR que no lo toca.
- **Contraste.** Texto de meta con `text-muted-foreground` sobre
  `bg-background` / `bg-card`, no gris sobre `bg-primary-soft`. El
  texto sobre `bg-primary` es `text-primary-foreground`.

## Crítica final (después de implementar)

Camila Frontend la recorre; Andrés el Diseñador la firma:

- [ ] Solo tokens del tema, funciona en oscuro y en claro y con otro
      `data-theme` que no sea violet.
- [ ] Sin gradiente, glow, crema `#D97757`, cejas en mayúsculas ni
      grid de cards clónicas.
- [ ] Foco visible por teclado en cada control nuevo.
- [ ] `motion-reduce` en animaciones nuevas.
- [ ] En `< lg` no se corta el sidebar ni el compositor.
- [ ] Viewer no puede activar la acción primaria.
- [ ] Cadenas de UI en inglés, alineadas con la pantalla vecina.
- [ ] Nada de teléfonos o mensajes reales en capturas del PR.
