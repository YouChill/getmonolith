import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface UpdateProjectPayload {
  name?: string;
  icon?: string;
  color?: string;
}

async function ensureProjectAccess(projectId: string, userId: string) {
  const supabase = await createServerClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, workspace_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return { data: null, error: "Project not found", status: 404 as const, supabase };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", project.workspace_id)
    .eq("user_id", userId)
    .single();

  if (membershipError || !membership) {
    return { data: null, error: "Forbidden", status: 403 as const, supabase };
  }

  return { data: project, error: null, status: 200 as const, supabase };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const access = await ensureProjectAccess(id, user.id);

  if (access.error || !access.data) {
    return NextResponse.json({ data: null, error: access.error }, { status: access.status });
  }

  let body: UpdateProjectPayload;
  try {
    body = (await request.json()) as UpdateProjectPayload;
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }
  const updates: Record<string, string> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }

  if (typeof body.icon === "string") {
    updates.icon = body.icon.trim() || "📁";
  }

  if (typeof body.color === "string") {
    updates.color = body.color.trim() || "#38BDF8";
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ data: null, error: "Brak danych do aktualizacji." }, { status: 400 });
  }

  const { data, error } = await access.supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select("id, name, icon, color")
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null, error: error?.message ?? "Nie udało się zaktualizować projektu." }, { status: 500 });
  }

  return NextResponse.json({ data, error: null });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const access = await ensureProjectAccess(id, user.id);

  if (access.error || !access.data) {
    return NextResponse.json({ data: null, error: access.error }, { status: access.status });
  }

  const { error: deleteBlocksError } = await access.supabase
    .from("blocks")
    .delete()
    .eq("project_id", id);

  if (deleteBlocksError) {
    return NextResponse.json(
      { data: null, error: "Nie udało się usunąć bloków projektu." },
      { status: 500 }
    );
  }

  const { error: deleteProjectError } = await access.supabase
    .from("projects")
    .delete()
    .eq("id", id);

  if (deleteProjectError) {
    return NextResponse.json({ data: null, error: "Nie udało się usunąć projektu." }, { status: 500 });
  }

  return NextResponse.json({ data: { id }, error: null });
}
