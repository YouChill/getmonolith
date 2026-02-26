-- ============================================================
-- Tighten workspace member management policies
-- - member cannot manage other members
-- - owner row is immutable through workspace_members update/delete
-- ============================================================

DROP POLICY IF EXISTS "workspace_members_update" ON "workspace_members";

CREATE POLICY "workspace_members_update" ON "workspace_members"
  FOR UPDATE USING (
    role <> 'owner'
    AND public.is_workspace_admin(workspace_id)
  )
  WITH CHECK (
    role <> 'owner'
    AND public.is_workspace_admin(workspace_id)
  );

DROP POLICY IF EXISTS "workspace_members_delete" ON "workspace_members";

CREATE POLICY "workspace_members_delete" ON "workspace_members"
  FOR DELETE USING (
    (
      user_id = (SELECT auth.uid())
      AND role <> 'owner'
    )
    OR (
      public.is_workspace_admin(workspace_id)
      AND role <> 'owner'
    )
  );
