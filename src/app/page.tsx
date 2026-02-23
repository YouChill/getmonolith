import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { ensureWorkspacesExist } from "@/lib/db/ensure-workspaces";

/**
 * Strona główna — przekierowuje na podstawie stanu autentykacji.
 *
 * - Zalogowany → pierwszy workspace (po slug)
 *   - Jeśli brak workspace'ów — automatycznie tworzy dwa domyślne
 * - Niezalogowany → /login
 */
export default async function HomePage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Pobierz pierwszy workspace użytkownika
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (membership) {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("slug")
      .eq("id", membership.workspace_id)
      .single();

    if (workspace) {
      redirect(`/${workspace.slug}`);
    }
  }

  // Brak workspace — auto-tworzenie domyślnych workspace'ów
  const slug = await ensureWorkspacesExist(user.id, user.email ?? user.id);
  redirect(`/${slug}`);
}
