import { NextResponse } from "next/server";
import { TASK_STATUSES, type TaskStatus } from "@/lib/db/types";
import { createServerClient } from "@/lib/supabase/server";

interface UpdateBlockPayload {
  title?: string;
  status?: TaskStatus;
  position?: number;
}

interface TaskProperties {
  title?: string;
  status?: TaskStatus;
  due_date?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
}

function isTaskStatus(value?: string): value is TaskStatus {
  if (!value) {
    return false;
  }

  return TASK_STATUSES.includes(value as TaskStatus);
}

async function ensureTaskAccess(taskId: string, userId: string) {
  const supabase = await createServerClient();

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("id, workspace_id, type, properties")
    .eq("id", taskId)
    .single();

  if (blockError || !block) {
    return { data: null, error: "Task not found", status: 404 as const, supabase };
  }

  if (block.type !== "task") {
    return { data: null, error: "Block is not a task", status: 400 as const, supabase };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", block.workspace_id)
    .eq("user_id", userId)
    .single();

  if (membershipError || !membership) {
    return { data: null, error: "Forbidden", status: 403 as const, supabase };
  }

  return { data: block, error: null, status: 200 as const, supabase };
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

  const access = await ensureTaskAccess(id, user.id);

  if (access.error || !access.data) {
    return NextResponse.json({ data: null, error: access.error }, { status: access.status });
  }

  const body = (await request.json()) as UpdateBlockPayload;
  const currentProperties = (access.data.properties ?? {}) as TaskProperties;

  if (typeof body.title === "string" && !body.title.trim()) {
    return NextResponse.json({ data: null, error: "Tytuł jest wymagany." }, { status: 400 });
  }

  if (typeof body.status === "string" && !isTaskStatus(body.status)) {
    return NextResponse.json({ data: null, error: "Nieprawidłowy status zadania." }, { status: 400 });
  }

  if (typeof body.position !== "undefined" && (!Number.isFinite(body.position) || body.position <= 0)) {
    return NextResponse.json({ data: null, error: "Nieprawidłowa pozycja zadania." }, { status: 400 });
  }

  if (typeof body.title !== "string" && typeof body.status !== "string" && typeof body.position !== "number") {
    return NextResponse.json({ data: null, error: "Brak danych do aktualizacji." }, { status: 400 });
  }

  const nextProperties: TaskProperties = {
    ...currentProperties,
    ...(typeof body.title === "string" ? { title: body.title.trim() } : {}),
    ...(typeof body.status === "string" ? { status: body.status } : {}),
  };

  const { data, error } = await access.supabase
    .from("blocks")
    .update({
      properties: nextProperties,
      ...(typeof body.position === "number" ? { position: body.position } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, properties, position")
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null, error: error?.message ?? "Nie udało się zaktualizować zadania." }, { status: 500 });
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

  const access = await ensureTaskAccess(id, user.id);

  if (access.error || !access.data) {
    return NextResponse.json({ data: null, error: access.error }, { status: access.status });
  }

  const { error } = await access.supabase.from("blocks").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ data: null, error: "Nie udało się usunąć zadania." }, { status: 500 });
  }

  return NextResponse.json({ data: { id }, error: null });
}
