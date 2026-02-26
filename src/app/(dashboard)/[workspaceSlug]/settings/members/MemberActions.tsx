"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface MemberActionsProps {
  workspaceId: string;
  memberUserId: string;
  memberRole: "owner" | "admin" | "member";
  currentUserId: string;
  currentUserRole: "owner" | "admin" | "member";
}

export function MemberActions({
  workspaceId,
  memberUserId,
  memberRole,
  currentUserId,
  currentUserRole,
}: MemberActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";
  const isSelf = memberUserId === currentUserId;
  const isOwnerRow = memberRole === "owner";

  if (!canManage || isOwnerRow) {
    return <span className="text-xs text-content-muted">—</span>;
  }

  const nextRole = memberRole === "admin" ? "member" : "admin";

  function handleRoleChange() {
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/workspace/${workspaceId}/members/${memberUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Nie udało się zmienić roli.");
        return;
      }

      router.refresh();
    });
  }

  function handleDelete() {
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/workspace/${workspaceId}/members/${memberUserId}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Nie udało się usunąć członka.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={handleRoleChange} disabled={pending}>
          {pending ? "Zapisywanie..." : `Ustaw ${nextRole}`}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={pending || (isSelf && currentUserRole === "owner")}
          className="text-red-400 hover:text-red-300"
        >
          Usuń
        </Button>
      </div>

      {isSelf && currentUserRole === "owner" && (
        <p className="text-xs text-content-muted">Owner nie może usunąć samego siebie.</p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
