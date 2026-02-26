"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteMemberFormProps {
  workspaceId: string;
}

export function InviteMemberForm({ workspaceId }: InviteMemberFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch(`/api/workspace/${workspaceId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Nie udało się wysłać zaproszenia.");
        return;
      }

      setSuccess(`Zaproszenie wysłane do ${email}.`);
      setEmail("");
      setRole("member");
      router.refresh();
    });
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

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-400">{success}</p>}

      <div className="mt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Wysyłanie..." : "Wyślij zaproszenie"}
        </Button>
      </div>
    </form>
  );
}
