import { NextResponse } from "next/server";
import { TASK_STATUSES, type TaskStatus } from "@/lib/db/types";
import { createServerClient } from "@/lib/supabase/server";

interface CreateBlockPayload {
  workspaceId?: string;
  projectId?: string;
  type?: string;
  title?: string;
  status?: TaskStatus;
}

function isTaskStatus(value?: string): value is TaskStatus {
  if (!value) {
    return false;
  }

  return TASK_STATUSES.includes(value as TaskStatus);
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

  if (body.type !== "task") {
    return NextResponse.json({ data: null, error: "Dozwolone jest tworzenie wyłącznie bloków task." }, { status: 400 });
  }

  if (!body.workspaceId || !body.projectId) {
    return NextResponse.json({ data: null, error: "workspaceId i projectId są wymagane." }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ data: null, error: "Tytuł jest wymagany." }, { status: 400 });
  }

  if (!isTaskStatus(body.status)) {
    return NextResponse.json({ data: null, error: "Nieprawidłowy status zadania." }, { status: 400 });
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
      },
    })
    .select("id, properties, position")
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null, error: error?.message ?? "Nie udało się utworzyć zadania." }, { status: 500 });
  }

  return NextResponse.json({ data, error: null }, { status: 201 });
}
