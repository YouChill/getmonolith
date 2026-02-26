import { NextResponse } from "next/server";
import { TASK_STATUSES, type TaskStatus } from "@/lib/db/types";
import { createServerClient } from "@/lib/supabase/server";

interface CreateBlockPayload {
  workspaceId?: string;
  projectId?: string;
  parentBlockId?: string | null;
  type?: string;
  title?: string;
  status?: TaskStatus;
  dueDate?: string;
  priority?: "low" | "medium" | "high" | "urgent";
}

function isTaskStatus(value?: string): value is TaskStatus {
  if (!value) {
    return false;
  }

  return TASK_STATUSES.includes(value as TaskStatus);
}

function isDueDate(value?: string): boolean {
  if (!value) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(request: Request) {
  const supabase = await createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CreateBlockPayload;

  if (!body.workspaceId) {
    return NextResponse.json({ data: null, error: "workspaceId jest wymagane." }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ data: null, error: "Tytuł jest wymagany." }, { status: 400 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", body.workspaceId)
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    return NextResponse.json({ data: null, error: "Brak dostępu do workspace." }, { status: 403 });
  }

  if (body.type === "task") {
    if (!body.projectId) {
      return NextResponse.json({ data: null, error: "projectId jest wymagane dla task." }, { status: 400 });
    }

    if (!isTaskStatus(body.status)) {
      return NextResponse.json({ data: null, error: "Nieprawidłowy status zadania." }, { status: 400 });
    }

    if (!isDueDate(body.dueDate)) {
      return NextResponse.json({ data: null, error: "Nieprawidłowy format due date (YYYY-MM-DD)." }, { status: 400 });
    }

    const { data: lastTask } = await supabase
      .from("blocks")
      .select("position")
      .eq("workspace_id", body.workspaceId)
      .eq("project_id", body.projectId)
      .eq("type", "task")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = (lastTask?.position ?? 0) + 1;

    const { data, error } = await supabase
      .from("blocks")
      .insert({
        workspace_id: body.workspaceId,
        project_id: body.projectId,
        type: "task",
        created_by: user.id,
        position: nextPosition,
        properties: {
          title: body.title.trim(),
          status: body.status,
          due_date: body.dueDate,
          priority: body.priority,
        },
      })
      .select("id, properties, position")
      .single();

    if (error || !data) {
      return NextResponse.json({ data: null, error: error?.message ?? "Nie udało się utworzyć zadania." }, { status: 500 });
    }

    return NextResponse.json({ data, error: null }, { status: 201 });
  }

  if (body.type === "page") {
    const { data: lastPage } = await supabase
      .from("blocks")
      .select("position")
      .eq("workspace_id", body.workspaceId)
      .eq("type", "page")
      .is("parent_block_id", body.parentBlockId ?? null)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = (lastPage?.position ?? 0) + 1;

    const { data, error } = await supabase
      .from("blocks")
      .insert({
        workspace_id: body.workspaceId,
        type: "page",
        created_by: user.id,
        parent_block_id: body.parentBlockId ?? null,
        position: nextPosition,
        properties: {
          title: body.title.trim(),
          icon: "📝",
        },
        content: [],
      })
      .select("id, parent_block_id, position, properties")
      .single();

    if (error || !data) {
      return NextResponse.json({ data: null, error: error?.message ?? "Nie udało się utworzyć strony." }, { status: 500 });
    }

    return NextResponse.json({ data, error: null }, { status: 201 });
  }

  return NextResponse.json({ data: null, error: "Dozwolone typy bloków: task i page." }, { status: 400 });
}
