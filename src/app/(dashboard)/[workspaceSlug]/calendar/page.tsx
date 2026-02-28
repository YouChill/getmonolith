import { notFound, redirect } from "next/navigation";
import { CalendarPageClient, type CalendarTaskEvent, type CalendarWorkspaceProject } from "@/components/calendar/calendar-page-client";
import { createServerClient } from "@/lib/supabase/server";

interface WorkspaceCalendarPageProps {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ month?: string }>;
}

interface TaskBlockRow {
  id: string;
  properties: {
    title?: string;
    due_date?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    status?: "todo" | "in_progress" | "done";
  };
}

function resolveMonth(monthParam?: string): Date {
  if (!monthParam) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  const match = monthParam.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  return new Date(Date.UTC(year, monthIndex, 1));
}

function formatMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export default async function WorkspaceCalendarPage({ params, searchParams }: WorkspaceCalendarPageProps) {
  const { workspaceSlug } = await params;
  const { month } = await searchParams;
  const activeMonth = resolveMonth(month);

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

  const monthStart = activeMonth.toISOString().slice(0, 10);
  const monthEndDate = new Date(Date.UTC(activeMonth.getUTCFullYear(), activeMonth.getUTCMonth() + 1, 0));
  const monthEnd = monthEndDate.toISOString().slice(0, 10);

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  const { data: tasks } = await supabase
    .from("blocks")
    .select("id, properties")
    .eq("workspace_id", workspace.id)
    .eq("type", "task")
    .gte("properties->>due_date", monthStart)
    .lte("properties->>due_date", monthEnd)
    .order("properties->>due_date", { ascending: true });

  const calendarEvents: CalendarTaskEvent[] = ((tasks ?? []) as TaskBlockRow[])
    .filter((task) => typeof task.properties?.due_date === "string")
    .map((task) => ({
      id: task.id,
      title: task.properties?.title?.trim() || "Bez tytułu",
      dueDate: task.properties.due_date as string,
      priority: task.properties?.priority,
      status: task.properties?.status,
    }));

  return (
    <div className="px-8 py-6">
      <CalendarPageClient
        workspaceSlug={workspaceSlug}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        activeMonth={formatMonthKey(activeMonth)}
        events={calendarEvents}
        projects={(projects ?? []) as CalendarWorkspaceProject[]}
      />
    </div>
  );
}
