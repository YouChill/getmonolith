import { NextResponse } from "next/server";
import { TASK_STATUSES, type TaskStatus } from "@/lib/db/types";
import { createServerClient } from "@/lib/supabase/server";

interface UpdateBlockPayload {
  title?: string;
  status?: TaskStatus;
  due_date?: string | null;
  priority?: "low" | "medium" | "high" | "urgent" | null;
  assigned_to?: string | null;
  position?: number;
  parent_block_id?: string | null;
  content?: unknown;
  icon?: string;
}

interface BlockProperties {
  title?: string;
  status?: TaskStatus;
  due_date?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
  icon?: string;
}

interface AccessibleBlock {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  content?: unknown;
  position?: number;
  type: string;
  properties: BlockProperties | null;
}

function isTaskStatus(value?: string): value is TaskStatus {
  if (!value) {
    return false;
  }

  return TASK_STATUSES.includes(value as TaskStatus);
}

function isPriority(value?: string): value is NonNullable<BlockProperties["priority"]> {
  return value === "low" || value === "medium" || value === "high" || value === "urgent";
}

async function ensureBlockAccess(blockId: string, userId: string) {
  const supabase = await createServerClient();

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("id, workspace_id, type, properties")
    .eq("id", blockId)
    .single<AccessibleBlock>();

  if (blockError || !block) {
    return { data: null, error: "Block not found", status: 404 as const, supabase };
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

  const access = await ensureBlockAccess(id, user.id);

  if (access.error || !access.data) {
    return NextResponse.json({ data: null, error: access.error }, { status: access.status });
  }

  const body = (await request.json()) as UpdateBlockPayload;
  const currentProperties = (access.data.properties ?? {}) as BlockProperties;

  if (typeof body.title === "string" && !body.title.trim()) {
    return NextResponse.json({ data: null, error: "Tytuł jest wymagany." }, { status: 400 });
  }

  if (typeof body.position !== "undefined" && (!Number.isFinite(body.position) || body.position <= 0)) {
    return NextResponse.json({ data: null, error: "Nieprawidłowa pozycja bloku." }, { status: 400 });
  }

  if (access.data.type === "task") {
    if (typeof body.status === "string" && !isTaskStatus(body.status)) {
      return NextResponse.json({ data: null, error: "Nieprawidłowy status zadania." }, { status: 400 });
    }

    if (typeof body.priority === "string" && !isPriority(body.priority)) {
      return NextResponse.json({ data: null, error: "Nieprawidłowy priorytet zadania." }, { status: 400 });
    }
  }

  const hasUpdatableFields =
    typeof body.title === "string" ||
    typeof body.status === "string" ||
    typeof body.position === "number" ||
    typeof body.due_date !== "undefined" ||
    typeof body.priority !== "undefined" ||
    typeof body.assigned_to !== "undefined" ||
    typeof body.parent_block_id !== "undefined" ||
    typeof body.content !== "undefined" ||
    typeof body.icon !== "undefined";

  if (!hasUpdatableFields) {
    return NextResponse.json({ data: null, error: "Brak danych do aktualizacji." }, { status: 400 });
  }

  const nextProperties: BlockProperties = {
    ...currentProperties,
    ...(typeof body.title === "string" ? { title: body.title.trim() } : {}),
  };

  if (access.data.type === "task") {
    if (typeof body.status === "string") {
      nextProperties.status = body.status;
    }

    if (typeof body.due_date !== "undefined") {
      if (body.due_date) {
        nextProperties.due_date = body.due_date;
      } else {
        delete nextProperties.due_date;
      }
    }

    if (typeof body.priority !== "undefined") {
      if (body.priority) {
        nextProperties.priority = body.priority;
      } else {
        delete nextProperties.priority;
      }
    }

    if (typeof body.assigned_to !== "undefined") {
      if (body.assigned_to) {
        nextProperties.assigned_to = body.assigned_to;
      } else {
        delete nextProperties.assigned_to;
      }
    }
  }
  if (access.data.type === "page" && typeof body.icon === "string") {
    nextProperties.icon = body.icon.trim() || "📝";
  }


  const { data, error } = await access.supabase
    .from("blocks")
    .update({
      properties: nextProperties,
      ...(typeof body.position === "number" ? { position: body.position } : {}),
      ...(typeof body.parent_block_id !== "undefined" ? { parent_block_id: body.parent_block_id } : {}),
      ...(typeof body.content !== "undefined" ? { content: body.content } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, type, properties, content, position, parent_block_id")
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null, error: error?.message ?? "Nie udało się zaktualizować bloku." }, { status: 500 });
  }

  return NextResponse.json({ data, error: null });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const access = await ensureBlockAccess(id, user.id);

  if (access.error || !access.data) {
    return NextResponse.json({ data: null, error: access.error }, { status: access.status });
  }

  const { data, error } = await access.supabase
    .from("blocks")
    .select("id, type, workspace_id, project_id, properties, content, position, parent_block_id")
    .eq("id", id)
    .single<AccessibleBlock>();

  if (error || !data) {
    return NextResponse.json({ data: null, error: error?.message ?? "Nie udało się pobrać bloku." }, { status: 500 });
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

  const access = await ensureBlockAccess(id, user.id);

  if (access.error || !access.data) {
    return NextResponse.json({ data: null, error: access.error }, { status: access.status });
  }

  const { error } = await access.supabase.from("blocks").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ data: null, error: "Nie udało się usunąć bloku." }, { status: 500 });
  }

  return NextResponse.json({ data: { id }, error: null });
}
