import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

interface MemberRow {
  user_id: string;
}

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
  const supabase = await createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    return NextResponse.json({ data: null, error: "Brak dostępu do workspace." }, { status: 403 });
  }

  const { data: members, error: membersError } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .returns<MemberRow[]>();

  if (membersError) {
    return NextResponse.json({ data: null, error: "Nie udało się pobrać członków workspace." }, { status: 500 });
  }

  const admin = createAdminClient();

  const settled = await Promise.allSettled(
    (members ?? []).map(async (member) => {
      const { data: userData } = await admin.auth.admin.getUserById(member.user_id);
      const metadata = (userData?.user?.user_metadata ?? {}) as {
        full_name?: string;
        name?: string;
        avatar_url?: string;
        picture?: string;
      };

      const label = metadata.full_name?.trim() || metadata.name?.trim() || userData?.user?.email || member.user_id;

      return {
        id: member.user_id,
        label,
        avatarUrl: metadata.avatar_url || metadata.picture || undefined,
        initials: getInitials(label),
      };
    })
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
