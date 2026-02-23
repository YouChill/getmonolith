# Architecture — Monolith

## Stack technologiczny

| Warstwa | Technologia | Uwagi |
|---|---|---|
| Frontend | Next.js 14+ (App Router) | TypeScript strict, RSC domyślnie |
| Styling | Tailwind CSS + shadcn/ui | Spójny system komponentów |
| State / server | TanStack React Query | Mutacje z optimistic updates |
| State / UI | Zustand | Lokalny stan UI (sidebar, modal, drag) |
| Backend/API | Next.js Route Handlers `/app/api/` | Mutacje; odczyty przez Supabase w RSC |
| Baza danych | Supabase (PostgreSQL) | RLS, Auth, Realtime opcjonalnie |
| ORM | Drizzle ORM | Type-safe queries, migracje przez drizzle-kit |
| Auth | Supabase Auth | Email + Google OAuth |
| Hosting | Vercel | Edge Functions jeśli potrzeba |
| Edytor bloków | BlockNote (`@blocknote/react`) | Notion-like UI out of the box |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable | Kanban cards, block reordering |

---

## Model danych — Unified Block Architecture

Wszystko jest blokiem. Zadanie to blok z `type = 'task'`. Strona to blok z `type = 'page'`. Bloki mogą mieć dzieci (zagnieżdżone bloki), co umożliwia otwieranie zadania jako pełną stronę z treścią.

```sql
-- Przestrzenie robocze
CREATE TABLE workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  type        text NOT NULL CHECK (type IN ('personal', 'work')),
  owner_id    uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now()
);

-- Członkowie workspace (multi-user od MVP)
CREATE TABLE workspace_members (
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  invited_at    timestamptz DEFAULT now(),
  accepted_at   timestamptz,
  PRIMARY KEY (workspace_id, user_id)
);

-- Projekty / tablice Kanban wewnątrz workspace
CREATE TABLE projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          text NOT NULL,
  icon          text,
  color         text,
  created_at    timestamptz DEFAULT now()
);

-- Unified block model — serce systemu
CREATE TABLE blocks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_block_id uuid REFERENCES blocks(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,

  type            text NOT NULL,
  -- Typy bloków:
  -- 'task'            — karta Kanban, otwieralna jako strona
  -- 'page'            — dokument/notatka
  -- 'text'            — akapit (dziecko page/task)
  -- 'heading1/2/3'
  -- 'todo'            — checkbox
  -- 'bulleted_list', 'numbered_list'
  -- 'divider', 'image', 'code'

  -- Właściwości specyficzne dla typu
  properties      jsonb NOT NULL DEFAULT '{}',
  -- task:  { "status": "todo", "due_date": "2026-03-01", "priority": "high", "assigned_to": "uuid" }
  -- page:  { "icon": "📄", "cover": "url" }
  -- heading1: { "text": "Mój nagłówek" }

  -- Treść rich-text (BlockNote JSON) — głównie dla page i task jako strona
  content         jsonb,

  position        float NOT NULL DEFAULT 0,   -- kolejność wśród rodzeństwa
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Indeksy krytyczne dla wydajności
CREATE INDEX idx_blocks_workspace    ON blocks(workspace_id);
CREATE INDEX idx_blocks_parent       ON blocks(parent_block_id);
CREATE INDEX idx_blocks_project      ON blocks(project_id);
CREATE INDEX idx_blocks_type         ON blocks(type);
CREATE INDEX idx_blocks_due_date     ON blocks((properties->>'due_date')) WHERE type = 'task';
CREATE INDEX idx_blocks_status       ON blocks((properties->>'status')) WHERE type = 'task';

-- Tagi
CREATE TABLE tags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          text NOT NULL,
  color         text NOT NULL
);

CREATE TABLE block_tags (
  block_id  uuid NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  tag_id    uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (block_id, tag_id)
);
```

---

## Row Level Security (RLS)

Dostęp kontrolowany przez `workspace_members` — nigdy bezpośrednio przez `user_id` na tabeli. Izolacja między przestrzeniami jest twarda.

