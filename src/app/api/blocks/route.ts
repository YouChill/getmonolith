import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { blocks } from "@/lib/db/schema";
import { TASK_STATUSES, type TaskStatus, type TaskProperties, type PageProperties } from "@/lib/db/types";
import { getAuthUser, requireMembership } from "@/lib/db/queries";

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
  const auth = await getAuthUser();

  if (!auth.data) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const user = auth.data;
  const body = (await request.json()) as CreateBlockPayload;

  if (!body.workspaceId) {
    return NextResponse.json({ data: null, error: "workspaceId jest wymagane." }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ data: null, error: "Tytuł jest wymagany." }, { status: 400 });
  }

  const membership = await requireMembership(body.workspaceId, user.id);

  if (!membership) {
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

    const [lastTask] = await db
      .select({ position: blocks.position })
      .from(blocks)
      .where(
        and(
          eq(blocks.workspaceId, body.workspaceId),
          eq(blocks.projectId, body.projectId),
          eq(blocks.type, "task"),
        ),
      )
      .orderBy(desc(blocks.position))
      .limit(1);

    const nextPosition = (lastTask?.position ?? 0) + 1;

    const properties: TaskProperties & { title: string } = {
      title: body.title.trim(),
      status: body.status,
      ...(body.dueDate ? { due_date: body.dueDate } : {}),
      ...(body.priority ? { priority: body.priority } : {}),
    };

    const [created] = await db
      .insert(blocks)
      .values({
        workspaceId: body.workspaceId,
        projectId: body.projectId,
        type: "task",
        createdBy: user.id,
        position: nextPosition,
        properties,
      })
      .returning({
        id: blocks.id,
        properties: blocks.properties,
        position: blocks.position,
      });

    if (!created) {
      return NextResponse.json({ data: null, error: "Nie udało się utworzyć zadania." }, { status: 500 });
    }

    return NextResponse.json({ data: created, error: null }, { status: 201 });
  }

  if (body.type === "page") {
    const parentCondition = body.parentBlockId
      ? eq(blocks.parentBlockId, body.parentBlockId)
      : isNull(blocks.parentBlockId);

    const [lastPage] = await db
      .select({ position: blocks.position })
      .from(blocks)
      .where(
        and(
          eq(blocks.workspaceId, body.workspaceId),
          eq(blocks.type, "page"),
          parentCondition,
        ),
      )
      .orderBy(desc(blocks.position))
      .limit(1);

    const nextPosition = (lastPage?.position ?? 0) + 1;

    const properties: PageProperties & { title: string } = {
      title: body.title.trim(),
      icon: "📝",
    };

    const [created] = await db
      .insert(blocks)
      .values({
        workspaceId: body.workspaceId,
        type: "page",
        createdBy: user.id,
        parentBlockId: body.parentBlockId ?? null,
        position: nextPosition,
        properties,
        content: [],
      })
      .returning({
        id: blocks.id,
        parentBlockId: blocks.parentBlockId,
        position: blocks.position,
        properties: blocks.properties,
      });

    if (!created) {
      return NextResponse.json({ data: null, error: "Nie udało się utworzyć strony." }, { status: 500 });
    }

    return NextResponse.json({ data: created, error: null }, { status: 201 });
  }

  return NextResponse.json({ data: null, error: "Dozwolone typy bloków: task i page." }, { status: 400 });
}
