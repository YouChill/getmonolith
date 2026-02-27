import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

type UpdateMemberPayload = {
  role?: "member" | "admin";
};

async function getActorMembership(supabase: Awaited<ReturnType<typeof createServerClient>>, workspaceId: string, userId: string) {
  return supabase
    .from("workspace_members")
    .select("role, accepted_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();
}

async function getTargetMembership(supabase: Awaited<ReturnType<typeof createServerClient>>, workspaceId: string, targetUserId: string) {
  return supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .single();
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  const { id: workspaceId, userId: targetUserId } = await context.params;
  const supabase = await createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  let body: UpdateMemberPayload;
  try {
    body = (await request.json()) as UpdateMemberPayload;
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }
  const role = body.role;

  if (!role || !["member", "admin"].includes(role)) {
    return NextResponse.json(
      { data: null, error: "Rola musi być jedną z wartości: member/admin." },
      { status: 400 }
    );
  }

  const { data: actorMembership, error: actorError } = await getActorMembership(supabase, workspaceId, user.id);

  if (actorError || !actorMembership || !actorMembership.accepted_at) {
    return NextResponse.json({ data: null, error: "Brak dostępu do workspace." }, { status: 403 });
  }

  if (!["owner", "admin"].includes(actorMembership.role)) {
    return NextResponse.json(
      { data: null, error: "Tylko owner/admin może zarządzać członkami." },
      { status: 403 }
    );
  }

  const { data: targetMembership, error: targetError } = await getTargetMembership(supabase, workspaceId, targetUserId);

  if (targetError || !targetMembership) {
    return NextResponse.json({ data: null, error: "Nie znaleziono członka." }, { status: 404 });
  }

  if (targetMembership.role === "owner") {
    return NextResponse.json(
      { data: null, error: "Nie można zmienić roli ownera." },
      { status: 403 }
    );
  }

  const { error: updateError } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId);

  if (updateError) {
    return NextResponse.json({ data: null, error: "Nie udało się zmienić roli." }, { status: 500 });
  }

  return NextResponse.json({ data: { userId: targetUserId, role }, error: null });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  const { id: workspaceId, userId: targetUserId } = await context.params;
  const supabase = await createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { data: actorMembership, error: actorError } = await getActorMembership(supabase, workspaceId, user.id);

  if (actorError || !actorMembership || !actorMembership.accepted_at) {
    return NextResponse.json({ data: null, error: "Brak dostępu do workspace." }, { status: 403 });
  }

  if (!["owner", "admin"].includes(actorMembership.role)) {
    return NextResponse.json(
      { data: null, error: "Tylko owner/admin może zarządzać członkami." },
      { status: 403 }
    );
  }

  const { data: targetMembership, error: targetError } = await getTargetMembership(supabase, workspaceId, targetUserId);

  if (targetError || !targetMembership) {
    return NextResponse.json({ data: null, error: "Nie znaleziono członka." }, { status: 404 });
  }

  if (targetMembership.role === "owner") {
    if (targetUserId === user.id) {
      return NextResponse.json(
        { data: null, error: "Owner nie może usunąć samego siebie." },
        { status: 403 }
      );
    }

    return NextResponse.json({ data: null, error: "Nie można usunąć ownera." }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId);

  if (deleteError) {
    return NextResponse.json({ data: null, error: "Nie udało się usunąć członka." }, { status: 500 });
  }

  return NextResponse.json({ data: { userId: targetUserId }, error: null });
}
