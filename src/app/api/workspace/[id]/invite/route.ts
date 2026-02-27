import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers } from "@/lib/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, getMembershipWithRole } from "@/lib/db/queries";

type InvitePayload = {
  email?: string;
  role?: "member" | "admin";
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await context.params;
  const auth = await getAuthUser();

  if (!auth.data) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const user = auth.data;
  const body = (await request.json()) as InvitePayload;
  const email = body.email?.trim().toLowerCase();
  const role = body.role;

  if (!email || !role || !["member", "admin"].includes(role)) {
    return NextResponse.json(
      { data: null, error: "Pola email i rola (member/admin) są wymagane." },
      { status: 400 },
    );
  }

  const ownerMembership = await getMembershipWithRole(workspaceId, user.id);

  if (!ownerMembership || ownerMembership.role !== "owner") {
    return NextResponse.json(
      { data: null, error: "Tylko owner może zapraszać członków do workspace." },
      { status: 403 },
    );
  }

  const [workspace] = await db
    .select({ slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    return NextResponse.json({ data: null, error: "Workspace nie istnieje." }, { status: 404 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { data: null, error: "Brak SUPABASE_SERVICE_ROLE_KEY w środowisku." },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${new URL(request.url).origin}/auth/callback?next=/${workspace.slug}/settings/members`,
  });

  if (inviteError || !inviteData.user) {
    return NextResponse.json(
      { data: null, error: inviteError?.message ?? "Nie udało się wysłać zaproszenia." },
      { status: 500 },
    );
  }

  const now = new Date();

  await db
    .insert(workspaceMembers)
    .values({
      workspaceId,
      userId: inviteData.user.id,
      role,
      invitedAt: now,
      acceptedAt: null,
    })
    .onConflictDoUpdate({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      set: {
        role,
        invitedAt: now,
        acceptedAt: null,
      },
    });

  return NextResponse.json({ data: { userId: inviteData.user.id, email, role }, error: null }, { status: 201 });
}
