import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaceMembers } from "@/lib/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser, requireMembership } from "@/lib/db/queries";

function getInitials(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    return "?";
  }

  const chunks = normalized.split(/\s+/).filter(Boolean);

  if (chunks.length > 1) {
    return `${chunks[0][0] ?? ""}${chunks[1][0] ?? ""}`.toUpperCase();
  }

  return normalized.slice(0, 2).toUpperCase();
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await context.params;
  const auth = await getAuthUser();

  if (!auth.data) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const user = auth.data;
  const membership = await requireMembership(workspaceId, user.id);

  if (!membership) {
    return NextResponse.json({ data: null, error: "Brak dostępu do workspace." }, { status: 403 });
  }

  const members = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  const admin = createAdminClient();

  const memberOptions = await Promise.all(
    members.map(async (member) => {
      const { data: userData } = await admin.auth.admin.getUserById(member.userId);
      const metadata = (userData?.user?.user_metadata ?? {}) as {
        full_name?: string;
        name?: string;
        avatar_url?: string;
        picture?: string;
      };

      const label = metadata.full_name?.trim() || metadata.name?.trim() || userData?.user?.email || member.userId;

      return {
        id: member.userId,
        label,
        avatarUrl: metadata.avatar_url || metadata.picture || undefined,
        initials: getInitials(label),
      };
    }),
  );

  const memberOptions = settled
    .filter((result): result is PromiseFulfilledResult<{ id: string; label: string; avatarUrl: string | undefined; initials: string }> => result.status === "fulfilled")
    .map((result) => result.value);

  return NextResponse.json({
    data: {
      workspaceId,
      currentUserId: user.id,
      members: memberOptions,
    },
    error: null,
  });
}
