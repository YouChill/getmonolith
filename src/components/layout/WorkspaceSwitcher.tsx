"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  type: "personal" | "work";
}

interface WorkspaceSwitcherProps {
  currentWorkspaceSlug: string;
  workspaces: WorkspaceItem[];
  isCollapsed: boolean;
}

function workspaceDotColor(type: WorkspaceItem["type"]) {
  return type === "personal" ? "bg-violet-500" : "bg-sky-500";
}

export function WorkspaceSwitcher({
  currentWorkspaceSlug,
  workspaces,
  isCollapsed,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const { activeWorkspaceSlug, setActiveWorkspace } = useWorkspaceStore();

  useEffect(() => {
    setActiveWorkspace(currentWorkspaceSlug);
  }, [currentWorkspaceSlug, setActiveWorkspace]);

  const selectedWorkspaceSlug = activeWorkspaceSlug ?? currentWorkspaceSlug;

  const selectedWorkspace =
    workspaces.find((workspace) => workspace.slug === selectedWorkspaceSlug) ??
    workspaces.find((workspace) => workspace.slug === currentWorkspaceSlug) ??
    null;

  const handleWorkspaceChange = (workspaceSlug: string) => {
    if (workspaceSlug === selectedWorkspaceSlug) {
      return;
    }

    setActiveWorkspace(workspaceSlug);
    router.push(`/${workspaceSlug}/board`);
  };

  if (isCollapsed) {
    return (
      <div className="flex justify-center">
        <span
          className={cn("h-2.5 w-2.5 rounded-full", selectedWorkspace && workspaceDotColor(selectedWorkspace.type))}
          aria-label={selectedWorkspace ? `Workspace ${selectedWorkspace.name}` : "Workspace"}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wider text-content-muted">Workspace</p>
      <div className="relative">
        <select
          value={selectedWorkspaceSlug}
          onChange={(event) => handleWorkspaceChange(event.target.value)}
          className="h-9 w-full appearance-none rounded-md border border-border-subtle bg-bg-surface px-3 pr-9 text-sm font-medium text-content-primary outline-none transition-colors duration-150 hover:bg-bg-elevated"
          aria-label="Przełącz workspace"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.slug}>
              {workspace.type === "personal" ? "🟣" : "🔵"} {workspace.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
      </div>
      {selectedWorkspace && (
        <div className="flex items-center gap-2 px-1">
          <span className={cn("h-2 w-2 rounded-full", workspaceDotColor(selectedWorkspace.type))} />
          <span className="text-xs text-content-muted">
            {selectedWorkspace.type === "personal" ? "Personal" : "Work"}
          </span>
        </div>
      )}
    </div>
  );
}
