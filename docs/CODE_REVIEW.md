# Code Review — Zgodność z CLAUDE.md / ARCHITECTURE.md / DESIGN.md

**Data:** 2026-02-27
**Scope:** Pełny audyt repozytorium pod kątem dokumentacji projektowej

---

## 1. Struktura projektu

**Ocena: ZGODNA**

Wszystkie wymagane katalogi i trasy istnieją i są poprawnie umieszczone:

- `app/(auth)/login`, `app/(auth)/register`
- `app/(dashboard)/[workspaceSlug]/board/[projectId]`
- `app/(dashboard)/[workspaceSlug]/calendar`
- `app/(dashboard)/[workspaceSlug]/notes`
- `app/(dashboard)/[workspaceSlug]/block/[blockId]`
- `app/(dashboard)/[workspaceSlug]/settings/members`
- `components/ui`, `components/board`, `components/calendar`, `components/editor`, `components/block`, `components/layout`
- `lib/supabase`, `lib/db`, `lib/hooks`, `lib/stores`, `lib/react-query`

**Drobne uwagi:**
- 🟢 `src/lib/types/` zamiast `src/types/` — drobne odchylenie, funkcjonalnie OK
- 🟢 `src/app/blocknote-test/page.tsx` — plik testowy, do usunięcia przed produkcją

---

## 2. Supabase SSR

**Ocena: W PEŁNI ZGODNA (28/28 plików)**

| Kategoria | Poprawne |
|---|---|
| `lib/supabase/server.ts` | `createServerClient` z `@supabase/ssr` |
| `lib/supabase/client.ts` | `createBrowserClient` z `@supabase/ssr` |
| `lib/supabase/admin.ts` | `createClient` z `@supabase/supabase-js` (celowe — service role) |
| Wszystkie Route Handlers (8) | `createServerClient` |
| Wszystkie Server Components (12) | `createServerClient` |
| Wszystkie Client Components (2) | `createBrowserClient` |
| Middleware | `createServerClient` z `@supabase/ssr` |

Brak naruszeń.

---

## 3. Unified Block Model

**Ocena: W PEŁNI ZGODNA**

- Schema Drizzle: jedna tabela `blocks` z polem `type` (task/page/text/heading/...)
- Brak osobnych tabel `tasks` ani `pages`
- API: `/api/blocks` i `/api/blocks/[id]` — brak osobnych endpointów
- React Query: klucze `['block', id]`, `['board-columns', ...]` — brak `['tasks']`/`['pages']`
- RLS: jedna polityka na `blocks` — brak osobnych polityk

---

## 4. TypeScript

**Ocena: W PEŁNI ZGODNA**

- `"strict": true` w `tsconfig.json`
- **0** wystąpień `: any`, `as any`, `<any>`
- **0** dyrektyw `@ts-ignore` / `@ts-expect-error`
- Wszystkie parametry funkcji i propsy komponentów jawnie typowane
- Interfejsy: `KanbanBoardProps`, `BlockPageProps`, `CalendarPageClientProps`, etc.

---

## 5. Optimistic Updates

**Ocena: WYMAGA NAPRAWY** — 0/14 mutacji w pełni zgodnych z wzorcem

### Brak `useMutation` z React Query

Żadna mutacja w kodzie nie używa `useMutation` z `@tanstack/react-query`. Wszystkie 14 mutacji to bezpośrednie `fetch()` z ręcznym zarządzaniem stanem.

### Szczegóły:

