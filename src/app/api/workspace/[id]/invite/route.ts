import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type InvitePayload = {
  email?: string;
  role?: "member" | "admin";
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await context.params;
  const supabase = await createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  let body: InvitePayload;
  try {
    body = (await request.json()) as InvitePayload;
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }
  const email = body.email?.trim().toLowerCase();
  const role = body.role;

  if (!email || !role || !["member", "admin"].includes(role)) {
    return NextResponse.json(
      { data: null, error: "Pola email i rola (member/admin) są wymagane." },
      { status: 400 }
    );
  }

  const { data: ownerMembership, error: ownerError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (ownerError || ownerMembership?.role !== "owner") {
    return NextResponse.json(
      { data: null, error: "Tylko owner może zapraszać członków do workspace." },
      { status: 403 }
    );
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single();

  if (workspaceError || !workspace) {
    return NextResponse.json({ data: null, error: "Workspace nie istnieje." }, { status: 404 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { data: null, error: "Brak SUPABASE_SERVICE_ROLE_KEY w środowisku." },
      { status: 500 }
    );
  }

  const admin = createAdminClient();
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${new URL(request.url).origin}/auth/callback?next=/${workspace.slug}/settings/members`,
  });

  if (inviteError || !inviteData.user) {
    return NextResponse.json(
      { data: null, error: inviteError?.message ?? "Nie udało się wysłać zaproszenia." },
      { status: 500 }
    );
  }

  const { error: membershipError } = await admin
    .from("workspace_members")
    .upsert(
      {
        workspace_id: workspaceId,
        user_id: inviteData.user.id,
        role,
        invited_at: new Date().toISOString(),
        accepted_at: null,
      },
      { onConflict: "workspace_id,user_id" }
    );

  if (membershipError) {
    return NextResponse.json(
      { data: null, error: "Zaproszenie wysłane, ale nie udało się zapisać membership." },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { userId: inviteData.user.id, email, role }, error: null }, { status: 201 });
}
