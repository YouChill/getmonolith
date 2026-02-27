import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaceMembers } from "@/lib/db/schema";
import { getAuthUser, getMembershipWithRole } from "@/lib/db/queries";

type UpdateMemberPayload = {
  role?: "member" | "admin";
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; userId: string }> },
) {
  const { id: workspaceId, userId: targetUserId } = await context.params;
  const auth = await getAuthUser();

  if (!auth.data) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const user = auth.data;
  const body = (await request.json()) as UpdateMemberPayload;
  const role = body.role;

  if (!role || !["member", "admin"].includes(role)) {
    return NextResponse.json(
      { data: null, error: "Rola musi być jedną z wartości: member/admin." },
      { status: 400 },
    );
  }

  const actorMembership = await getMembershipWithRole(workspaceId, user.id);

  if (!actorMembership || !actorMembership.acceptedAt) {
    return NextResponse.json({ data: null, error: "Brak dostępu do workspace." }, { status: 403 });
  }

  if (!["owner", "admin"].includes(actorMembership.role)) {
    return NextResponse.json(
      { data: null, error: "Tylko owner/admin może zarządzać członkami." },
      { status: 403 },
    );
  }

  const targetMembership = await getMembershipWithRole(workspaceId, targetUserId);

  if (!targetMembership) {
    return NextResponse.json({ data: null, error: "Nie znaleziono członka." }, { status: 404 });
  }

  if (targetMembership.role === "owner") {
    return NextResponse.json(
      { data: null, error: "Nie można zmienić roli ownera." },
      { status: 403 },
    );
  }

  await db
    .update(workspaceMembers)
    .set({ role })
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId),
      ),
    );

  return NextResponse.json({ data: { userId: targetUserId, role }, error: null });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; userId: string }> },
) {
  const { id: workspaceId, userId: targetUserId } = await context.params;
  const auth = await getAuthUser();

  if (!auth.data) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const user = auth.data;
  const actorMembership = await getMembershipWithRole(workspaceId, user.id);

  if (!actorMembership || !actorMembership.acceptedAt) {
    return NextResponse.json({ data: null, error: "Brak dostępu do workspace." }, { status: 403 });
  }

  if (!["owner", "admin"].includes(actorMembership.role)) {
    return NextResponse.json(
      { data: null, error: "Tylko owner/admin może zarządzać członkami." },
      { status: 403 },
    );
  }

  const targetMembership = await getMembershipWithRole(workspaceId, targetUserId);

  if (!targetMembership) {
    return NextResponse.json({ data: null, error: "Nie znaleziono członka." }, { status: 404 });
  }

  if (targetMembership.role === "owner") {
    if (targetUserId === user.id) {
      return NextResponse.json(
        { data: null, error: "Owner nie może usunąć samego siebie." },
        { status: 403 },
      );
    }

    return NextResponse.json({ data: null, error: "Nie można usunąć ownera." }, { status: 403 });
  }

  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId),
      ),
    );

  return NextResponse.json({ data: { userId: targetUserId }, error: null });
}
