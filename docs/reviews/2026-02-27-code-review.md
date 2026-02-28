# Code Review — Zgodność z CLAUDE.md / ARCHITECTURE.md / DESIGN.md

**Data:** 2026-02-27
**Scope:** Pełny audyt repozytorium pod kątem dokumentacji projektowej
**Status:** Wszystkie problemy naprawione (issues #51-#62)

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
- `src/lib/types/` zamiast `src/types/` — ✅ Fixed (#62) — przeniesiono do `src/types/`
- `src/app/blocknote-test/page.tsx` — ✅ Fixed (#62) — usunięty

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

**Ocena: ✅ NAPRAWIONE**

| # | Problem | Status | Fix |
|---|---|---|---|
| P1 | KanbanBoard — 4 mutacje bez `useMutation` | ✅ Fixed | #53 |
| P2 | CalendarPageClient — brak optimistic update | ✅ Fixed | #54 |
| P3 | InviteMemberForm — brak optimistic updates | ✅ Fixed | #55 |
| P4 | MemberActions — 2 mutacje bez optimistic | ✅ Fixed | #55 |
| P5 | Sidebar — brak `onSettled` | ✅ Fixed | #56 |
| P6 | NotesTreeSidebar — brak pełnego rollback | ✅ Fixed | #56 |
| P7 | BlockPage — brak proper rollback | ✅ Fixed | #56 |

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

**Ocena: ✅ NAPRAWIONE**

| # | Problem | Status | Fix |
|---|---|---|---|
| P8 | CalendarPageClient — hardcoded kolory badge | ✅ Fixed | #58 |
| P9 | WorkspaceSwitcher — hardcoded workspace colors | ✅ Fixed | #59 |
| P10 | Sidebar — hardcoded border-l-sky-500 | ✅ Fixed | #59 |
| P11 | PageTreeItem — hardcoded border-l-sky-500 | ✅ Fixed | #59 |
| P12 | NotesTreeSidebar — hardcoded hover colors | ✅ Fixed | #59 |
| P13 | text-red-400 zamiast text-destructive | ✅ Fixed | #58 |
| P14 | text-[#ef4444] zamiast text-destructive | ✅ Fixed | #58 |
| P15 | text-emerald-400 zamiast token success | ✅ Fixed | #58 |

---

## 8. shadcn/ui

**Ocena: ZGODNA**

- 6 komponentów shadcn zainstalowanych: `button`, `card`, `input`, `label`, `popover`, `date-picker`
- Wszystkie rozszerzane przez `className` z `cn()` utility
- Brak duplikatów — żaden komponent nie odtwarza funkcjonalności shadcn od zera
- `DatePicker` to custom komponent kompozytujący `Popover` + `Button` — poprawne

---

## 9. Error Handling

**Ocena: ✅ NAPRAWIONE**

| # | Problem | Status | Fix |
|---|---|---|---|
| P16 | request.json() bez try-catch w Route Handlers | ✅ Fixed | #51 |
| P17 | response.json() na kliencie bez try-catch | ✅ Fixed | #57 |
| P18 | throw w queryFn — udokumentowane jako akceptowalne | ✅ Fixed | #57 |
| P19 | Promise.all bez error boundary w members | ✅ Fixed | #52 |
| P20 | Auth callback bez error handling | ✅ Fixed | #52 |

---

## 10. Konwencje

**Ocena: ✅ NAPRAWIONE**

| # | Problem | Status | Fix |
|---|---|---|---|
| P21 | PascalCase nazwy plików zamiast kebab-case | ✅ Fixed | #60 |
| P22 | Brakujące 'use client' dyrektywy | ✅ Fixed | #61 |

---

## Podsumowanie

### Wynik końcowy

| Obszar | Ocena |
|---|---|
| Struktura projektu | ✅ Pełna zgodność |
| Supabase SSR | ✅ 28/28 plików poprawnie |
| Unified Block Model | ✅ Pełna zgodność |
| TypeScript strict | ✅ Zero naruszeń |
| RLS / bezpieczeństwo | ✅ 24 polityki, pełna izolacja |
| shadcn/ui | ✅ Poprawne rozszerzanie |
| Env vars | ✅ Udokumentowane, bezpieczne |
| Optimistic Updates | ✅ Naprawione (#53-#56) |
| Design Tokens | ✅ Naprawione (#58-#59) |
| Error Handling | ✅ Naprawione (#51-#52, #57) |
| Konwencje (naming, directives) | ✅ Naprawione (#60-#62) |

### Issues zamykające problemy

| Issue | Tytuł | Problemy |
|---|---|---|
| #51 | fix(api): try-catch na request.json() | P16 |
| #52 | fix(api): error handling Promise.all + auth callback | P19, P20 |
| #53 | refactor(board): useMutation w KanbanBoard | P1 |
| #54 | refactor(calendar): useMutation w CalendarPageClient | P2 |
| #55 | refactor(members): useMutation w InviteMemberForm + MemberActions | P3, P4 |
| #56 | fix(state): onSettled w Sidebar, NotesTree, BlockPage | P5, P6, P7 |
| #57 | fix(client): safeJson helper + udokumentowany throw w queryFn | P17, P18 |
| #58 | fix(ui): hardcoded kolory → design tokens | P8, P13, P14, P15 |
| #59 | fix(ui): tokeny workspace colors + active border | P9, P10, P11, P12 |
| #60 | refactor(dx): rename plików na kebab-case | P21 |
| #61 | fix(dx): brakujące 'use client' | P22 |
| #62 | chore: cleanup (blocknote-test, types/) | Drobne uwagi |
