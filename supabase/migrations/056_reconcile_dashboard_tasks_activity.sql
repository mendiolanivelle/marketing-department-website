-- Reconcile the dashboard tables without relying on the unrecorded legacy
-- migrations. Tasks are shared by authenticated staff; activity is per-user.
CREATE TABLE IF NOT EXISTS public.tasks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON public.tasks;

CREATE POLICY "Authenticated users can view tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated users can update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS public.activity_log_id_seq;

CREATE TABLE IF NOT EXISTS public.activity_log (
  id bigint PRIMARY KEY DEFAULT nextval('public.activity_log_id_seq'),
  action text NOT NULL,
  detail text NOT NULL,
  timestamp text NOT NULL,
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.activity_log
  ALTER COLUMN id SET DEFAULT nextval('public.activity_log_id_seq');
ALTER SEQUENCE public.activity_log_id_seq OWNED BY public.activity_log.id;

SELECT setval(
  'public.activity_log_id_seq',
  COALESCE((SELECT max(id) + 1 FROM public.activity_log), 1),
  false
);

CREATE INDEX IF NOT EXISTS activity_log_user_created_idx
  ON public.activity_log (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.tasks,
  public.activity_log
TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE
  public.tasks_id_seq,
  public.activity_log_id_seq
TO authenticated;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view activity log" ON public.activity_log;
DROP POLICY IF EXISTS "Authenticated users can insert activity log" ON public.activity_log;
DROP POLICY IF EXISTS "Authenticated users can delete activity log" ON public.activity_log;
DROP POLICY IF EXISTS "Users can view their activity log" ON public.activity_log;
DROP POLICY IF EXISTS "Users can insert their activity log" ON public.activity_log;
DROP POLICY IF EXISTS "Users can delete their activity log" ON public.activity_log;

CREATE POLICY "Users can view their activity log"
  ON public.activity_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert their activity log"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their activity log"
  ON public.activity_log FOR DELETE TO authenticated
  USING (user_id = auth.uid());
