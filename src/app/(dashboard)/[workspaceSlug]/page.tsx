import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

interface WorkspacePageProps {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Strona główna workspace'a — na razie przekierowuje do pierwszego projektu (board)
 * lub wyświetla placeholder gdy brak projektów.
 */
export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspaceSlug } = await params;
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
    redirect("/");
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    redirect("/");
  }

  const { data: firstProject } = await supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (firstProject) {
    redirect(`/${workspaceSlug}/board/${firstProject.id}`);
  }

  return (
    <div className="px-8 py-6">
      <div className="max-w-[720px]">
        <h1 className="text-2xl font-semibold text-content-primary">{workspace.name}</h1>
        <p className="mt-2 text-content-muted">
          Brak projektów. Utwórz pierwszy projekt, aby rozpocząć pracę z tablicą.
        </p>
      </div>
    </div>
  );
}
