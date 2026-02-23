# Design Guidelines — Monolith

## Kierunek estetyczny

**Hasło:** *Refined darkness* — narzędzie które znika, żebyś mógł myśleć.

Inspiracja: Linear, Vercel Dashboard, Raycast. Ciemny interfejs to zamierzony wybór estetyczny. Głęboka grafitowa skala zamiast czerni. Elementy interaktywne mają subtelny blask, nie krzyczą kolorami.

**Zasady:**
- Mniej elementów, więcej przestrzeni
- Kolor = informacja (nie dekoracja)
- Animacje są funkcjonalne, nie ozdobne
- Typografia niesie hierarchię
- **Zawsze dark** — brak light mode w MVP, pisz dark-first (bez `dark:` prefix)

---

## Paleta kolorów

### Skala szarości (tło, powierzchnie, obramowania)

| Token (Tailwind) | Hex | Użycie |
|---|---|---|
| `bg-bg-base` | `#0a0a0b` | Główne tło aplikacji |
| `bg-bg-subtle` | `#111113` | Sidebar, panele boczne |
| `bg-bg-surface` | `#18181b` | Karty, modale, kafelki |
| `bg-bg-elevated` | `#1f1f23` | Hover states, dropdown |
| `bg-bg-overlay` | `#27272a` | Popovery, tooltips |
| `border-border-subtle` | `#27272a` | Subtelne linie podziału |
| `border-border-default` | `#3f3f46` | Standardowe obramowania |
| `border-border-strong` | `#52525b` | Aktywne / fokus |

### Tekst

| Token | Hex | Użycie |
|---|---|---|
| `text-content-primary` | `#fafafa` | Nagłówki, ważne dane |
| `text-content-secondary` | `#a1a1aa` | Opisy, metadane |
| `text-content-muted` | `#71717a` | Placeholdery, disabled |

### Akcent (primary action)

| Token | Hex | Użycie |
|---|---|---|
| `bg-accent` / `text-accent` | `#e2e8f0` | Primary buttons, active links |
| `bg-accent-hover` | `#f8fafc` | Hover |
| `bg-accent-muted` | `#e2e8f020` | Ghost backgrounds |

### Kolory semantyczne

```
Status:     todo #3f3f46 · in-progress #1d4ed8 · done #15803d
Priority:   high #dc2626 · mid #d97706 · low #52525b
System:     success #22c55e · warning #f59e0b · error #ef4444 · info #3b82f6
Workspace:  personal #7c3aed (fiolet) · work #0ea5e9 (błękit)
```

Kolor workspace pojawia się **tylko** jako: kropka w WorkspaceSwitcher, border-left aktywnego sidebar item, badge roli.

**WAŻNE:** Używaj tokenów (`bg-bg-surface`, `text-content-muted`), nie hardcode Tailwind zinc/slate.

---

## Typografia

### Krój pisma

```typescript
// app/layout.tsx
import { Geist, Geist_Mono } from 'next/font/google';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });
```

### Skala

| Token | Rozmiar | Użycie |
|---|---|---|
| `text-xs` | 11px/1.5 | Metadane, timestamps, badges |
| `text-sm` | 13px/1.5 | Body, opisy, sidebar items |
| `text-base` | 15px/1.6 | Domyślny tekst |
| `text-lg` | 17px/1.5 | Podtytuły sekcji |
| `text-xl` | 20px/1.4 | Tytuły kart, nagłówki sekcji |
| `text-2xl` | 24px/1.3 | Tytuły stron |
| `text-3xl` | 30px/1.2 | Tytuł bloku/zadania |

### Wagi

```
font-normal (400)   — body text, opisy
font-medium (500)   — UI labels, sidebar items, metadane
font-semibold (600) — tytuły kart, nazwy projektów
font-bold (700)     — page titles (sparingly)
```

**Hierarchia przez kolor** (`primary`/`secondary`/`muted`), nie przez rozmiar.

---

## Spacing & Layout

Zasada **4px grid** (Tailwind: `p-1` = 4px, `p-2` = 8px).

### Szerokości

```
Sidebar:              240px (--sidebar-width)
Sidebar zwinięty:      56px
Panel properties:     280px (prawy panel BlockPage)
Max treść:            720px (edytor, notatki)
Min app:              768px (brak mobile w MVP)
```

### Padding komponentów

```
KanbanCard:    p-3 (12px)
Modal:         p-6 (24px)
Sidebar item:  px-3 py-1.5
Page content:  px-8 py-6 (max-w-[720px] mx-auto)
Navbar:        px-4 h-12
```

---

## Specyfikacja komponentów

### KanbanCard

```
Tło:           bg-bg-surface
Border:        border border-border-subtle
Radius:        rounded-lg (8px)
Hover:         bg-bg-elevated, border-border-default
Drag active:   rotate-1, shadow-xl, opacity-90

Wewnątrz:
  Tytuł:       text-sm font-medium text-content-primary
  Metadane:    text-xs text-content-muted, mt-2
  Avatar:      w-5 h-5 rounded-full, right-aligned
  Priority:    w-1.5 h-1.5 rounded-full, lewy górny róg
```

### KanbanColumn

```
Tytuł:         text-xs font-semibold uppercase tracking-widest text-content-muted
Counter:       text-xs bg-bg-elevated px-1.5 py-0.5 rounded
Separator:     border-b border-border-subtle mb-3
Karty:         space-y-2, min-h-[200px]
Szerokość:     280px (fixed)
```

### Sidebar

