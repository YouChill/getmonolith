"use client";

import { type ComponentType, type FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  NotebookPen,
  Pencil,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/lib/stores/sidebar-store";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { NotesTreeSidebar } from "@/components/notes/NotesTreeSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sidebarProjectsQueryKey } from "@/lib/react-query/query-keys";
import { safeJson } from "@/lib/utils";

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  type: "personal" | "work";
}

interface ProjectItem {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface SidebarProps {
  currentWorkspaceSlug: string;
  workspaceId: string;
  workspaces: WorkspaceItem[];
  projects: ProjectItem[];
  pages: Array<{ id: string; parent_block_id: string | null; position: number; properties: { title?: string; icon?: string } | null }>;
}

interface SidebarLinkProps {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  isActive: boolean;
  collapsed: boolean;
}

type ProjectFormState = {
  name: string;
  icon: string;
  color: string;
};

interface ProjectApiResponse {
  data: ProjectItem | null;
  error: string | null;
}

interface DeleteProjectApiResponse {
  data: { id: string } | null;
  error: string | null;
}

const DEFAULT_PROJECT_ICON = "📁";
const DEFAULT_PROJECT_COLOR = "#38BDF8";

function SidebarLink({ href, label, icon: Icon, isActive, collapsed }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-9 items-center rounded-md border-l-2 border-transparent px-3 text-sm text-content-secondary transition-all duration-200 hover:bg-bg-elevated hover:pl-3.5 hover:text-content-primary",
        isActive && "border-l-ws-accent bg-bg-elevated text-content-primary"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="ml-2 truncate">{label}</span>}
    </Link>
  );
}

function ProjectModal({
  title,
  submitLabel,
  initialValues,
  pending,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initialValues: ProjectFormState;
  pending: boolean;
  onSubmit: (values: ProjectFormState) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialValues.name);
  const [icon, setIcon] = useState(initialValues.icon || DEFAULT_PROJECT_ICON);
  const [color, setColor] = useState(initialValues.color || DEFAULT_PROJECT_COLOR);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Nazwa projektu jest wymagana.");
      return;
    }

    setError(null);
    onSubmit({ name: name.trim(), icon: icon.trim() || DEFAULT_PROJECT_ICON, color });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-content-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-content-muted transition hover:bg-bg-elevated hover:text-content-primary"
            aria-label="Zamknij modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Nazwa projektu</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="Np. Product roadmap"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-icon">Ikona emoji</Label>
            <Input
              id="project-icon"
              value={icon}
              onChange={(event) => setIcon(event.target.value)}
              maxLength={4}
              placeholder="📋"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-color">Kolor</Label>
            <Input
              id="project-color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              placeholder="#38BDF8"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Anuluj
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Zapisywanie..." : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
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

