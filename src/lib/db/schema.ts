import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  real,
  primaryKey,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export const workspaces = pgTable("workspaces", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().unique().notNull(),
  type: text().notNull(),
  ownerId: uuid("owner_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  check("workspaces_type_check", sql`${table.type} IN ('personal', 'work')`),
]);

// ---------------------------------------------------------------------------
// Workspace Members
// ---------------------------------------------------------------------------

export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  role: text().notNull(),
  invitedAt: timestamp("invited_at", { withTimezone: true }).defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.userId] }),
  check("workspace_members_role_check", sql`${table.role} IN ('owner', 'admin', 'member')`),
]);

// ---------------------------------------------------------------------------
// Projects (Kanban boards inside a workspace)
// ---------------------------------------------------------------------------

export const projects = pgTable("projects", {
  id: uuid().primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text().notNull(),
  icon: text(),
  color: text(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Blocks — Unified Block Model (heart of the system)
// ---------------------------------------------------------------------------
// Block types:
//   'task'            — Kanban card, openable as a page
//   'page'            — Document / note
//   'text'            — Paragraph (child of page/task)
//   'heading1/2/3'    — Headings
//   'todo'            — Checkbox
//   'bulleted_list', 'numbered_list'
//   'divider', 'image', 'code'
//
// properties jsonb examples:
//   task:  { "status": "todo", "due_date": "2026-03-01", "priority": "high", "assigned_to": "uuid" }
//   page:  { "icon": "📄", "cover": "url" }
// ---------------------------------------------------------------------------

export const blocks = pgTable("blocks", {
  id: uuid().primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  parentBlockId: uuid("parent_block_id"),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "set null" }),
  type: text().notNull(),
  properties: jsonb().notNull().default({}),
  content: jsonb(),
  position: real().notNull().default(0),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  // Self-referencing FK for parent-child block hierarchy
  // (defined here because Drizzle doesn't allow inline self-ref)

  // Performance indexes
  index("idx_blocks_workspace").on(table.workspaceId),
  index("idx_blocks_parent").on(table.parentBlockId),
  index("idx_blocks_project").on(table.projectId),
  index("idx_blocks_type").on(table.type),
  // Partial indexes for task-specific queries on JSONB properties
  index("idx_blocks_due_date").on(sql`(${table.properties}->>'due_date')`).where(sql`${table.type} = 'task'`),
  index("idx_blocks_status").on(sql`(${table.properties}->>'status')`).where(sql`${table.type} = 'task'`),
]);

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const tags = pgTable("tags", {
  id: uuid().primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text().notNull(),
  color: text().notNull(),
});

// ---------------------------------------------------------------------------
// Block ↔ Tag (many-to-many)
// ---------------------------------------------------------------------------

export const blockTags = pgTable("block_tags", {
  blockId: uuid("block_id")
    .notNull()
    .references(() => blocks.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.blockId, table.tagId] }),
]);