| Plik | Mutacje | onMutate | onError | onSettled |
|---|---|---|---|---|
| `components/board/KanbanBoard.tsx` | 4 (create/update/delete/reorder) | ⚠️ ręcznie | ⚠️ ręcznie | ❌ brak |
| `components/layout/Sidebar.tsx` | 3 (create/update/delete project) | ⚠️ ręcznie | ⚠️ ręcznie | ❌ brak |
| `components/notes/NotesTreeSidebar.tsx` | 2 (create/move page) | ⚠️ ręcznie | ⚠️ częściowo | ❌ brak |
| `components/block/BlockPage.tsx` | 1 (PATCH) | ⚠️ ręcznie | ⚠️ try/catch | ❌ brak |
| `components/calendar/CalendarPageClient.tsx` | 1 (create task) | ❌ brak | ⚠️ częściowo | ❌ brak |
| `settings/members/InviteMemberForm.tsx` | 1 (invite) | ❌ brak | ❌ brak | ❌ brak |
| `settings/members/MemberActions.tsx` | 2 (role/remove) | ❌ brak | ❌ brak | ❌ brak |

### Znalezione problemy:

**🔴 P1** `src/components/board/KanbanBoard.tsx:366-521` — 4 mutacje bez `useMutation`, brak `onSettled` (cache invalidation)

**🔴 P2** `src/components/calendar/CalendarPageClient.tsx:150` — brak optimistic update, fallback na `router.refresh()`

**🔴 P3** `src/app/(dashboard)/[workspaceSlug]/settings/members/InviteMemberForm.tsx:27` — brak jakichkolwiek optimistic updates

**🔴 P4** `src/app/(dashboard)/[workspaceSlug]/settings/members/MemberActions.tsx:40,61` — 2 mutacje bez optimistic updates

**🟡 P5** `src/components/layout/Sidebar.tsx:228-300` — ma snapshot/rollback ale brak `onSettled`

**🟡 P6** `src/components/notes/NotesTreeSidebar.tsx:92-128` — ma optimistic ale brak pełnego rollback i invalidation

**🟡 P7** `src/components/block/BlockPage.tsx:167` — ma ręczny update cache ale brak proper rollback

---

## 6. RLS (Row Level Security)

**Ocena: W PEŁNI ZGODNA**

- RLS włączony na **wszystkich 6 tabelach** (workspaces, workspace_members, projects, blocks, tags, block_tags)
- 24 polityki — **wszystkie** idą przez `workspace_members` (helper functions `is_workspace_member`, `is_workspace_admin`)
- **Zero** bezpośrednich `user_id = auth.uid()` na tabelach treściowych (blocks, projects, tags)
- `SECURITY DEFINER` na helper functions — poprawne, read-only, z `search_path = ''`
- Testy RLS w `supabase/tests/0001_rls_policies_test.sql` — weryfikacja izolacji workspace
- Route Handlers **dodatkowo** sprawdzają membership w warstwie aplikacyjnej

---

## 7. Design Tokens

**Ocena: WYMAGA NAPRAWY** — liczne hardcoded kolory

### globals.css i @theme — poprawne
Tokeny zdefiniowane prawidłowo (`bg-base`, `bg-surface`, `content-primary`, etc.).
Brak prefiksu `dark:` w kodzie.

### Naruszenia (hardcoded kolory zamiast tokenów):

**🔴 P8** `src/components/calendar/CalendarPageClient.tsx:43-52` — badge'y z hardcoded kolorami
```
Linia 43: bg-emerald-500/20 text-emerald-300 → powinno używać semantic tokens
Linia 44: bg-sky-500/20 text-sky-300
Linia 45: bg-amber-500/20 text-amber-300
Linia 46: bg-rose-500/20 text-rose-300
Linia 50: bg-slate-500/20 text-slate-300 → powinno: token status-todo
Linia 51: bg-indigo-500/20 text-indigo-300 → powinno: token status-in-progress
Linia 52: bg-emerald-500/20 text-emerald-300 → powinno: token status-done
```

**🟡 P9** `src/components/layout/WorkspaceSwitcher.tsx:23` — `bg-violet-500` / `bg-sky-500`
DESIGN.md definiuje: personal `#7c3aed` · work `#0ea5e9` — brakuje tokenów `workspace-personal` / `workspace-work`

**🟡 P10** `src/components/layout/Sidebar.tsx:72,410` — `border-l-sky-500` hardcoded dla aktywnego itemu
Powinien być token (np. zmienna workspace color z DESIGN.md)

