"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SidebarPageItem {
  id: string;
  title: string;
  parentBlockId: string | null;
  position: number;
  icon?: string;
}

interface PageTreeItemProps {
  page: SidebarPageItem;
  workspaceSlug: string;
  depth: number;
  isCollapsed: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  isActive: boolean;
  onToggle: (pageId: string) => void;
  onCreateChild: (parentId: string) => void;
  onDragStart: (pageId: string) => void;
  onDropInside: (targetId: string) => void;
}

export function PageTreeItem({
  page,
  workspaceSlug,
  depth,
  isCollapsed,
  isExpanded,
  hasChildren,
  isActive,
  onToggle,
  onCreateChild,
  onDragStart,
  onDropInside,
}: PageTreeItemProps) {
  return (
    <div
      className="group"
      draggable
      onDragStart={() => onDragStart(page.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropInside(page.id);
      }}
    >
      <div className="flex items-center gap-1">
        {!isCollapsed ? (
          <button
            type="button"
            className="rounded p-0.5 text-content-muted hover:bg-bg-elevated hover:text-content-primary"
            onClick={() => hasChildren && onToggle(page.id)}
            aria-label={isExpanded ? "Zwiń podstrony" : "Rozwiń podstrony"}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <span className="block h-3.5 w-3.5" />
            )}
          </button>
        ) : null}

        <Link
          href={`/${workspaceSlug}/block/${page.id}`}
          className={cn(
            "flex h-8 min-w-0 flex-1 items-center rounded-md border-l-2 border-transparent px-2 text-sm text-content-secondary transition hover:bg-bg-elevated hover:text-content-primary",
            isActive && "border-l-ws-accent bg-bg-elevated text-content-primary"
          )}
          style={!isCollapsed ? { marginLeft: `${depth * 12}px` } : undefined}
          title={page.title}
        >
          <span className="shrink-0">{page.icon || "📝"}</span>
          {!isCollapsed && <span className="ml-2 truncate">{page.title}</span>}
        </Link>

        {!isCollapsed && (
          <button
            type="button"
            className="rounded p-1 text-content-muted opacity-0 transition hover:bg-bg-elevated hover:text-content-primary group-hover:opacity-100"
            onClick={() => onCreateChild(page.id)}
            aria-label={`Dodaj podstronę do ${page.title}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
