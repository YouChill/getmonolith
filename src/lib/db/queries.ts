import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers, blocks, projects } from "@/lib/db/schema";
import { createServerClient } from "@/lib/supabase/server";
import type { MemberRole } from "./types";

// ---------------------------------------------------------------------------
// Auth — still via Supabase (reads session cookies)
// ---------------------------------------------------------------------------

export async function getAuthUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { data: null, error: error?.message ?? "Unauthorized" };
  }

  return { data: user, error: null };
}

// ---------------------------------------------------------------------------
// Workspace membership helpers
// ---------------------------------------------------------------------------

export async function requireMembership(workspaceId: string, userId: string) {
  const [row] = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function getMembershipWithRole(workspaceId: string, userId: string) {
  const [row] = await db
    .select({
      role: workspaceMembers.role,
      acceptedAt: workspaceMembers.acceptedAt,
    })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1);

  return row ?? null;
}

// ---------------------------------------------------------------------------
// Workspace lookups
// ---------------------------------------------------------------------------

export async function getWorkspaceBySlug(slug: string) {
  const [row] = await db
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);

  return row ?? null;
}

export async function getWorkspaceById(id: string) {
  const [row] = await db
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .limit(1);

  return row ?? null;
}

// ---------------------------------------------------------------------------
// Block access check
// ---------------------------------------------------------------------------

export async function getBlockWithAccessCheck(blockId: string, userId: string) {
  const [block] = await db
    .select({
      id: blocks.id,
      workspaceId: blocks.workspaceId,
      projectId: blocks.projectId,
      type: blocks.type,
      properties: blocks.properties,
      content: blocks.content,
      position: blocks.position,
      parentBlockId: blocks.parentBlockId,
    })
    .from(blocks)
    .where(eq(blocks.id, blockId))
    .limit(1);

  if (!block) {
    return { data: null, error: "Block not found" as const, status: 404 as const };
  }

  const membership = await requireMembership(block.workspaceId, userId);

  if (!membership) {
    return { data: null, error: "Forbidden" as const, status: 403 as const };
  }

  return { data: block, error: null, status: 200 as const };
}

// ---------------------------------------------------------------------------
// Project access check
// ---------------------------------------------------------------------------

export async function getProjectWithAccessCheck(projectId: string, userId: string) {
  const [project] = await db
    .select({
      id: projects.id,
      workspaceId: projects.workspaceId,
      name: projects.name,
      icon: projects.icon,
      color: projects.color,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return { data: null, error: "Project not found" as const, status: 404 as const };
  }

  const membership = await requireMembership(project.workspaceId, userId);

  if (!membership) {
    return { data: null, error: "Forbidden" as const, status: 403 as const };
  }

  return { data: project, error: null, status: 200 as const };
}