**🟡 P11** `src/components/notes/PageTreeItem.tsx:73` — `border-l-sky-500` j.w.

**🟡 P12** `src/components/notes/NotesTreeSidebar.tsx:199,229` — `hover:bg-sky-500/20` hardcoded

**🟡 P13** Używanie `text-red-400` zamiast `text-destructive` w wielu plikach:
- `Sidebar.tsx:162,438`
- `CalendarPageClient.tsx:249`
- `BlockPage.tsx:302`
- `KanbanCard.tsx:125`
- `InviteMemberForm.tsx:79`
- `MemberActions.tsx:89,99`

**🟡 P14** `src/app/(auth)/login/page.tsx:112` i `register/page.tsx:168` — `text-[#ef4444]` hardcoded hex zamiast `text-destructive`

**🟢 P15** `src/app/(dashboard)/[workspaceSlug]/settings/members/InviteMemberForm.tsx:80` — `text-emerald-400` dla success → brak tokena success

---

## 8. shadcn/ui

**Ocena: ZGODNA**

- 6 komponentów shadcn zainstalowanych: `button`, `card`, `input`, `label`, `popover`, `date-picker`
- Wszystkie rozszerzane przez `className` z `cn()` utility
- Brak duplikatów — żaden komponent nie odtwarza funkcjonalności shadcn od zera
- `DatePicker` to custom komponent kompozytujący `Popover` + `Button` — poprawne

---

## 9. Error Handling

**Ocena: WYMAGA NAPRAWY** — mieszanie `throw` z Result pattern

### Route Handlers — POPRAWNE
Wszystkie Route Handlers zwracają `{ data, error }` format. ✓

### Problemy po stronie klienta:

**🔴 P16** `request.json()` w Route Handlers bez try-catch — 6 plików:
- `src/app/api/blocks/route.ts:44`
- `src/app/api/blocks/[id]/route.ts:98`
- `src/app/api/projects/route.ts:23`
- `src/app/api/projects/[id]/route.ts:56`
- `src/app/api/workspace/[id]/members/[userId]/route.ts:42`
- `src/app/api/workspace/[id]/invite/route.ts:23`

Malformed JSON → niezłapany `SyntaxError` → 500 bez komunikatu.

**🟡 P17** `response.json()` na kliencie bez try-catch — 6 plików:
- `InviteMemberForm.tsx:33`
- `MemberActions.tsx:46,65`
- `CalendarPageClient.tsx:167`
- `Sidebar.tsx:239`
- `NotesTreeSidebar.tsx:123`

Malformed response → niezłapany błąd parsowania.

**🟡 P18** `throw new Error` zamiast Result pattern w queryFn:
- `src/lib/hooks/use-workspace.ts:31`
- `src/components/board/KanbanCard.tsx:78`
- `src/components/block/BlockPage.tsx:194`

Uwaga: wewnątrz React Query `queryFn` throw jest akceptowalnym wzorcem — ale niezgodnym z dokumentacją CLAUDE.md.

**🟡 P19** `Promise.all` bez error boundary w `src/app/api/workspace/[id]/members/route.ts:61` — jedno `getUserById` failuje → cała odpowiedź się psuje

**🟡 P20** Auth callback `src/app/auth/callback/route.ts` — `workspace_members` update bez sprawdzenia błędu

---

## 10. Konwencje

### Nazewnictwo plików — WYMAGA NAPRAWY

**🟡 P21** 14 plików komponentów ma nazwy PascalCase zamiast kebab-case:

