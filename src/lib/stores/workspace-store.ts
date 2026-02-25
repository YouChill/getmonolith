import { create } from "zustand";

interface WorkspaceState {
  activeWorkspaceSlug: string | null;
  setActiveWorkspace: (workspaceSlug: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspaceSlug: null,
  setActiveWorkspace: (workspaceSlug) => set({ activeWorkspaceSlug: workspaceSlug }),
}));