```
Tło:           bg-bg-subtle
Border:        border-r border-border-subtle
Item aktywny:  bg-bg-elevated, border-l-2 border-[workspace-color]
Item hover:    bg-bg-elevated
Item padding:  px-3 py-1.5
Ikony:         w-4 h-4 text-content-muted
Tekst:         text-sm
Sekcja label:  text-xs uppercase tracking-wider text-content-muted px-3 pt-4 pb-1
```

### Przyciski (shadcn/ui override)

```
Primary:       bg-accent text-[#09090b] hover:bg-accent-hover, h-8 px-3 rounded-md
Secondary:     bg-transparent border border-border-default hover:bg-bg-elevated, text-content-secondary
Destructive:   bg-transparent text-[#ef4444] hover:bg-red-950/30
Icon only:     w-8 h-8 rounded-md
```

### Inputy

```
Border:        border border-border-default
Tło:           bg-bg-surface
Focus:         ring-1 ring-border-strong, border-border-strong
Placeholder:   text-content-muted
Height:        h-9, rounded-md (6px)
```

### Badge statusu

```
todo:          bg-zinc-800 text-zinc-400
in_progress:   bg-blue-950 text-blue-400
done:          bg-green-950 text-green-400
Rozmiar:       text-xs px-2 py-0.5 rounded-full font-medium
```

---

## Animacje

- **150ms** hover/focus · **200ms** wejście komponentów · **300ms** modale
- Easing: `ease-out` wejście, `ease-in` wyjście
- Żadnych animacji przy drag & drop
- Autosave: fade-in/out, nie migać

```
transition-colors duration-150     — hover karty, linki
transition-all duration-200        — expand/collapse sidebar
animate-in fade-in-0 duration-200  — modale, dropdown (shadcn built-in)
```

### Micro-interactions

```
KanbanCard hover:     translateY(-1px), shadow wzrasta
Sidebar item hover:   padding-left +2px
Button press:         scale-[0.98]
Saving indicator:     animate-pulse dot
```

---

## Ikony

**Lucide React** (wbudowane w shadcn/ui). Zawsze z jawnym rozmiarem.

```
w-3.5 h-3.5 (12px) — inline, badges
w-4 h-4    (16px)  — sidebar, karty (default)
w-5 h-5    (20px)  — navbar, przyciski akcji
w-6 h-6    (24px)  — empty states
```

Kolor: zawsze `currentColor`. Ikony projektów mogą być emoji (`text-base leading-none`).

---

## Spójność radiusu

```
rounded-md   (6px)  — inputy, buttony
rounded-lg   (8px)  — karty, powierzchnie
rounded-full         — avatary, badge'y
```

---

## Tailwind config

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base:     '#0a0a0b',
          subtle:   '#111113',
          surface:  '#18181b',
          elevated: '#1f1f23',
          overlay:  '#27272a',
        },
        border: {
          subtle:  '#27272a',
          default: '#3f3f46',
          strong:  '#52525b',
        },
        content: {
          primary:   '#fafafa',
          secondary: '#a1a1aa',
          muted:     '#71717a',
        },
        accent: {
          DEFAULT: '#e2e8f0',
          hover:   '#f8fafc',
          muted:   'rgb(226 232 240 / 0.08)',
        },
        status: {
          todo:        '#3f3f46',
          'in-progress': '#1d4ed8',
          done:        '#15803d',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist)', 'ui-sans-serif', 'system-ui'],
        mono: ['var(--font-geist-mono)', 'ui-monospace'],
      },
      fontSize: {
        xs:   ['11px', { lineHeight: '1.5' }],
        sm:   ['13px', { lineHeight: '1.5' }],
        base: ['15px', { lineHeight: '1.6' }],
        lg:   ['17px', { lineHeight: '1.5' }],
        xl:   ['20px', { lineHeight: '1.4' }],
        '2xl': ['24px', { lineHeight: '1.3' }],
        '3xl': ['30px', { lineHeight: '1.2' }],
      },
      spacing: {
        sidebar: '240px',
        'sidebar-collapsed': '56px',
        'panel': '280px',
      },
    },
  },
};

export default config;
```

---

## globals.css — shadcn/ui override

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background:    10 10 11;
    --foreground:    250 250 250;
    --card:          24 24 27;
    --card-foreground: 250 250 250;
    --popover:       39 39 42;
    --popover-foreground: 250 250 250;
    --primary:       226 232 240;
    --primary-foreground: 9 9 11;
    --secondary:     39 39 42;
    --secondary-foreground: 161 161 170;
    --muted:         24 24 27;
    --muted-foreground: 113 113 122;
    --accent:        31 31 35;
    --accent-foreground: 250 250 250;
    --destructive:   239 68 68;
    --destructive-foreground: 250 250 250;
    --border:        63 63 70;
    --input:         24 24 27;
    --ring:          82 82 91;
    --radius:        0.375rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-bg-base text-content-primary font-sans antialiased;
  }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { @apply bg-border-default rounded-full; }
  ::-webkit-scrollbar-thumb:hover { @apply bg-border-strong; }
}
```

---

## Zasady dla Claude — podsumowanie

1. Kolory **wyłącznie przez tokeny** — `bg-bg-surface`, `text-content-muted`, nie hardcode zinc/slate
2. **shadcn/ui jako fundament** — rozszerzaj `className`, nie buduj od zera
3. **Żadnych box-shadow na ciemnych powierzchniach** — używaj `border` dla separacji warstw
4. **Ikony Lucide** — zawsze z `className="w-4 h-4"`, nigdy bez rozmiaru
5. **Animacje** — tylko `transition-colors duration-150` lub `transition-all duration-200`. Brak `animate-bounce`
6. **Radius:** `rounded-md` inputy/buttony · `rounded-lg` karty · `rounded-full` avatary/badge'y
7. **Tekst** — hierarchia przez kolor, nie przez rozmiar
