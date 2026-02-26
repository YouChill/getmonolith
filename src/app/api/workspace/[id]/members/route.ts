import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface MemberRow {
  user_id: string;
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

  const memberOptions = (members ?? []).map((member) => ({
    id: member.user_id,
    label: member.user_id,
  }));

  return NextResponse.json({
    data: {
      workspaceId,
      currentUserId: user.id,
      members: memberOptions,
    },
    error: null,
  });
}
