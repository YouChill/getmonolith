import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { InviteMemberForm } from "./InviteMemberForm";

interface MembersPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

interface MemberRow {
  user_id: string;
  role: "owner" | "admin" | "member";
  invited_at: string | null;
  accepted_at: string | null;
}

export default async function MembersSettingsPage({ params }: MembersPageProps) {
  const { workspaceSlug } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) {
    redirect("/");
  }

  const { data: myMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();

  if (!myMembership) {
    redirect("/");
  }

  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id, role, invited_at, accepted_at")
    .eq("workspace_id", workspace.id)
    .order("invited_at", { ascending: true })
    .returns<MemberRow[]>();

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-content-primary">Członkowie workspace</h1>
        <p className="mt-1 text-sm text-content-muted">{workspace.name} — zarządzanie zaproszeniami i rolami.</p>
      </div>

      {myMembership.role === "owner" && <div className="mt-6"><InviteMemberForm workspaceId={workspace.id} /></div>}

      <section className="mt-6 rounded-lg border border-border-subtle bg-bg-surface">
        <div className="border-b border-border-subtle px-4 py-3">
          <h2 className="text-sm font-medium text-content-primary">Lista członków</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-bg-subtle text-content-muted">
              <tr>
                <th className="px-4 py-3 font-medium">User ID</th>
                <th className="px-4 py-3 font-medium">Rola</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Zaproszono</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((member) => (
                <tr key={member.user_id} className="border-t border-border-subtle">
                  <td className="px-4 py-3 font-mono text-xs text-content-secondary">{member.user_id}</td>
                  <td className="px-4 py-3 text-content-primary">{member.role}</td>
                  <td className="px-4 py-3 text-content-secondary">
                    {member.accepted_at ? "accepted" : "pending"}
                  </td>
                  <td className="px-4 py-3 text-content-secondary">
                    {member.invited_at ? new Date(member.invited_at).toLocaleString("pl-PL") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
