import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Strona główna — przekierowuje na podstawie stanu autentykacji.
 *
 * - Zalogowany → pierwszy workspace (po slug)
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

  // Brak workspace — redirect do loginu (workspace powinien być tworzony przy rejestracji)
  redirect("/login");
}