export function Sidebar({ currentWorkspaceSlug, workspaceId, workspaces, projects, pages }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isCollapsed, toggle } = useSidebarStore();
  const [projectItems, setProjectItems] = useState<ProjectItem[]>(projects);
  const [projectModalMode, setProjectModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const currentWorkspace = workspaces.find((ws) => ws.slug === currentWorkspaceSlug);
  const wsAccentValue = currentWorkspace?.type === "personal" ? "var(--color-workspace-personal)" : "var(--color-workspace-work)";

  const selectedProject = useMemo(
    () => projectItems.find((project) => project.id === selectedProjectId) ?? null,
    [projectItems, selectedProjectId]
  );

  function closeModal() {
    setProjectModalMode(null);
    setSelectedProjectId(null);
  }

  // ── Create project mutation ───────────────────────────────────────────
  const createProjectMutation = useMutation({
    mutationFn: async (values: ProjectFormState) => {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...values }),
      });

      const payload = await safeJson<ProjectApiResponse>(response);

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Nie udało się utworzyć projektu.");
      }

      return payload.data;
    },
    onMutate: async (values) => {
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimisticProject: ProjectItem = {
        id: tempId,
        name: values.name,
        icon: values.icon,
        color: values.color,
      };

      const previousProjects = projectItems;
      setProjectItems((current) => [...current, optimisticProject]);
      closeModal();

      return { previousProjects, tempId };
    },
    onSuccess: (data, _values, ctx) => {
      if (ctx) {
        setProjectItems((current) =>
          current.map((project) => (project.id === ctx.tempId ? data : project))
        );
      }

      router.push(`/${currentWorkspaceSlug}/board/${data.id}`);
    },
    onError: (_err, _values, ctx) => {
      if (ctx) {
        setProjectItems(ctx.previousProjects);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sidebarProjectsQueryKey(workspaceId) });
      router.refresh();
    },
  });

  // ── Update project mutation ───────────────────────────────────────────
  const updateProjectMutation = useMutation({
    mutationFn: async (vars: { projectId: string; values: ProjectFormState }) => {
      const response = await fetch(`/api/projects/${vars.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars.values),
      });

      const payload = await safeJson<ProjectApiResponse>(response);

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Nie udało się zaktualizować projektu.");
      }

      return payload.data;
    },
    onMutate: async (vars) => {
      const previousProjects = projectItems;
      setProjectItems((current) =>
        current.map((project) =>
          project.id === vars.projectId
            ? { ...project, name: vars.values.name, icon: vars.values.icon, color: vars.values.color }
            : project
        )
      );
      closeModal();

      return { previousProjects };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        setProjectItems(ctx.previousProjects);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sidebarProjectsQueryKey(workspaceId) });
      router.refresh();
    },
  });

  // ── Delete project mutation ───────────────────────────────────────────
  const deleteProjectMutation = useMutation({
    mutationFn: async (vars: { projectId: string }) => {
      const response = await fetch(`/api/projects/${vars.projectId}`, {
        method: "DELETE",
      });

      const payload = await safeJson<DeleteProjectApiResponse>(response);

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Nie udało się usunąć projektu.");
      }

      return payload.data;
    },
    onMutate: async (vars) => {
      const previousProjects = projectItems;
      setProjectItems((current) => current.filter((item) => item.id !== vars.projectId));

      return { previousProjects, projectId: vars.projectId };
    },
    onSuccess: (_data, vars) => {
      if (pathname.startsWith(`/${currentWorkspaceSlug}/board/${vars.projectId}`)) {
        router.push(`/${currentWorkspaceSlug}/board`);
      }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        setProjectItems(ctx.previousProjects);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sidebarProjectsQueryKey(workspaceId) });
      router.refresh();
    },
  });

  function handleCreateProject(values: ProjectFormState) {
    createProjectMutation.mutate(values);
  }

  function handleUpdateProject(values: ProjectFormState) {
    if (!selectedProject) {
      return;
    }

    updateProjectMutation.mutate({ projectId: selectedProject.id, values });
  }

  function handleDeleteProject(project: ProjectItem) {
    const confirmed = window.confirm(
      `Czy na pewno usunąć projekt \"${project.name}\"? Wszystkie bloki w projekcie zostaną usunięte.`
    );

    if (!confirmed) {
      return;
    }

    deleteProjectMutation.mutate({ projectId: project.id });
  }

  const isPending = createProjectMutation.isPending || updateProjectMutation.isPending || deleteProjectMutation.isPending;

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-border-subtle bg-bg-subtle p-3 transition-all duration-200",
        isCollapsed ? "w-14" : "w-64"
      )}
      style={{ "--ws-accent": wsAccentValue } as React.CSSProperties}
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
          href={`/${currentWorkspaceSlug}/calendar`}
          label="Kalendarz"
          icon={CalendarDays}
          isActive={pathname.includes("/calendar")}
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
        <NotesTreeSidebar
          workspaceId={workspaceId}
          workspaceSlug={currentWorkspaceSlug}
          isCollapsed={isCollapsed}
          pages={pages}
        />
        {!isCollapsed && (
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs uppercase tracking-wider text-content-muted">Projekty</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setProjectModalMode("create")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {isCollapsed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mb-2 h-8 w-8"
            onClick={() => setProjectModalMode("create")}
            title="Nowy projekt"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}

        <div className="space-y-1">
          {projectItems.map((project) => {
            const projectHref = `/${currentWorkspaceSlug}/board/${project.id}`;
            const isActive = pathname.startsWith(projectHref);

            return (
              <div key={project.id} className="group flex items-center gap-1">
                <Link
                  href={projectHref}
                  className={cn(
                    "flex h-9 min-w-0 flex-1 items-center rounded-md border-l-2 border-transparent px-3 text-sm text-content-secondary transition-all duration-200 hover:bg-bg-elevated hover:text-content-primary",
                    isActive && "border-l-ws-accent bg-bg-elevated text-content-primary"
                  )}
                  title={isCollapsed ? project.name : undefined}
                >
                  <FolderKanban className="h-4 w-4 shrink-0" style={{ color: project.color ?? undefined }} />
                  {!isCollapsed && (
                    <span className="ml-2 flex min-w-0 items-center gap-2 truncate">
                      <span>{project.icon ?? "📁"}</span>
                      <span className="truncate">{project.name}</span>
                    </span>
                  )}
                </Link>

                {!isCollapsed && (
                  <div className="flex items-center opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      className="rounded-md p-1 text-content-muted hover:bg-bg-elevated hover:text-content-primary"
                      aria-label={`Edytuj projekt ${project.name}`}
                      onClick={() => {
                        setSelectedProjectId(project.id);
                        setProjectModalMode("edit");
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded-md p-1 text-content-muted hover:bg-bg-elevated hover:text-destructive"
                      aria-label={`Usuń projekt ${project.name}`}
                      onClick={() => handleDeleteProject(project)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {!projectItems.length && !isCollapsed && (
            <p className="px-3 pt-2 text-xs text-content-muted">Brak projektów w tym workspace.</p>
          )}
        </div>
      </div>

      {projectModalMode === "create" && (
        <ProjectModal
          title="Nowy projekt"
          submitLabel="Utwórz projekt"
          initialValues={{ name: "", icon: DEFAULT_PROJECT_ICON, color: DEFAULT_PROJECT_COLOR }}
          pending={isPending}
          onSubmit={handleCreateProject}
          onClose={closeModal}
        />
      )}

      {projectModalMode === "edit" && selectedProject && (
        <ProjectModal
          title="Edytuj projekt"
          submitLabel="Zapisz zmiany"
          initialValues={{
            name: selectedProject.name,
            icon: selectedProject.icon ?? DEFAULT_PROJECT_ICON,
            color: selectedProject.color ?? DEFAULT_PROJECT_COLOR,
          }}
          pending={isPending}
          onSubmit={handleUpdateProject}
          onClose={closeModal}
        />
      )}

      {isPending && !isCollapsed && (
        <div className="mt-2 flex items-center gap-2 px-3 text-xs text-content-muted">
          <Check className="h-3 w-3" />
          Trwa synchronizacja zmian...
        </div>
      )}
    </aside>
  );
}
