-- Reconcile the Meeting Playbook independently of whether its original
-- migrations were recorded. This migration preserves non-NULL legacy values
-- and fails closed rather than trying to merge unsafe primary-key data.

CREATE TABLE IF NOT EXISTS public.meeting_templates (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  goal text NOT NULL,
  kpis jsonb NOT NULL DEFAULT '[]'::jsonb,
  pro_tips jsonb NOT NULL DEFAULT '[]'::jsonb,
  flow_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.active_meetings (
  id text PRIMARY KEY,
  name text NOT NULL,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_scripts (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.meeting_templates
  ADD COLUMN IF NOT EXISTS id text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS kpis jsonb,
  ADD COLUMN IF NOT EXISTS pro_tips jsonb,
  ADD COLUMN IF NOT EXISTS flow_steps jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.active_meetings
  ADD COLUMN IF NOT EXISTS id text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS links jsonb,
  ADD COLUMN IF NOT EXISTS checklist jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.meeting_scripts
  ADD COLUMN IF NOT EXISTS id text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS text text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

DO $$
DECLARE
  required_column record;
  actual_type text;
BEGIN
  FOR required_column IN
    SELECT * FROM (VALUES
      ('meeting_templates', 'id', 'text'),
      ('meeting_templates', 'name', 'text'),
      ('meeting_templates', 'description', 'text'),
      ('meeting_templates', 'goal', 'text'),
      ('meeting_templates', 'kpis', 'jsonb'),
      ('meeting_templates', 'pro_tips', 'jsonb'),
      ('meeting_templates', 'flow_steps', 'jsonb'),
      ('meeting_templates', 'created_at', 'timestamp with time zone'),
      ('meeting_templates', 'updated_at', 'timestamp with time zone'),
      ('active_meetings', 'id', 'text'),
      ('active_meetings', 'name', 'text'),
      ('active_meetings', 'links', 'jsonb'),
      ('active_meetings', 'checklist', 'jsonb'),
      ('active_meetings', 'created_at', 'timestamp with time zone'),
      ('active_meetings', 'updated_at', 'timestamp with time zone'),
      ('meeting_scripts', 'id', 'text'),
      ('meeting_scripts', 'name', 'text'),
      ('meeting_scripts', 'category', 'text'),
      ('meeting_scripts', 'text', 'text'),
      ('meeting_scripts', 'created_at', 'timestamp with time zone'),
      ('meeting_scripts', 'updated_at', 'timestamp with time zone')
    ) AS required_columns(table_name, column_name, expected_type)
  LOOP
    SELECT data_type INTO actual_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = required_column.table_name
      AND column_name = required_column.column_name;

    IF actual_type IS DISTINCT FROM required_column.expected_type THEN
      RAISE EXCEPTION '% has incompatible % type; manual reconciliation is required',
        required_column.table_name,
        required_column.column_name;
    END IF;
  END LOOP;
END
$$;

-- Check unsafe key data before any NULL normalization. The migration must not
-- silently merge, delete, or rewrite rows when a text primary key is unsafe.
DO $$
DECLARE
  protected_table text;
  has_unsafe_ids boolean;
  primary_key_name text;
  primary_key_columns text[];
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'meeting_templates',
    'active_meetings',
    'meeting_scripts'
  ]
  LOOP
    EXECUTE format(
      'SELECT EXISTS (
        SELECT 1
        FROM public.%1$I
        GROUP BY id
        HAVING id IS NULL OR count(*) > 1
      )',
      protected_table
    ) INTO has_unsafe_ids;

    IF has_unsafe_ids THEN
      RAISE EXCEPTION '% has null or duplicate ids; manual reconciliation is required',
        protected_table;
    END IF;

    SELECT constraint_name INTO primary_key_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = protected_table
      AND constraint_type = 'PRIMARY KEY';

    IF primary_key_name IS NOT NULL THEN
      SELECT array_agg(kcu.column_name ORDER BY kcu.ordinal_position)
      INTO primary_key_columns
      FROM information_schema.key_column_usage AS kcu
      WHERE kcu.constraint_schema = 'public'
        AND kcu.table_name = protected_table
        AND kcu.constraint_name = primary_key_name;

      IF primary_key_columns IS DISTINCT FROM ARRAY['id'] THEN
        RAISE EXCEPTION '% has an incompatible primary key; manual reconciliation is required',
          protected_table;
      END IF;
    END IF;
  END LOOP;
END
$$;

-- NULLs are the only legacy values normalized, and only to the explicit
-- defaults needed by the application contract. Existing non-NULL values stay
-- untouched.
UPDATE public.meeting_templates
SET
  name = coalesce(name, ''),
  description = coalesce(description, ''),
  goal = coalesce(goal, ''),
  kpis = coalesce(kpis, '[]'::jsonb),
  pro_tips = coalesce(pro_tips, '[]'::jsonb),
  flow_steps = coalesce(flow_steps, '[]'::jsonb)
WHERE name IS NULL
   OR description IS NULL
   OR goal IS NULL
   OR kpis IS NULL
   OR pro_tips IS NULL
   OR flow_steps IS NULL;

UPDATE public.active_meetings
SET
  name = coalesce(name, ''),
  links = coalesce(links, '[]'::jsonb),
  checklist = coalesce(checklist, '[]'::jsonb)
WHERE name IS NULL
   OR links IS NULL
   OR checklist IS NULL;

UPDATE public.meeting_scripts
SET
  name = coalesce(name, ''),
  category = coalesce(category, ''),
  text = coalesce(text, '')
WHERE name IS NULL
   OR category IS NULL
   OR text IS NULL;

ALTER TABLE public.meeting_templates
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN goal SET NOT NULL,
  ALTER COLUMN kpis SET DEFAULT '[]'::jsonb,
  ALTER COLUMN kpis SET NOT NULL,
  ALTER COLUMN pro_tips SET DEFAULT '[]'::jsonb,
  ALTER COLUMN pro_tips SET NOT NULL,
  ALTER COLUMN flow_steps SET DEFAULT '[]'::jsonb,
  ALTER COLUMN flow_steps SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.active_meetings
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN links SET DEFAULT '[]'::jsonb,
  ALTER COLUMN links SET NOT NULL,
  ALTER COLUMN checklist SET DEFAULT '[]'::jsonb,
  ALTER COLUMN checklist SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.meeting_scripts
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN text SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
DECLARE
  protected_table text;
  primary_key_name text;
  primary_key_columns text[];
  has_unsafe_ids boolean;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'meeting_templates',
    'active_meetings',
    'meeting_scripts'
  ]
  LOOP
    EXECUTE format(
      'SELECT EXISTS (
        SELECT 1
        FROM public.%1$I
        GROUP BY id
        HAVING id IS NULL OR count(*) > 1
      )',
      protected_table
    ) INTO has_unsafe_ids;

    IF has_unsafe_ids THEN
      RAISE EXCEPTION '% has null or duplicate ids; manual reconciliation is required',
        protected_table;
    END IF;

    SELECT constraint_name INTO primary_key_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = protected_table
      AND constraint_type = 'PRIMARY KEY';

    IF primary_key_name IS NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%1$I ADD CONSTRAINT %1$I_pkey PRIMARY KEY (id)',
        protected_table
      );
    ELSE
      SELECT array_agg(kcu.column_name ORDER BY kcu.ordinal_position)
      INTO primary_key_columns
      FROM information_schema.key_column_usage AS kcu
      WHERE kcu.constraint_schema = 'public'
        AND kcu.table_name = protected_table
        AND kcu.constraint_name = primary_key_name;

      IF primary_key_columns IS DISTINCT FROM ARRAY['id'] THEN
        RAISE EXCEPTION '% has an incompatible primary key; manual reconciliation is required',
          protected_table;
      END IF;
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, auth
AS $$
  SELECT coalesce(
    auth.jwt() -> 'app_metadata' -> 'staff' = 'true'::jsonb,
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.is_staff() FROM service_role;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_meeting_playbook_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  protected_table text;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'meeting_templates',
    'active_meetings',
    'meeting_scripts'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', protected_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon', protected_table);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
      protected_table
    );

    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can view %s" ON public.%I', replace(protected_table, '_', ' '), protected_table);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can insert %s" ON public.%I', replace(protected_table, '_', ' '), protected_table);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can update %s" ON public.%I', replace(protected_table, '_', ' '), protected_table);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can delete %s" ON public.%I', replace(protected_table, '_', ' '), protected_table);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_users ON public.%I', protected_table);
    EXECUTE format('DROP POLICY IF EXISTS staff_only ON public.%I', protected_table);

    EXECUTE format(
      'CREATE POLICY authenticated_users ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      protected_table
    );
    EXECUTE format(
      'CREATE POLICY staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())',
      protected_table
    );

    EXECUTE format('DROP TRIGGER IF EXISTS set_meeting_playbook_updated_at ON public.%I', protected_table);
    EXECUTE format(
      'CREATE TRIGGER set_meeting_playbook_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_meeting_playbook_updated_at()',
      protected_table
    );
  END LOOP;
END
$$;
