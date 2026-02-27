import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { getAuthUser, requireMembership } from "@/lib/db/queries";

interface CreateProjectPayload {
  workspaceId?: string;
  name?: string;
  icon?: string;
  color?: string;
}

export async function POST(request: Request) {
  const auth = await getAuthUser();

  if (!auth.data) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const user = auth.data;
  const body = (await request.json()) as CreateProjectPayload;

  if (!body.workspaceId || !body.name?.trim()) {
    return NextResponse.json(
      { data: null, error: "workspaceId i name są wymagane." },
      { status: 400 },
    );
  }

  const membership = await requireMembership(body.workspaceId, user.id);

  if (!membership) {
    return NextResponse.json({ data: null, error: "Brak dostępu do workspace." }, { status: 403 });
  }

  const [created] = await db
    .insert(projects)
    .values({
      workspaceId: body.workspaceId,
      name: body.name.trim(),
      icon: body.icon?.trim() || "📁",
      color: body.color?.trim() || "#38BDF8",
    })
    .returning({
      id: projects.id,
      name: projects.name,
      icon: projects.icon,
      color: projects.color,
    });

  if (!created) {
    return NextResponse.json({ data: null, error: "Nie udało się utworzyć projektu." }, { status: 500 });
  }

  return NextResponse.json({ data: created, error: null }, { status: 201 });
}
