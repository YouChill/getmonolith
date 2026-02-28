import { notFound, redirect } from "next/navigation";
import { KanbanBoard } from "@/components/board/kanban-board";
import type { KanbanTaskCard } from "@/components/board/kanban-column";
import type { TaskStatus } from "@/lib/db/types";
import { createServerClient } from "@/lib/supabase/server";

interface ProjectBoardPageProps {
  params: Promise<{ workspaceSlug: string; projectId: string }>;
}

interface TaskBlockProperties {
  title?: string;
  status?: TaskStatus;
  due_date?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
}

interface TaskBlock {
  id: string;
  position: number;
  properties: TaskBlockProperties;
}

function normalizeTaskStatus(status?: string): TaskStatus {
  if (status === "todo" || status === "in_progress" || status === "done") {
    return status;
  }

  return "todo";
}

export default async function ProjectBoardPage({ params }: ProjectBoardPageProps) {
  const { workspaceSlug, projectId } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) {
    notFound();
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    redirect("/");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, icon, color")
    .eq("id", projectId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!project) {
    notFound();
  }

  const { data: tasks } = await supabase
    .from("blocks")
    .select("id, properties, position")
    .eq("workspace_id", workspace.id)
    .eq("project_id", project.id)
    .eq("type", "task")
    .order("position", { ascending: true });

  const columns: Record<TaskStatus, KanbanTaskCard[]> = {
    todo: [],
    in_progress: [],
    done: [],
  };

  for (const task of (tasks ?? []) as TaskBlock[]) {
    const status = normalizeTaskStatus(task.properties?.status);

    columns[status].push({
      id: task.id,
      title: task.properties?.title?.trim() || "Bez tytułu",
      status,
      position: task.position,
      priority: task.properties?.priority,
      dueDate: task.properties?.due_date,
      assignee: task.properties?.assigned_to,
    });
  }

  return (
    <div className="px-8 py-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-3xl">{project.icon ?? "📁"}</span>
        <div>
          <h1 className="text-2xl font-semibold text-content-primary">{project.name}</h1>
          <p className="text-sm text-content-muted">Tablica Kanban dla zadań projektu.</p>
        </div>
      </div>

      <KanbanBoard workspaceSlug={workspaceSlug} workspaceId={workspace.id} projectId={project.id} columns={columns} />
    </div>
  );
}
