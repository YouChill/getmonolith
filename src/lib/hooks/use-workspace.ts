"use client";

import { useQuery } from "@tanstack/react-query";
import { safeJson } from "@/lib/utils";

export interface WorkspaceMemberOption {
  id: string;
  label: string;
  avatarUrl?: string;
  initials: string;
}

interface UseWorkspaceResponse {
  workspaceId: string;
  currentUserId: string;
  members: WorkspaceMemberOption[];
}

interface WorkspaceApiResponse {
  data: UseWorkspaceResponse | null;
  error: string | null;
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/workspace/${workspaceId}/members`);
      const result = await safeJson<WorkspaceApiResponse>(response);

      // React Query catches this — throw is intentional for queryFn
      if (!response.ok || !result.data) {
        throw new Error(result.error ?? "Nie udało się pobrać workspace.");
      }

      return result.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
}
