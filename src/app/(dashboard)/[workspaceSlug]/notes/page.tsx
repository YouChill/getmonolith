import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

interface NotesPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
}

interface RecentPage {
  id: string;
  updated_at: string;
  properties: { title?: string; icon?: string } | null;
}

export default async function NotesPage({ params }: NotesPageProps) {
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

  const { data: recentPages } = await supabase
    .from("blocks")
    .select("id, updated_at, properties")
    .eq("workspace_id", workspace.id)
    .eq("type", "page")
    .order("updated_at", { ascending: false })
    .limit(12)
    .returns<RecentPage[]>();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-content-primary">Notatki — {workspace.name}</h1>
      <p className="mt-2 text-sm text-content-muted">Ostatnio edytowane strony</p>

      <div className="mt-6 rounded-lg border border-border-subtle bg-bg-surface">
        {(recentPages ?? []).length ? (
          <ul className="divide-y divide-border-subtle">
            {(recentPages ?? []).map((page) => (
              <li key={page.id}>
                <Link
                  href={`/${workspaceSlug}/block/${page.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm transition hover:bg-bg-elevated"
                >
                  <span className="truncate text-content-primary">{page.properties?.title?.trim() || "Bez tytułu"}</span>
                  <span className="ml-4 shrink-0 text-xs text-content-muted">
                    {new Date(page.updated_at).toLocaleString("pl-PL")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-content-muted">Brak stron. Utwórz pierwszą stronę w sidebarze.</p>
        )}
      </div>
    </div>
  );
}
