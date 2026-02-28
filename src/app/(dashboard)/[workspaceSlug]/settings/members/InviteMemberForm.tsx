"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workspaceMembersQueryKey } from "@/lib/react-query/query-keys";
import { safeJson } from "@/lib/utils";

interface InviteMemberFormProps {
  workspaceId: string;
}

interface InviteResponse {
  data: { userId: string; email: string; role: string } | null;
  error: string | null;
}

export function InviteMemberForm({ workspaceId }: InviteMemberFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [success, setSuccess] = useState<string | null>(null);

  const inviteMutation = useMutation({
    mutationFn: async (vars: { email: string; role: "member" | "admin" }) => {
      const response = await fetch(`/api/workspace/${workspaceId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: vars.email, role: vars.role }),
      });

      const payload = await safeJson<InviteResponse>(response);

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Nie udało się wysłać zaproszenia.");
      }

      return payload.data;
    },
    onSuccess: (data) => {
      setSuccess(`Zaproszenie wysłane do ${data.email}.`);
      setEmail("");
      setRole("member");
      router.refresh();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workspaceMembersQueryKey(workspaceId) });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    inviteMutation.reset();
    inviteMutation.mutate({ email, role });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border-subtle bg-bg-surface p-4">
      <h2 className="text-lg font-semibold text-content-primary">Zaproś nowego członka</h2>
      <p className="mt-1 text-sm text-content-muted">Owner może zapraszać użytkowników po emailu.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="np. anna@firma.pl"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-role">Rola</Label>
          <select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value as "member" | "admin")}
            className="h-10 w-full rounded-md border border-border-subtle bg-bg-base px-3 text-sm text-content-primary"
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </div>

      {inviteMutation.isError && (
        <p className="mt-3 text-sm text-destructive">{inviteMutation.error.message}</p>
      )}
      {success && <p className="mt-3 text-sm text-success">{success}</p>}

      <div className="mt-4">
        <Button type="submit" disabled={inviteMutation.isPending}>
          {inviteMutation.isPending ? "Wysyłanie..." : "Wyślij zaproszenie"}
        </Button>
      </div>
    </form>
  );
}
