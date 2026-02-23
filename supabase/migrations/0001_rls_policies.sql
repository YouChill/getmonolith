-- ============================================================
-- Row Level Security (RLS) — workspace isolation policies
--
-- All access goes through workspace_members.
-- Never user_id = auth.uid() directly on content tables.
-- ============================================================

-- ------------------------------------------------------------
-- Helper functions (SECURITY DEFINER to bypass RLS on
-- workspace_members and avoid self-referencing policy issues)
-- ------------------------------------------------------------

-- Returns TRUE if the current user is an accepted member of the workspace.
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = (SELECT auth.uid())
      AND accepted_at IS NOT NULL
  );
$$;

-- Returns TRUE if the current user is an owner or admin of the workspace.
CREATE OR REPLACE FUNCTION public.is_workspace_admin(ws_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = (SELECT auth.uid())
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
  );
$$;

-- ============================================================
-- 1. WORKSPACES
-- ============================================================
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;

-- SELECT: owner always sees their workspace; accepted members see it too
CREATE POLICY "workspaces_select" ON "workspaces"
  FOR SELECT USING (
    owner_id = (SELECT auth.uid())
    OR public.is_workspace_member(id)
  );

-- INSERT: authenticated user creates workspace as owner
CREATE POLICY "workspaces_insert" ON "workspaces"
  FOR INSERT WITH CHECK (
    owner_id = (SELECT auth.uid())
  );

-- UPDATE: only workspace owner
CREATE POLICY "workspaces_update" ON "workspaces"
  FOR UPDATE USING (
    owner_id = (SELECT auth.uid())
  ) WITH CHECK (
    owner_id = (SELECT auth.uid())
  );

-- DELETE: only workspace owner
CREATE POLICY "workspaces_delete" ON "workspaces"
  FOR DELETE USING (
    owner_id = (SELECT auth.uid())
  );

-- ============================================================
-- 2. WORKSPACE_MEMBERS
-- ============================================================
ALTER TABLE "workspace_members" ENABLE ROW LEVEL SECURITY;

-- SELECT: user sees own rows + all members of workspaces they belong to
CREATE POLICY "workspace_members_select" ON "workspace_members"
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR public.is_workspace_member(workspace_id)
  );

-- INSERT: workspace owner (from workspaces table) or existing admin can add
CREATE POLICY "workspace_members_insert" ON "workspace_members"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = workspace_id
        AND owner_id = (SELECT auth.uid())
    )
    OR public.is_workspace_admin(workspace_id)
  );

-- UPDATE: owner or admin of the workspace
CREATE POLICY "workspace_members_update" ON "workspace_members"
  FOR UPDATE USING (
    public.is_workspace_admin(workspace_id)
  );

-- DELETE: member can leave (remove self) or owner/admin can remove others
CREATE POLICY "workspace_members_delete" ON "workspace_members"
  FOR DELETE USING (
    user_id = (SELECT auth.uid())
    OR public.is_workspace_admin(workspace_id)
  );

-- ============================================================
-- 3. PROJECTS
-- ============================================================
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON "projects"
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "projects_insert" ON "projects"
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "projects_update" ON "projects"
  FOR UPDATE
  USING  (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "projects_delete" ON "projects"
  FOR DELETE USING (public.is_workspace_member(workspace_id));

-- ============================================================
-- 4. BLOCKS
-- ============================================================
ALTER TABLE "blocks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks_select" ON "blocks"
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "blocks_insert" ON "blocks"
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "blocks_update" ON "blocks"
  FOR UPDATE
  USING  (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "blocks_delete" ON "blocks"
  FOR DELETE USING (public.is_workspace_member(workspace_id));

-- ============================================================
-- 5. TAGS
-- ============================================================
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select" ON "tags"
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY "tags_insert" ON "tags"
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "tags_update" ON "tags"
  FOR UPDATE
  USING  (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "tags_delete" ON "tags"
  FOR DELETE USING (public.is_workspace_member(workspace_id));

-- ============================================================
-- 6. BLOCK_TAGS
-- ============================================================
ALTER TABLE "block_tags" ENABLE ROW LEVEL SECURITY;

-- block_tags has no workspace_id — access derived through blocks table
CREATE POLICY "block_tags_select" ON "block_tags"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.blocks
      WHERE id = block_id
        AND public.is_workspace_member(workspace_id)
    )
  );

CREATE POLICY "block_tags_insert" ON "block_tags"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.blocks
      WHERE id = block_id
        AND public.is_workspace_member(workspace_id)
    )
  );

CREATE POLICY "block_tags_delete" ON "block_tags"
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.blocks
      WHERE id = block_id
        AND public.is_workspace_member(workspace_id)
    )
  );
