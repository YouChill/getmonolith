"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { type SidebarPageItem, PageTreeItem } from "@/components/notes/PageTreeItem";
import { Button } from "@/components/ui/button";

interface NotesTreeSidebarProps {
  workspaceId: string;
  workspaceSlug: string;
  isCollapsed: boolean;
  pages: Array<{ id: string; parent_block_id: string | null; position: number; properties: { title?: string } | null }>;
}

export function NotesTreeSidebar({ workspaceId, workspaceSlug, isCollapsed, pages }: NotesTreeSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [expandedPageIds, setExpandedPageIds] = useState<Set<string>>(new Set());
  const [pageItems, setPageItems] = useState<SidebarPageItem[]>(
    pages.map((page) => ({
      id: page.id,
      parentBlockId: page.parent_block_id,
      position: page.position,
      title: page.properties?.title?.trim() || "Bez tytułu",
    }))
  );

  const pageMap = useMemo(() => new Map(pageItems.map((page) => [page.id, page])), [pageItems]);
  const pagesByParent = useMemo(() => {
    const grouped = new Map<string | null, SidebarPageItem[]>();
    for (const page of pageItems) {
      const items = grouped.get(page.parentBlockId) ?? [];
      items.push(page);
      grouped.set(page.parentBlockId, items);
    }
    for (const [, items] of grouped) {
      items.sort((a, b) => a.position - b.position);
    }
    return grouped;
  }, [pageItems]);

  function normalizePositions(items: SidebarPageItem[]) {
    const grouped = new Map<string | null, SidebarPageItem[]>();
    for (const item of items) {
      const siblings = grouped.get(item.parentBlockId) ?? [];
      siblings.push(item);
      grouped.set(item.parentBlockId, siblings);
    }

    const updates = new Map<string, number>();
    for (const [, siblings] of grouped) {
      siblings.sort((a, b) => a.position - b.position).forEach((sibling, index) => updates.set(sibling.id, index + 1));
    }

    return items.map((item) => ({ ...item, position: updates.get(item.id) ?? item.position }));
  }

  function updatePageTree(movingId: string, parentBlockId: string | null, insertionIndex: number): SidebarPageItem[] {
    const movingPage = pageMap.get(movingId);
    if (!movingPage) return pageItems;

    const withoutMoving = pageItems.filter((page) => page.id !== movingId);
    const siblings = withoutMoving.filter((page) => page.parentBlockId === parentBlockId).sort((a, b) => a.position - b.position);
    const clampedIndex = Math.max(0, Math.min(insertionIndex, siblings.length));

    const previous = siblings[clampedIndex - 1];
    const next = siblings[clampedIndex];

    let nextPosition = 1;
    if (previous && next) nextPosition = (previous.position + next.position) / 2;
    else if (previous) nextPosition = previous.position + 1;
    else if (next) nextPosition = Math.max(next.position / 2, 0.1);

    return normalizePositions([...withoutMoving, { ...movingPage, parentBlockId, position: nextPosition }]);
  }

  function isDescendant(candidateId: string, ancestorId: string): boolean {
    let current: string | null = pageMap.get(candidateId)?.parentBlockId ?? null;
    while (current) {
      if (current === ancestorId) return true;
      current = pageMap.get(current)?.parentBlockId ?? null;
    }
    return false;
  }

  function persistPageMove(pageId: string, parentBlockId: string | null, position: number) {
    startTransition(async () => {
      const response = await fetch(`/api/blocks/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_block_id: parentBlockId, position }),
      });

      if (!response.ok) router.refresh();
    });
  }

  function handleCreatePage(parentBlockId: string | null = null) {
    const tempId = `temp-page-${crypto.randomUUID()}`;
    const maxPosition = pageItems
      .filter((page) => page.parentBlockId === parentBlockId)
      .reduce((max, page) => Math.max(max, page.position), 0);

    setPageItems((current) => [...current, { id: tempId, title: "Nowa strona", parentBlockId, position: maxPosition + 1 }]);
    if (parentBlockId) setExpandedPageIds((current) => new Set(current).add(parentBlockId));

    startTransition(async () => {
      const response = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, type: "page", title: "Nowa strona", parentBlockId }),
      });

      if (!response.ok) {
        setPageItems((current) => current.filter((page) => page.id !== tempId));
        return;
      }

      const payload = (await response.json()) as {
        data?: { id: string; parent_block_id: string | null; position: number; properties?: { title?: string } };
      };

      if (!payload.data) {
        setPageItems((current) => current.filter((page) => page.id !== tempId));
        return;
      }

      setPageItems((current) =>
        current.map((page) =>
          page.id === tempId
            ? {
                id: payload.data!.id,
                parentBlockId: payload.data!.parent_block_id,
                position: payload.data!.position,
                title: payload.data!.properties?.title?.trim() || "Nowa strona",
              }
            : page
        )
      );

      router.push(`/${workspaceSlug}/block/${payload.data.id}`);
      router.refresh();
    });
  }

  function handleDropIntoPage(targetPageId: string) {
    if (!draggedPageId || draggedPageId === targetPageId || isDescendant(targetPageId, draggedPageId)) {
      setDraggedPageId(null);
      return;
    }

    const siblingCount = pageItems.filter((page) => page.parentBlockId === targetPageId).length;
    const nextPages = updatePageTree(draggedPageId, targetPageId, siblingCount);
    const movedPage = nextPages.find((page) => page.id === draggedPageId);
    if (!movedPage) return;

    setPageItems(nextPages);
    setExpandedPageIds((current) => new Set(current).add(targetPageId));
    persistPageMove(movedPage.id, movedPage.parentBlockId, movedPage.position);
    setDraggedPageId(null);
  }

  function handleDropBetween(parentBlockId: string | null, insertionIndex: number) {
    if (!draggedPageId) return;
    if (parentBlockId && (draggedPageId === parentBlockId || isDescendant(parentBlockId, draggedPageId))) {
      setDraggedPageId(null);
      return;
    }

    const nextPages = updatePageTree(draggedPageId, parentBlockId, insertionIndex);
    const movedPage = nextPages.find((page) => page.id === draggedPageId);
    if (!movedPage) return;

    setPageItems(nextPages);
    persistPageMove(movedPage.id, movedPage.parentBlockId, movedPage.position);
    setDraggedPageId(null);
  }

  function toggleExpanded(pageId: string) {
    setExpandedPageIds((current) => {
      const next = new Set(current);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }

  function renderPageTree(parentBlockId: string | null, depth = 0): React.ReactNode {
    const items = pagesByParent.get(parentBlockId) ?? [];

    return (
      <>
        <div
          className="h-1 rounded bg-transparent transition hover:bg-sky-500/20"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleDropBetween(parentBlockId, 0);
          }}
        />
        {items.map((page, index) => {
          const children = pagesByParent.get(page.id) ?? [];
          const isExpanded = expandedPageIds.has(page.id);

          return (
            <div key={page.id}>
              <PageTreeItem
                page={page}
                workspaceSlug={workspaceSlug}
                depth={depth}
                isCollapsed={isCollapsed}
                isExpanded={isExpanded}
                hasChildren={children.length > 0}
                isActive={pathname.startsWith(`/${workspaceSlug}/block/${page.id}`)}
                onToggle={toggleExpanded}
                onCreateChild={handleCreatePage}
                onDragStart={setDraggedPageId}
                onDropInside={handleDropIntoPage}
              />

              {!isCollapsed && children.length > 0 && isExpanded && <div>{renderPageTree(page.id, depth + 1)}</div>}

              <div
                className="h-1 rounded bg-transparent transition hover:bg-sky-500/20"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDropBetween(parentBlockId, index + 1);
                }}
              />
            </div>
          );
        })}
      </>
    );
  }

  if (isCollapsed) {
    return (
      <Button type="button" variant="ghost" size="icon" className="mb-2 h-8 w-8" onClick={() => handleCreatePage(null)} title="Nowa strona">
        <Plus className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="mb-3 space-y-2 border-b border-border-subtle pb-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs uppercase tracking-wider text-content-muted">Strony</p>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleCreatePage(null)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-0.5">{renderPageTree(null)}</div>
      {isPending && <p className="px-2 text-xs text-content-muted">Aktualizacja drzewa...</p>}
    </div>
  );
}
