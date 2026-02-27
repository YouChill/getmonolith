import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blocks, projects } from "@/lib/db/schema";
import { getAuthUser, getProjectWithAccessCheck } from "@/lib/db/queries";

interface UpdateProjectPayload {
  name?: string;
  icon?: string;
  color?: string;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await getAuthUser();

  if (!auth.data) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const user = auth.data;
  const access = await getProjectWithAccessCheck(id, user.id);

  if (access.error || !access.data) {
    return NextResponse.json({ data: null, error: access.error }, { status: access.status });
  }

  const body = (await request.json()) as UpdateProjectPayload;
  const updates: Partial<{ name: string; icon: string; color: string }> = {};

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

  const [updated] = await db
    .update(projects)
    .set(updates)
    .where(eq(projects.id, id))
    .returning({
      id: projects.id,
      name: projects.name,
      icon: projects.icon,
      color: projects.color,
    });

  if (!updated) {
    return NextResponse.json({ data: null, error: "Nie udało się zaktualizować projektu." }, { status: 500 });
  }

  return NextResponse.json({ data: updated, error: null });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await getAuthUser();

  if (!auth.data) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const user = auth.data;
  const access = await getProjectWithAccessCheck(id, user.id);

  if (access.error || !access.data) {
    return NextResponse.json({ data: null, error: access.error }, { status: access.status });
  }

  await db.delete(blocks).where(eq(blocks.projectId, id));

  const deleted = await db.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });

  if (!deleted.length) {
    return NextResponse.json({ data: null, error: "Nie udało się usunąć projektu." }, { status: 500 });
  }

  return NextResponse.json({ data: { id }, error: null });
}
