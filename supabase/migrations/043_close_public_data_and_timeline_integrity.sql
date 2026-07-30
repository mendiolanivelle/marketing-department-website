-- Close legacy anonymous data access. Public submissions now go through
-- bounded Edge functions that keep the service-role key server-side.

DO $$
DECLARE
  exposed_policy record;
BEGIN
  FOR exposed_policy IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'marketing_requests',
        'acceptance_forms',
        'campaigns',
        'calendar_items',
        'potential_projects',
        'project_review_tickets'
      ])
      AND ('public' = ANY (roles) OR 'anon' = ANY (roles))
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.%I',
      exposed_policy.policyname,
      exposed_policy.tablename
    );
  END LOOP;
END
$$;

REVOKE ALL ON TABLE
  public.marketing_requests,
  public.acceptance_forms,
  public.campaigns,
  public.calendar_items,
  public.potential_projects,
  public.project_review_tickets
FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.marketing_requests,
  public.acceptance_forms,
  public.campaigns,
  public.calendar_items,
  public.potential_projects,
  public.project_review_tickets
TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can insert marketing requests" ON public.marketing_requests;
DROP POLICY IF EXISTS "Authenticated users can view marketing requests" ON public.marketing_requests;
DROP POLICY IF EXISTS "Authenticated users can update marketing requests" ON public.marketing_requests;
DROP POLICY IF EXISTS "Authenticated users can delete marketing requests" ON public.marketing_requests;

CREATE POLICY "Authenticated users can insert marketing requests"
  ON public.marketing_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can view marketing requests"
  ON public.marketing_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update marketing requests"
  ON public.marketing_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete marketing requests"
  ON public.marketing_requests FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert acceptance forms" ON public.acceptance_forms;
DROP POLICY IF EXISTS "Authenticated users can view acceptance forms" ON public.acceptance_forms;
DROP POLICY IF EXISTS "Authenticated users can update acceptance forms" ON public.acceptance_forms;
DROP POLICY IF EXISTS "Authenticated users can delete acceptance forms" ON public.acceptance_forms;

CREATE POLICY "Authenticated users can insert acceptance forms"
  ON public.acceptance_forms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can view acceptance forms"
  ON public.acceptance_forms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update acceptance forms"
  ON public.acceptance_forms FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete acceptance forms"
  ON public.acceptance_forms FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated users can view campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated users can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated users can delete campaigns" ON public.campaigns;

CREATE POLICY "Authenticated users can insert campaigns"
  ON public.campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can view campaigns"
  ON public.campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update campaigns"
  ON public.campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete campaigns"
  ON public.campaigns FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view potential projects" ON public.potential_projects;
DROP POLICY IF EXISTS "Authenticated users can insert potential projects" ON public.potential_projects;
DROP POLICY IF EXISTS "Authenticated users can update potential projects" ON public.potential_projects;
DROP POLICY IF EXISTS "Authenticated users can delete potential projects" ON public.potential_projects;

CREATE POLICY "Authenticated users can view potential projects"
  ON public.potential_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert potential projects"
  ON public.potential_projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update potential projects"
  ON public.potential_projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete potential projects"
  ON public.potential_projects FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can view project review tickets" ON public.project_review_tickets;
DROP POLICY IF EXISTS "Authenticated users can insert project review tickets" ON public.project_review_tickets;
DROP POLICY IF EXISTS "Authenticated users can update project review tickets" ON public.project_review_tickets;
DROP POLICY IF EXISTS "Authenticated users can delete project review tickets" ON public.project_review_tickets;

CREATE POLICY "Authenticated users can view project review tickets"
  ON public.project_review_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert project review tickets"
  ON public.project_review_tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update project review tickets"
  ON public.project_review_tickets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete project review tickets"
  ON public.project_review_tickets FOR DELETE TO authenticated USING (true);

ALTER TABLE public.timeline_leads
  ADD COLUMN IF NOT EXISTS last_email_sent text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.timeline_tables
  ADD COLUMN IF NOT EXISTS sales_restricted_from_key text;

