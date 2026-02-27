import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blocks } from "@/lib/db/schema";
import { TASK_STATUSES, type TaskStatus } from "@/lib/db/types";
import { getAuthUser, getBlockWithAccessCheck, requireMembership } from "@/lib/db/queries";

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

function isTaskStatus(value?: string): value is TaskStatus {
  if (!value) {
    return false;
  }

  return TASK_STATUSES.includes(value as TaskStatus);
}

function isPriority(value?: string): value is NonNullable<BlockProperties["priority"]> {
  return value === "low" || value === "medium" || value === "high" || value === "urgent";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await getAuthUser();

  if (!auth.data) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const user = auth.data;
  const access = await getBlockWithAccessCheck(id, user.id);

  if (access.error || !access.data) {
    return NextResponse.json({ data: null, error: access.error }, { status: access.status });
  }

  let body: UpdateBlockPayload;
  try {
    body = (await request.json()) as UpdateBlockPayload;
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }
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

    if (typeof body.assigned_to === "string") {
      if (!isUuid(body.assigned_to)) {
        return NextResponse.json({ data: null, error: "assigned_to musi być UUID." }, { status: 400 });
      }

      const assigneeMembership = await requireMembership(access.data.workspaceId, body.assigned_to);

      if (!assigneeMembership) {
        return NextResponse.json({ data: null, error: "Użytkownik nie należy do workspace." }, { status: 400 });
      }
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

  const [updated] = await db
    .update(blocks)
    .set({
      properties: nextProperties,
      ...(typeof body.position === "number" ? { position: body.position } : {}),
      ...(typeof body.parent_block_id !== "undefined" ? { parentBlockId: body.parent_block_id } : {}),
      ...(typeof body.content !== "undefined" ? { content: body.content } : {}),
      updatedAt: new Date(),
    })
    .where(eq(blocks.id, id))
    .returning({
      id: blocks.id,
      type: blocks.type,
      properties: blocks.properties,
      content: blocks.content,
      position: blocks.position,
      parentBlockId: blocks.parentBlockId,
    });

  if (!updated) {
    return NextResponse.json({ data: null, error: "Nie udało się zaktualizować bloku." }, { status: 500 });
  }

  return NextResponse.json({ data: updated, error: null });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await getAuthUser();

  if (!auth.data) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const user = auth.data;
  const access = await getBlockWithAccessCheck(id, user.id);

  if (access.error || !access.data) {
    return NextResponse.json({ data: null, error: access.error }, { status: access.status });
  }

  const [block] = await db
    .select({
      id: blocks.id,
      type: blocks.type,
      workspaceId: blocks.workspaceId,
      projectId: blocks.projectId,
      properties: blocks.properties,
      content: blocks.content,
      position: blocks.position,
      parentBlockId: blocks.parentBlockId,
    })
    .from(blocks)
    .where(eq(blocks.id, id))
    .limit(1);

  if (!block) {
    return NextResponse.json({ data: null, error: "Nie udało się pobrać bloku." }, { status: 500 });
  }

  return NextResponse.json({ data: block, error: null });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await getAuthUser();

  if (!auth.data) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const user = auth.data;
  const access = await getBlockWithAccessCheck(id, user.id);

  if (access.error || !access.data) {
    return NextResponse.json({ data: null, error: access.error }, { status: access.status });
  }

  const deleted = await db.delete(blocks).where(eq(blocks.id, id)).returning({ id: blocks.id });

  if (!deleted.length) {
    return NextResponse.json({ data: null, error: "Nie udało się usunąć bloku." }, { status: 500 });
  }

  return NextResponse.json({ data: { id }, error: null });
}
