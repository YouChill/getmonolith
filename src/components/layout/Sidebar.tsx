"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, FolderKanban, NotebookPen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/lib/stores/sidebar-store";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  type: "personal" | "work";
}

interface ProjectItem {
  id: string;
  name: string;
}

interface SidebarProps {
  currentWorkspaceSlug: string;
  workspaces: WorkspaceItem[];
  projects: ProjectItem[];
}

interface SidebarLinkProps {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  isActive: boolean;
  collapsed: boolean;
}

function SidebarLink({ href, label, icon: Icon, isActive, collapsed }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-9 items-center rounded-md border-l-2 border-transparent px-3 text-sm text-content-secondary transition-all duration-200 hover:bg-bg-elevated hover:pl-3.5 hover:text-content-primary",
        isActive && "border-l-sky-500 bg-bg-elevated text-content-primary"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="ml-2 truncate">{label}</span>}
    </Link>
  );
}

export function SidebarSkeleton() {
  return (
    <aside className="w-60 shrink-0 border-r border-border-subtle bg-bg-subtle p-3">
      <div className="h-8 w-full animate-pulse rounded-md bg-bg-elevated" />
      <div className="mt-6 space-y-2">
        <div className="h-9 animate-pulse rounded-md bg-bg-elevated" />
        <div className="h-9 animate-pulse rounded-md bg-bg-elevated" />
        <div className="h-9 animate-pulse rounded-md bg-bg-elevated" />
      </div>
      <div className="mt-6 space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-bg-elevated" />
        <div className="h-8 animate-pulse rounded-md bg-bg-elevated" />
        <div className="h-8 animate-pulse rounded-md bg-bg-elevated" />
      </div>
    </aside>
  );
}

export function Sidebar({ currentWorkspaceSlug, workspaces, projects }: SidebarProps) {
  const pathname = usePathname();
  const { isCollapsed, toggle } = useSidebarStore();

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-border-subtle bg-bg-subtle p-3 transition-all duration-200",
        isCollapsed ? "w-14" : "w-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <WorkspaceSwitcher
            currentWorkspaceSlug={currentWorkspaceSlug}
            workspaces={workspaces}
            isCollapsed={isCollapsed}
          />
        </div>
        <button
          type="button"
          onClick={toggle}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-bg-surface text-content-muted transition-colors duration-150 hover:bg-bg-elevated hover:text-content-primary"
          aria-label={isCollapsed ? "Rozwiń sidebar" : "Zwiń sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="mt-6 space-y-1">
        <SidebarLink
          href={`/${currentWorkspaceSlug}/notes`}
          label="Notatki"
          icon={NotebookPen}
          isActive={pathname.includes("/notes")}
          collapsed={isCollapsed}
        />
        <SidebarLink
          href={`/${currentWorkspaceSlug}/settings/members`}
          label="Ustawienia"
          icon={Settings}
          isActive={pathname.includes("/settings")}
          collapsed={isCollapsed}
        />
      </nav>

      <div className="mt-6 flex-1 overflow-y-auto">
        {!isCollapsed && (
          <p className="px-3 pb-1 text-xs uppercase tracking-wider text-content-muted">Projekty</p>
        )}
        <div className="space-y-1">
          {projects.map((project) => {
            const projectHref = `/${currentWorkspaceSlug}/board/${project.id}`;
            return (
              <SidebarLink
                key={project.id}
                href={projectHref}
                label={project.name}
                icon={FolderKanban}
                isActive={pathname.startsWith(projectHref)}
                collapsed={isCollapsed}
              />
            );
          })}
          {!projects.length && !isCollapsed && (
            <p className="px-3 pt-2 text-xs text-content-muted">Brak projektów w tym workspace.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
