import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Sidebar, SidebarSkeleton } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

interface DashboardShellProps {
  children: React.ReactNode;
  workspaceSlug: string;
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
    .select("workspace_id")
    .eq("user_id", user.id);

  if (membershipsError || !memberships?.length) {
    redirect("/");
  }

  const workspaceIds = memberships.map((membership) => membership.workspace_id);

  const { data: workspaces, error: workspacesError } = await supabase
    .from("workspaces")
    .select("id, name, slug, type")
    .in("id", workspaceIds)
    .order("created_at", { ascending: true });

  if (workspacesError || !workspaces?.length) {
    redirect("/");
  }

  const currentWorkspace = workspaces.find((workspace) => workspace.slug === workspaceSlug);

  if (!currentWorkspace) {
    redirect(`/${workspaces[0].slug}`);
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("workspace_id", currentWorkspace.id)
    .order("created_at", { ascending: true });

  return (
    <>
      <Sidebar
        currentWorkspaceSlug={workspaceSlug}
        workspaces={workspaces}
        projects={projects ?? []}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar workspaceName={currentWorkspace.name} userEmail={user.email ?? user.id} />
        <main className="flex-1 overflow-y-auto bg-bg-base">{children}</main>
      </div>
    </>
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
