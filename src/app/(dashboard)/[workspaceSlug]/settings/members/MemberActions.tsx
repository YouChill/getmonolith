"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { workspaceMembersQueryKey } from "@/lib/react-query/query-keys";
import { safeJson } from "@/lib/utils";

interface MemberActionsProps {
  workspaceId: string;
  memberUserId: string;
  memberRole: "owner" | "admin" | "member";
  currentUserId: string;
  currentUserRole: "owner" | "admin" | "member";
}

interface RoleChangeResponse {
  data: { userId: string; role: string } | null;
  error: string | null;
}

interface DeleteMemberResponse {
  data: { userId: string } | null;
  error: string | null;
}

export function MemberActions({
  workspaceId,
  memberUserId,
  memberRole,
  currentUserId,
  currentUserRole,
}: MemberActionsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";
  const isSelf = memberUserId === currentUserId;
  const isOwnerRow = memberRole === "owner";

  // Optimistic local state for role
  const [optimisticRole, setOptimisticRole] = useState(memberRole);
  // Optimistic local state for deletion
  const [optimisticDeleted, setOptimisticDeleted] = useState(false);

  const nextRole = optimisticRole === "admin" ? "member" : "admin";

  // ── Change role mutation ──────────────────────────────────────────────
  const changeRoleMutation = useMutation({
    mutationFn: async (vars: { role: "member" | "admin" }) => {
      const response = await fetch(`/api/workspace/${workspaceId}/members/${memberUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: vars.role }),
      });

      const payload = await safeJson<RoleChangeResponse>(response);

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Nie udało się zmienić roli.");
      }

      return payload.data;
    },
    onMutate: async (vars) => {
      const previousRole = optimisticRole;
      setOptimisticRole(vars.role);
      return { previousRole };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        setOptimisticRole(ctx.previousRole);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workspaceMembersQueryKey(workspaceId) });
      router.refresh();
    },
  });

  // ── Delete member mutation ────────────────────────────────────────────
  const deleteMemberMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/workspace/${workspaceId}/members/${memberUserId}`, {
        method: "DELETE",
      });

      const payload = await safeJson<DeleteMemberResponse>(response);

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Nie udało się usunąć członka.");
      }

      return payload.data;
    },
    onMutate: async () => {
      setOptimisticDeleted(true);
      return { wasDeleted: false };
    },
    onError: (_err, _vars, _ctx) => {
      setOptimisticDeleted(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workspaceMembersQueryKey(workspaceId) });
      router.refresh();
    },
  });

  if (!canManage || isOwnerRow) {
    return <span className="text-xs text-content-muted">—</span>;
  }

  if (optimisticDeleted) {
    return <span className="text-xs text-content-muted opacity-60">Usuwanie…</span>;
  }

  const isPending = changeRoleMutation.isPending || deleteMemberMutation.isPending;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => changeRoleMutation.mutate({ role: nextRole })}
          disabled={isPending}
        >
          {changeRoleMutation.isPending ? "Zapisywanie..." : `Ustaw ${nextRole}`}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => deleteMemberMutation.mutate()}
          disabled={isPending || (isSelf && currentUserRole === "owner")}
          className="text-red-400 hover:text-red-300"
        >
          {deleteMemberMutation.isPending ? "Usuwanie..." : "Usuń"}
        </Button>
      </div>

      {isSelf && currentUserRole === "owner" && (
        <p className="text-xs text-content-muted">Owner nie może usunąć samego siebie.</p>
      )}

      {changeRoleMutation.isError && (
        <p className="text-xs text-red-400">{changeRoleMutation.error.message}</p>
      )}
      {deleteMemberMutation.isError && (
        <p className="text-xs text-red-400">{deleteMemberMutation.error.message}</p>
      )}
    </div>
  );
}
