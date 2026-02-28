import { notFound, redirect } from "next/navigation";
import { BlockPage } from "@/components/block/block-page";
import { createServerClient } from "@/lib/supabase/server";
import type { BlockNoteContent } from "@/types/blocknote";
import type { TaskStatus } from "@/lib/db/types";

type TaskPriority = "low" | "medium" | "high" | "urgent";

interface BlockPageRouteProps {
  params: Promise<{ workspaceSlug: string; blockId: string }>;
}

interface BlockProperties {
  title?: string;
  icon?: string;
  status?: TaskStatus;
  due_date?: string;
  priority?: TaskPriority;
  assigned_to?: string;
}

interface BlockRecord {
  id: string;
  type: "task" | "page";
  workspace_id: string;
  project_id: string | null;
  properties: BlockProperties | null;
  content: BlockNoteContent | null;
}

interface WorkspaceRecord {
  id: string;
  slug: string;
}

export default async function WorkspaceBlockPage({ params }: BlockPageRouteProps) {
  const { workspaceSlug, blockId } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, slug")
    .eq("slug", workspaceSlug)
    .single<WorkspaceRecord>();

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

  const { data: block } = await supabase
    .from("blocks")
    .select("id, type, workspace_id, project_id, properties, content")
    .eq("id", blockId)
    .eq("workspace_id", workspace.id)
    .single<BlockRecord>();

  if (!block || (block.type !== "task" && block.type !== "page")) {
    notFound();
  }

  const { data: project } = block.project_id
    ? await supabase.from("projects").select("id, name").eq("id", block.project_id).maybeSingle()
    : { data: null };

  return (
    <BlockPage
      workspaceSlug={workspaceSlug}
      workspaceId={workspace.id}
      blockId={block.id}
      blockType={block.type}
      projectId={project?.id ?? undefined}
      projectName={project?.name}
      initialTitle={block.properties?.title?.trim() || "Bez tytułu"}
      initialIcon={block.type === "page" ? block.properties?.icon : undefined}
      initialContent={Array.isArray(block.content) ? block.content : []}
      taskData={
        block.type === "task"
          ? {
              status: block.properties?.status,
              dueDate: block.properties?.due_date,
              priority: block.properties?.priority,
              assignee: block.properties?.assigned_to,
            }
          : undefined
      }
    />
  );
}