| Obecna nazwa | Powinna być |
|---|---|
| `BlockPage.tsx` | `block-page.tsx` |
| `KanbanBoard.tsx` | `kanban-board.tsx` |
| `KanbanCard.tsx` | `kanban-card.tsx` |
| `KanbanColumn.tsx` | `kanban-column.tsx` |
| `BlockNoteEditor.tsx` | `block-note-editor.tsx` |
| `CalendarPageClient.tsx` | `calendar-page-client.tsx` |
| `WorkspaceSwitcher.tsx` | `workspace-switcher.tsx` |
| `Navbar.tsx` | `navbar.tsx` |
| `Sidebar.tsx` | `sidebar.tsx` |
| `NotesTreeSidebar.tsx` | `notes-tree-sidebar.tsx` |
| `PageTreeItem.tsx` | `page-tree-item.tsx` |
| `ReactQueryProvider.tsx` | `react-query-provider.tsx` |
| `InviteMemberForm.tsx` | `invite-member-form.tsx` |
| `MemberActions.tsx` | `member-actions.tsx` |

Eksporty komponentów PascalCase — poprawne.

### Brakujące dyrektywy `'use client'`

**🟡 P22** 2 pliki używają hooków ale nie mają dyrektywy:
- `src/components/board/KanbanColumn.tsx` — używa `useState`, `useDroppable`, `useSortable`
- `src/components/board/KanbanCard.tsx` — używa `useState`, `useMemo`, `useQueryClient`

Działają bo są importowane z `'use client'` componentu, ale to naruszenie konwencji.

### Env vars — POPRAWNE
`.env.local.example` dokumentuje: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL` — wszystkie używane w kodzie, brak wycieków.

---

## Podsumowanie

### Co jest dobrze

| Obszar | Ocena |
|---|---|
| Struktura projektu | ✅ Pełna zgodność |
| Supabase SSR | ✅ 28/28 plików poprawnie |
| Unified Block Model | ✅ Pełna zgodność |
| TypeScript strict | ✅ Zero naruszeń |
| RLS / bezpieczeństwo | ✅ 24 polityki, pełna izolacja |
| shadcn/ui | ✅ Poprawne rozszerzanie |
| Env vars | ✅ Udokumentowane, bezpieczne |

### Co wymaga naprawy

| # | Problem | Priorytet | Pliki |
|---|---|---|---|
| P1-P4 | Brak `useMutation` i optimistic updates | 🔴 krytyczny | 4 pliki |
| P5-P7 | Niepełne optimistic updates (brak `onSettled`) | 🟡 ważny | 3 pliki |
| P8 | Hardcoded kolory w CalendarPageClient | 🔴 krytyczny | 1 plik |
| P9-P12 | Hardcoded workspace/active colors | 🟡 ważny | 4 pliki |
| P13-P15 | `text-red-400`/`text-[#ef4444]` zamiast tokenów | 🟡 ważny | 8 plików |
| P16 | `request.json()` bez try-catch w Route Handlers | 🔴 krytyczny | 6 plików |
| P17-P18 | `response.json()` / `throw` bez proper handling | 🟡 ważny | 9 plików |
| P19-P20 | Promise.all / auth callback bez error handling | 🟡 ważny | 2 pliki |
| P21 | PascalCase nazwy plików zamiast kebab-case | 🟡 ważny | 14 plików |
| P22 | Brakujące `'use client'` dyrektywy | 🟡 ważny | 2 pliki |

### Sugerowana kolejność fixów

1. **🔴 P16** — Dodaj try-catch na `request.json()` we wszystkich Route Handlers (zabezpieczenie API)
2. **🔴 P1-P4** — Przepisz mutacje na `useMutation` z pełnym wzorcem onMutate/onError/onSettled (wymóg architektoniczny)
3. **🔴 P8** — Zastąp hardcoded kolory w CalendarPageClient tokenami z DESIGN.md
4. **🟡 P5-P7** — Uzupełnij brakujące `onSettled` w istniejących mutacjach
5. **🟡 P13-P14** — Zamień `text-red-400` / `text-[#ef4444]` na `text-destructive`
6. **🟡 P9-P12** — Dodaj tokeny CSS dla workspace colors i active state border
7. **🟡 P17-P20** — Popraw error handling po stronie klienta
8. **🟡 P21** — Rename plików komponentów na kebab-case
9. **🟡 P22** — Dodaj `'use client'` do KanbanCard.tsx i KanbanColumn.tsx
10. **🟢 P15** — Dodaj token success color
