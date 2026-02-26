export const blockQueryKey = (blockId: string) => ["block", blockId] as const;

export const boardColumnsQueryKey = (workspaceSlug: string, projectId: string) =>
  ["board-columns", workspaceSlug, projectId] as const;