UPDATE public.timeline_tables AS timeline
SET sales_restricted_from_key = coalesce(
  (
    SELECT item.value->>'key'
    FROM jsonb_array_elements(timeline.columns) WITH ORDINALITY AS item(value, ordinality)
    WHERE item.value->>'label' ~* 'sow.*(pricing|costing)|(pricing|costing).*sow'
    ORDER BY item.ordinality
    LIMIT 1
  ),
  timeline.columns->3->>'key'
)
WHERE timeline.sales_restricted_from_key IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.timeline_tables AS timeline
    WHERE timeline.sales_restricted_from_key IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(timeline.columns) AS item(value)
        WHERE item.value->>'key' = timeline.sales_restricted_from_key
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Timeline sales boundary could not be inferred; review timeline column metadata before retrying';
  END IF;
END
$$;

ALTER TABLE public.timeline_tables
  ALTER COLUMN sales_restricted_from_key SET DEFAULT 'col-4',
  ALTER COLUMN sales_restricted_from_key SET NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_timeline_sales_boundary_configuration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF jsonb_typeof(NEW.columns) <> 'array'
    OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(NEW.columns) AS item(value)
      WHERE item.value->>'key' = NEW.sales_restricted_from_key
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Timeline sales boundary must reference an existing column key';
  END IF;

  IF auth.role() IS NOT NULL
    AND auth.role() <> 'service_role'
    AND lower(coalesce(auth.email(), '')) <> 'sales@exodiagamedev.com'
    AND (
      (
        TG_OP = 'INSERT'
        AND (
          NEW.sales_restricted_from_key <> 'col-4'
          OR NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(NEW.columns) WITH ORDINALITY AS item(value, ordinality)
            WHERE item.ordinality = 4
              AND item.value->>'key' = 'col-4'
              AND item.value->>'label' ~* 'sow.*(pricing|costing)|(pricing|costing).*sow'
          )
        )
      )
      OR (
        TG_OP = 'UPDATE'
        AND (
          NEW.columns IS DISTINCT FROM OLD.columns
          OR NEW.sales_restricted_from_key IS DISTINCT FROM OLD.sales_restricted_from_key
        )
      )
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Only the sales account can change timeline stages or their restricted boundary';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_timeline_sales_boundary_configuration_trigger
  ON public.timeline_tables;
CREATE TRIGGER enforce_timeline_sales_boundary_configuration_trigger
BEFORE INSERT OR UPDATE OF columns, sales_restricted_from_key
ON public.timeline_tables
FOR EACH ROW
EXECUTE FUNCTION public.enforce_timeline_sales_boundary_configuration();

CREATE OR REPLACE FUNCTION public.enforce_sales_only_sow_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_email text;
  restricted_position bigint;
  target_position bigint;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.table_id IS NOT DISTINCT FROM OLD.table_id
    AND NEW.column_key IS NOT DISTINCT FROM OLD.column_key
  THEN
    RETURN NEW;
  END IF;

  SELECT
    MIN(item.ordinality) FILTER (
      WHERE item.value->>'key' = timeline.sales_restricted_from_key
    ),
    MIN(item.ordinality) FILTER (
      WHERE item.value->>'key' = NEW.column_key
    )
  INTO restricted_position, target_position
  FROM public.timeline_tables AS timeline,
    jsonb_array_elements(timeline.columns) WITH ORDINALITY AS item(value, ordinality)
  WHERE timeline.id = NEW.table_id;

  IF restricted_position IS NULL
    OR target_position IS NULL
    OR target_position < restricted_position
    OR auth.role() = 'service_role'
    OR auth.role() IS NULL
  THEN
    RETURN NEW;
  END IF;

  actor_email := lower(coalesce(auth.email(), ''));
  IF actor_email <> 'sales@exodiagamedev.com' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Only the sales account can move leads into or beyond SOW and Costing Creation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_sales_only_sow_transition_trigger ON public.timeline_leads;
CREATE TRIGGER enforce_sales_only_sow_transition_trigger
BEFORE INSERT OR UPDATE ON public.timeline_leads
FOR EACH ROW
EXECUTE FUNCTION public.enforce_sales_only_sow_transition();

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'calendar_items',
    'campaigns',
    'timeline_tables',
    'timeline_leads',
    'lead_files',
    'lead_rows'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = target_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target_table);
    END IF;
  END LOOP;
END;
$$;
