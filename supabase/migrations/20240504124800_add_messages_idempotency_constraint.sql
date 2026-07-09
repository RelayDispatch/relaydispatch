-- Ensure messages table has a unique constraint on (thread_id, external_message_id)
-- This allows ON CONFLICT DO NOTHING to work properly in activities.ts for idempotency.

-- Step 0: Create completed_activity_keys if it doesn't exist yet
CREATE TABLE IF NOT EXISTS public.completed_activity_keys (
  key         text        NOT NULL,
  activity_key text       GENERATED ALWAYS AS (key) STORED,
  org_id      uuid        REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key)
);
ALTER TABLE public.completed_activity_keys ENABLE ROW LEVEL SECURITY;

-- Step 1: Clean up any existing duplicates (keep the oldest row)
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER(PARTITION BY thread_id, external_message_id ORDER BY created_at ASC) as rn
    FROM messages
    WHERE external_message_id IS NOT NULL
)
DELETE FROM messages
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Step 2: Add the unique constraint on messages
ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_thread_id_external_message_id_key;

ALTER TABLE messages
ADD CONSTRAINT messages_thread_id_external_message_id_key UNIQUE (thread_id, external_message_id);

-- Step 3: Ensure completed_activity_keys has unique constraint on activity_key
ALTER TABLE completed_activity_keys
DROP CONSTRAINT IF EXISTS completed_activity_keys_activity_key_key;
