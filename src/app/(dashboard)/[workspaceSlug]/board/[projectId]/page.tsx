import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

interface ProjectBoardPageProps {
  params: Promise<{ workspaceSlug: string; projectId: string }>;
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

  return (
    <div className="px-8 py-6">
      <div className="max-w-[900px] rounded-lg border border-border-subtle bg-bg-surface p-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{project.icon ?? "📁"}</span>
          <div>
            <h1 className="text-2xl font-semibold text-content-primary">{project.name}</h1>
            <p className="text-sm text-content-muted">Kanban projektu w przygotowaniu.</p>
          </div>
        </div>
        <div className="mt-6 rounded-md border border-border-subtle bg-bg-base p-4 text-sm text-content-secondary">
          Kolor projektu: <span style={{ color: project.color ?? "#38BDF8" }}>{project.color ?? "#38BDF8"}</span>
        </div>
      </div>
    </div>
  );
}
