# Monolith

Prywatne narzędzie do zarządzania zadaniami i notatkami w stylu Notion. Każdy byt w systemie jest **blokiem** — zadanie na Kanbanie jest jednocześnie stroną z edytowalną treścią.

## Stack

- **Next.js 16+** (App Router, React 19, Turbopack)
- **TypeScript** strict mode
- **Tailwind CSS v4** + **shadcn/ui**
- **Supabase** (PostgreSQL, Auth, RLS)
- **Drizzle ORM** (type-safe queries, migracje)
- **TanStack React Query** (server state, optimistic updates)
- **Zustand** (UI state)
- **@dnd-kit** (drag & drop na Kanbanie)
- **BlockNote** (edytor blokowy Notion-like)

## Funkcjonalności

- Rejestracja i logowanie (email + Google OAuth)
- Auto-tworzenie workspace po rejestracji (Prywatna / Służbowa)
- Zapraszanie członków do workspace z rolami (owner / admin / member)
- **Kanban board** — kolumny Todo / In Progress / Done, drag & drop kart z optimistic update
- **Przypisywanie zadań** — selector członków workspace, avatar w karcie, filtr "Moje zadania"
- **Otwieranie zadania** jako pełna strona z edytorem blokowym (BlockNote)
- **Kalendarz** — widok miesięczny z zadaniami po `due_date`
- **Notatki** — drzewo stron z edytorem (tekst, nagłówki, checklisty, listy)
- Sidebar z workspace switcherem, listą projektów i drzewem stron
- Pełne CRUD dla zadań i notatek
- Filtrowanie i sortowanie kart (priorytet, przypisanie, termin)
- Row Level Security — twarda izolacja danych między workspace

## Uruchomienie

### Wymagania

- Node.js 20+
- Konto Supabase (lub lokalna instancja)

### Instalacja

```bash
git clone https://github.com/YouChill/getmonolith.git
cd getmonolith
npm install
```

### Zmienne środowiskowe

Skopiuj `.env.local.example` do `.env.local` i uzupełnij:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=         # URL projektu Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Klucz anon (publiczny)
SUPABASE_SERVICE_ROLE_KEY=        # Klucz service role (tylko serwer)
DATABASE_URL=                     # Connection string do PostgreSQL (pooler, transaction mode)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Baza danych

```bash
npm run db:generate   # Generuj migracje z Drizzle schema
npm run db:migrate    # Zastosuj migracje
```

### Development

```bash
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm start
```

## Struktura projektu

```
src/
├── app/
│   ├── (auth)/login, /register
│   ├── (dashboard)/[workspaceSlug]/
│   │   ├── board/[projectId]         # Kanban
│   │   ├── calendar                  # Kalendarz
│   │   ├── notes                     # Drzewo stron
│   │   ├── block/[blockId]           # Widok bloku (zadanie/strona)
│   │   └── settings/members          # Zarządzanie członkami
│   └── api/                          # Route Handlers (mutacje)
├── components/
│   ├── ui/          # shadcn/ui + prymitywy
│   ├── board/       # KanbanBoard, KanbanColumn, KanbanCard
│   ├── calendar/    # CalendarGrid, CalendarEvent
│   ├── editor/      # BlockNoteEditor
│   ├── block/       # BlockPage
│   └── layout/      # Sidebar, WorkspaceSwitcher, Navbar
├── lib/
│   ├── supabase/    # createServerClient, createBrowserClient
│   ├── db/          # Drizzle schema + migracje
│   ├── hooks/       # useWorkspace, itp.
│   ├── utils/       # cn(), safeJson()
│   ├── react-query/ # Query keys
│   └── stores/      # Zustand stores
└── types/           # Globalne typy TS
```

## Komendy

| Komenda | Opis |
|---|---|
| `npm run dev` | Serwer deweloperski (Turbopack) |
| `npm run build` | Build produkcyjny |
| `npm start` | Serwer produkcyjny |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generuj migracje Drizzle |
| `npm run db:migrate` | Zastosuj migracje |
| `npm run db:studio` | Drizzle Studio (GUI do bazy) |

## Dokumentacja

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — model danych, RLS, API patterns, optimistic updates
- [docs/DESIGN.md](docs/DESIGN.md) — paleta kolorów, typografia, specyfikacja komponentów, Tailwind config

## Licencja

Projekt prywatny.
