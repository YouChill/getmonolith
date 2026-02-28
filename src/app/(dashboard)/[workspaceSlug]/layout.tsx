import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Sidebar, SidebarSkeleton } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { ReactQueryProvider } from "@/components/providers/react-query-provider";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

interface DashboardShellProps {
  children: React.ReactNode;
  workspaceSlug: string;
}

interface WorkspaceMembership {
  workspace: {
    id: string;
    name: string;
    slug: string;
    type: "personal" | "work";
    created_at: string;
  } | null;
}

interface PageItem {
  id: string;
  parent_block_id: string | null;
  position: number;
  properties: {
    title?: string;
  } | null;
}

async function DashboardShell({ children, workspaceSlug }: DashboardShellProps) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("workspace_members")
    .select("workspace:workspaces(id, name, slug, type, created_at)")
    .eq("user_id", user.id)
    .returns<WorkspaceMembership[]>();

  if (membershipsError || !memberships?.length) {
    redirect("/");
  }

  const workspaces = memberships
    .map((membership) => membership.workspace)
    .filter((workspace): workspace is NonNullable<WorkspaceMembership["workspace"]> => workspace !== null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  if (!workspaces.length) {
    redirect("/");
  }

  const currentWorkspace = workspaces.find((workspace) => workspace.slug === workspaceSlug);

  if (!currentWorkspace) {
    redirect(`/${workspaces[0].slug}`);
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, icon, color")
    .eq("workspace_id", currentWorkspace.id)
    .order("created_at", { ascending: true });

  const { data: pages } = await supabase
    .from("blocks")
    .select("id, parent_block_id, position, properties")
    .eq("workspace_id", currentWorkspace.id)
    .eq("type", "page")
    .order("position", { ascending: true })
    .returns<PageItem[]>();

  return (
    <ReactQueryProvider>
      <Sidebar
        currentWorkspaceSlug={workspaceSlug}
        workspaceId={currentWorkspace.id}
        workspaces={workspaces}
        projects={projects ?? []}
        pages={pages ?? []}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar workspaceName={currentWorkspace.name} userEmail={user.email ?? user.id} />
        <main className="flex-1 overflow-y-auto bg-bg-base">{children}</main>
      </div>
    </ReactQueryProvider>
  );
}

function DashboardLayoutFallback() {
  return (
    <>
      <SidebarSkeleton />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-12 border-b border-border-subtle bg-bg-base" />
      </div>
    </>
  );
}

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const { workspaceSlug } = await params;

  return (
    <div className="flex min-h-screen bg-bg-base text-content-primary">
      <Suspense fallback={<DashboardLayoutFallback />}>
        <DashboardShell workspaceSlug={workspaceSlug}>{children}</DashboardShell>
      </Suspense>
    </div>
  );
}
