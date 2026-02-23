# Monolith — Claude Code Instructions

> Prywatne narzędzie do zarządzania zadaniami i notatkami w stylu Notion.
> Każdy byt w systemie jest **blokiem** — zadanie na Kanbanie jest jednocześnie stroną z edytowalną treścią.

## Quick Reference

- **Stack:** Next.js 14+ (App Router) · TypeScript strict · Tailwind CSS · shadcn/ui · Supabase · Drizzle ORM
- **GitHub Issues:** `gh issue list` — pracuj issue po issue, milestone po milestone
- **Docs:** `docs/ARCHITECTURE.md` (model danych, API, konwencje) · `docs/DESIGN.md` (paleta, typografia, komponenty)
- **Env:** `.env.local` — patrz `.env.local.example`

## Zasady nadrzędne

1. **Generuj pełne pliki** — nigdy `// reszta bez zmian` ani `...`
2. **Unified block model** — wszystko jest blokiem (`blocks` table). NIE twórz osobnych tabel/endpointów dla tasks i pages
3. **TypeScript strict** — brak `any`, wszystkie typy jawnie zdefiniowane
4. **Server Components domyślnie** — `'use client'` tylko dla interakcji, hooków, DnD, edytora
5. **Optimistic updates obowiązkowo** na każdej mutacji (Kanban, edytor, properties)
6. **RLS przez workspace_members** — nigdy `user_id = auth.uid()` bezpośrednio na blocks
7. **Error handling** — `Result`-style `{ data, error }`, nigdy niezłapane `throw`
8. **Dark-only UI** — brak light mode, pisz dark-first (bez `dark:` prefix)
9. **Kolory przez tokeny** — `bg-bg-surface`, `text-content-muted`, nie hardcode zinc/slate
10. **shadcn/ui jako baza** — rozszerzaj className, nie buduj od zera

## Struktura katalogów

```
/app
  /(auth)/login, /register
  /(dashboard)/[workspaceSlug]
    /board/[projectId]          # Kanban
    /calendar                   # Kalendarz
    /notes                      # Drzewo stron
    /block/[blockId]            # Widok bloku (zadanie lub strona)
    /settings/members           # Zarządzanie członkami
/components
  /ui          # shadcn/ui + prymitywy
  /board       # KanbanBoard, KanbanColumn, KanbanCard
  /calendar    # CalendarGrid, CalendarEvent
  /editor      # BlockNoteEditor
  /block       # BlockPage
  /layout      # Sidebar, WorkspaceSwitcher, Navbar
/lib
  /supabase    # createServerClient, createBrowserClient
  /db          # Drizzle schema + migracje
  /hooks       # useOptimisticTask, useWorkspace, itp.
  /utils
  /query       # React Query keys + prefetch helpers
/types         # Globalne typy TS
```

## Kluczowe konwencje

- **Pliki:** `kebab-case.tsx`, komponenty `PascalCase`
- **Supabase SSR:** zawsze `createServerClient` z `@supabase/ssr` w RSC i Route Handlers
- **Route Handlers** dla mutacji (POST/PATCH/DELETE); odczyty w RSC przez Supabase
- **Drizzle:** zmiany schematu → `drizzle-kit generate` → osobny plik migracji
- **Kanban kolumny MVP:** statyczne `todo | in_progress | done`
- **Biblioteki:** `@dnd-kit` (DnD), `@blocknote/react` (edytor), `zustand` (UI state), `@tanstack/react-query` (server state)

## Workflow

1. Przeczytaj issue: `gh issue view <nr>`
2. Implementuj zgodnie z docs/ARCHITECTURE.md i docs/DESIGN.md
3. Sprawdź: `npm run build` (brak błędów TS)
4. Commituj i zamknij: `git add . && git commit -m "feat: opis (#nr)" && gh issue close <nr>`

## Pełna dokumentacja

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — model danych SQL, RLS, API patterns, optimistic updates, zmienne środowiskowe
- **[docs/DESIGN.md](docs/DESIGN.md)** — paleta kolorów, typografia, spacing, specyfikacja komponentów, Tailwind config, animacje
