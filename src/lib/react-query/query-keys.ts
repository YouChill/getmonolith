export const blockQueryKey = (blockId: string) => ["block", blockId] as const;

export const boardColumnsQueryKey = (workspaceSlug: string, projectId: string) =>
  ["board-columns", workspaceSlug, projectId] as const;

export const calendarEventsQueryKey = (workspaceSlug: string, activeMonth: string) =>
  ["calendar-events", workspaceSlug, activeMonth] as const;

export const workspaceMembersQueryKey = (workspaceId: string) =>
  ["workspace-members", workspaceId] as const;

export const sidebarProjectsQueryKey = (workspaceId: string) =>
  ["sidebar-projects", workspaceId] as const;

export const notesTreeQueryKey = (workspaceId: string) =>
  ["notes-tree", workspaceId] as const;
