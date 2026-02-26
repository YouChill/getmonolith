import { create } from "zustand";

export type BoardSortOption = "position" | "due_date" | "priority";
export type BoardPriorityFilter = "all" | "high" | "medium" | "low";

interface BoardFiltersState {
  searchQuery: string;
  priority: BoardPriorityFilter;
  assignee: string;
  sortBy: BoardSortOption;
  setSearchQuery: (value: string) => void;
  setPriority: (value: BoardPriorityFilter) => void;
  setAssignee: (value: string) => void;
  setSortBy: (value: BoardSortOption) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTERS = {
  searchQuery: "",
  priority: "all" as const,
  assignee: "all",
  sortBy: "position" as const,
};

export const useBoardFiltersStore = create<BoardFiltersState>((set) => ({
  ...DEFAULT_FILTERS,
  setSearchQuery: (value) => set({ searchQuery: value }),
  setPriority: (value) => set({ priority: value }),
  setAssignee: (value) => set({ assignee: value }),
  setSortBy: (value) => set({ sortBy: value }),
  resetFilters: () => set(DEFAULT_FILTERS),
}));

