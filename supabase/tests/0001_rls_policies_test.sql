-- ============================================================
-- RLS policy tests
--
-- Verifies that an authenticated user cannot see data belonging
-- to a workspace they are not a member of.
--
-- Run against a local Supabase instance (supabase db test) or
-- manually via psql. Uses supabase_test helpers where available;
-- falls back to raw SET ROLE + request.jwt.claims.
-- ============================================================

BEGIN;

-- --------------------------------------------------------
-- 0. Setup: create two auth users
-- --------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alice@test.local', '{}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bob@test.local',   '{}');

-- --------------------------------------------------------
-- 1. Create workspaces — Alice owns ws_alice, Bob owns ws_bob
-- --------------------------------------------------------
INSERT INTO workspaces (id, name, slug, type, owner_id)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Alice WS', 'alice-ws', 'personal',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('22222222-2222-2222-2222-222222222222', 'Bob WS',   'bob-ws',   'personal',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- --------------------------------------------------------
-- 2. Add each owner as accepted member of their workspace
-- --------------------------------------------------------
INSERT INTO workspace_members (workspace_id, user_id, role, accepted_at)
VALUES
  ('11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', now()),
  ('22222222-2222-2222-2222-222222222222',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner', now());

-- --------------------------------------------------------
-- 3. Create projects, blocks, tags, and block_tags in each WS
-- --------------------------------------------------------
INSERT INTO projects (id, workspace_id, name)
VALUES
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '11111111-1111-1111-1111-111111111111', 'Alice Project'),
  ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', '22222222-2222-2222-2222-222222222222', 'Bob Project');

INSERT INTO blocks (id, workspace_id, project_id, type, created_by)
VALUES
  ('ca000001-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
   'task', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('cb000002-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222',
   'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
   'task', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

INSERT INTO tags (id, workspace_id, name, color)
VALUES
  ('da000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice Tag', '#ff0000'),
  ('db000002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Bob Tag',   '#0000ff');

INSERT INTO block_tags (block_id, tag_id)
VALUES
  ('ca000001-0000-0000-0000-000000000001', 'da000001-0000-0000-0000-000000000001'),
  ('cb000002-0000-0000-0000-000000000002', 'db000002-0000-0000-0000-000000000002');

-- --------------------------------------------------------
-- 4. Become Alice (simulate Supabase auth context)
-- --------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

-- Alice sees her workspace but NOT Bob's
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM workspaces;
  ASSERT cnt = 1, 'Alice should see exactly 1 workspace, got ' || cnt;

  SELECT count(*) INTO cnt FROM workspaces WHERE slug = 'bob-ws';
  ASSERT cnt = 0, 'Alice must NOT see Bob workspace';
END $$;

-- Alice sees her project but NOT Bob's
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM projects;
  ASSERT cnt = 1, 'Alice should see 1 project, got ' || cnt;

  SELECT count(*) INTO cnt FROM projects WHERE name = 'Bob Project';
  ASSERT cnt = 0, 'Alice must NOT see Bob project';
END $$;

-- Alice sees her blocks but NOT Bob's
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM blocks;
  ASSERT cnt = 1, 'Alice should see 1 block, got ' || cnt;

  SELECT count(*) INTO cnt FROM blocks WHERE id = 'cb000002-0000-0000-0000-000000000002';
  ASSERT cnt = 0, 'Alice must NOT see Bob block';
END $$;

-- Alice sees her tags but NOT Bob's
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM tags;
  ASSERT cnt = 1, 'Alice should see 1 tag, got ' || cnt;
END $$;

-- Alice sees her block_tags but NOT Bob's
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM block_tags;
  ASSERT cnt = 1, 'Alice should see 1 block_tag, got ' || cnt;
END $$;

-- Alice sees only her own workspace_members
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM workspace_members;
  ASSERT cnt = 1, 'Alice should see 1 membership, got ' || cnt;
END $$;

-- Alice cannot INSERT a block into Bob's workspace
DO $$
BEGIN
  INSERT INTO blocks (workspace_id, type, created_by)
  VALUES ('22222222-2222-2222-2222-222222222222', 'task',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  RAISE EXCEPTION 'INSERT into foreign workspace should have been denied';
EXCEPTION
  WHEN insufficient_privilege THEN
    -- expected: RLS blocked the insert
    NULL;
END $$;

-- --------------------------------------------------------
-- 5. Become Bob — verify inverse isolation
-- --------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM workspaces;
  ASSERT cnt = 1, 'Bob should see exactly 1 workspace, got ' || cnt;

  SELECT count(*) INTO cnt FROM blocks;
  ASSERT cnt = 1, 'Bob should see 1 block, got ' || cnt;

  SELECT count(*) INTO cnt FROM projects;
  ASSERT cnt = 1, 'Bob should see 1 project, got ' || cnt;

  SELECT count(*) INTO cnt FROM tags;
  ASSERT cnt = 1, 'Bob should see 1 tag, got ' || cnt;

  SELECT count(*) INTO cnt FROM block_tags;
  ASSERT cnt = 1, 'Bob should see 1 block_tag, got ' || cnt;
END $$;

-- Bob cannot delete Alice's workspace
DO $$
DECLARE
  cnt int;
BEGIN
  DELETE FROM workspaces WHERE id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  ASSERT cnt = 0, 'Bob must NOT be able to delete Alice workspace';
END $$;

-- --------------------------------------------------------
-- 6. Cleanup — rollback so no test data persists
-- --------------------------------------------------------
ROLLBACK;