```sql
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Członek workspace widzi bloki"
ON blocks FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
  )
);

CREATE POLICY "Członek workspace tworzy bloki"
ON blocks FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
  )
);

-- Analogicznie: polityki UPDATE i DELETE
-- Owner/admin mogą usuwać bloki innych; member tylko swoje — do doprecyzowania w implementacji
```

---

## Kanban — kolumny statusów (MVP)

Kolumny statyczne. Status w `blocks.properties->>'status'`.

```typescript
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
  done:        'Done',
};
```

Dynamiczne kolumny — Milestone 2.

---

## Optimistic Updates — obowiązkowy pattern

Każda mutacja na blokach musi mieć optimistic update:

```typescript
const updateTaskStatus = useMutation({
  mutationFn: (vars: { blockId: string; status: TaskStatus }) =>
    api.blocks.updateProperties(vars.blockId, { status: vars.status }),

  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: ['blocks', projectId] });
    const previous = queryClient.getQueryData(['blocks', projectId]);

    queryClient.setQueryData(['blocks', projectId], (old: Block[]) =>
      old.map(b =>
        b.id === vars.blockId
          ? { ...b, properties: { ...b.properties, status: vars.status } }
          : b
      )
    );
    return { previous };
  },

  onError: (_err, _vars, ctx) => {
    queryClient.setQueryData(['blocks', projectId], ctx?.previous);
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['blocks', projectId] });
  },
});
```

---

## Konwencje kodowania

- **TypeScript strict mode** — brak `any`, wszystkie typy jawnie zdefiniowane
- **Server Components** domyślnie; `'use client'` tylko dla interakcji, hooków, DnD, edytora
- **Route Handlers** dla mutacji (POST/PATCH/DELETE); odczyty w RSC bezpośrednio przez Supabase
- **Nazewnictwo plików:** `kebab-case.tsx`, komponenty `PascalCase`
- **Error handling:** `Result`-style zwroty (`{ data, error }`) — nigdy niezłapane `throw`
- **Supabase SSR:** zawsze `createServerClient` z `@supabase/ssr` w RSC i Route Handlers
- **Drizzle:** każda zmiana schematu przez `drizzle-kit generate` + osobny plik migracji
- **Zmienne środowiskowe:** zawsze dokumentowane w komentarzu na górze pliku jeśli wymagane

---

## Zmienne środowiskowe

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # tylko serwer, nigdy NEXT_PUBLIC_
NEXT_PUBLIC_APP_URL=              # np. http://localhost:3000
```

---

## Zakres MVP (Milestone 1)

### Must have:
- Rejestracja i logowanie (Supabase Auth — email + Google)
- Auto-tworzenie dwóch workspace po rejestracji (Prywatna / Służbowa)
- Zapraszanie członków do workspace (rola member)
- Widok **Kanban** — kolumny Todo / In Progress / Done, drag & drop kart z optimistic update
- **Otwieranie zadania** jako pełna strona z edytorem blokowym (BlockNote)
- Widok **Kalendarza** — bloki typu `task` z `due_date` na siatce miesięcznej
- **Notatki** — bloki typu `page` z edytorem (tekst, nagłówki, checklisty, listy)
- Sidebar: workspace switcher, lista projektów, drzewo stron
- Pełne CRUD dla zadań i notatek
- Twarda izolacja danych między workspace na poziomie RLS

### Poza MVP (Milestone 2+):
- Dynamiczne kolumny Kanban
- Widok Timeline (Gantt-like)
- Subtaski (parent_block_id już w schemacie — tylko UI)
- Tagi i filtry zaawansowane
- Komentarze do bloków
- Realtime sync (Supabase Realtime channels)
- Powiadomienia

---

## Instalacja zależności (reference)

```bash
npx create-next-app@latest getmonolith --typescript --tailwind --app
cd getmonolith
npx shadcn@latest init
npm install @supabase/ssr @supabase/supabase-js
npm install drizzle-orm drizzle-kit postgres
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install @blocknote/react @blocknote/core @blocknote/mantine
npm install zustand @tanstack/react-query @tanstack/react-query-devtools
```
