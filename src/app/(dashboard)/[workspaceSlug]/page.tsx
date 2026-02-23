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

  // Sprawdź, czy workspace istnieje i użytkownik ma do niego dostęp
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) {
    redirect("/");
  }

  // Sprawdź membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-base px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-content-primary">
          {workspace.name}
        </h1>
        <p className="mt-2 text-content-muted">
          Workspace jest gotowy. Sidebar, projekty i widok Kanban — wkrótce.
        </p>
      </div>
    </div>
  );
}
