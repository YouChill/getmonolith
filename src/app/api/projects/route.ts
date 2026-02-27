import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

interface CreateProjectPayload {
  workspaceId?: string;
  name?: string;
  icon?: string;
  color?: string;
}

export async function POST(request: Request) {
  const supabase = await createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateProjectPayload;
  try {
    body = (await request.json()) as CreateProjectPayload;
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  if (!body.workspaceId || !body.name?.trim()) {
    return NextResponse.json(
      { data: null, error: "workspaceId i name są wymagane." },
      { status: 400 }
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", body.workspaceId)
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    return NextResponse.json({ data: null, error: "Brak dostępu do workspace." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      workspace_id: body.workspaceId,
      name: body.name.trim(),
      icon: body.icon?.trim() || "📁",
      color: body.color?.trim() || "#38BDF8",
    })
    .select("id, name, icon, color")
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null, error: error?.message ?? "Nie udało się utworzyć projektu." }, { status: 500 });
  }

  return NextResponse.json({ data, error: null }, { status: 201 });
}
