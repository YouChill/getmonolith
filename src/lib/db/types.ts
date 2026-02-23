import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  workspaces,
  workspaceMembers,
  projects,
  blocks,
  tags,
  blockTags,
} from "./schema";

// ---------------------------------------------------------------------------
// Select types (rows returned from queries)
// ---------------------------------------------------------------------------

export type Workspace = InferSelectModel<typeof workspaces>;
export type WorkspaceMember = InferSelectModel<typeof workspaceMembers>;
export type Project = InferSelectModel<typeof projects>;
export type Block = InferSelectModel<typeof blocks>;
export type Tag = InferSelectModel<typeof tags>;
export type BlockTag = InferSelectModel<typeof blockTags>;

// ---------------------------------------------------------------------------
// Insert types (rows used for creation)
// ---------------------------------------------------------------------------

export type NewWorkspace = InferInsertModel<typeof workspaces>;
export type NewWorkspaceMember = InferInsertModel<typeof workspaceMembers>;
export type NewProject = InferInsertModel<typeof projects>;
export type NewBlock = InferInsertModel<typeof blocks>;
export type NewTag = InferInsertModel<typeof tags>;
export type NewBlockTag = InferInsertModel<typeof blockTags>;

// ---------------------------------------------------------------------------
// Domain-specific types
// ---------------------------------------------------------------------------

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

export type BlockType =
  | "task"
  | "page"
  | "text"
  | "heading1"
  | "heading2"
  | "heading3"
  | "todo"
  | "bulleted_list"
  | "numbered_list"
  | "divider"
  | "image"
  | "code";

export type WorkspaceType = "personal" | "work";
export type MemberRole = "owner" | "admin" | "member";

export interface TaskProperties {
  status: TaskStatus;
  due_date?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
}

export interface PageProperties {
  icon?: string;
  cover?: string;
}
