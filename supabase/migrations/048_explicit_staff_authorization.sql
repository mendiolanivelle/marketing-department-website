-- Deployment preflight: administrators must set app_metadata.staff = true on
-- approved users, including sales@exodiagamedev.com. Fresh resets intentionally
-- apply with no users; access stays denied until that explicit bootstrap occurs.

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
DECLARE
  protected_table text;
BEGIN
  -- Keep this list scoped to tables owned by this portal. The Supabase project
  -- may contain tables for other applications with their own authorization.
  FOREACH protected_table IN ARRAY ARRAY[
    'acceptance_forms',
    'active_meetings',
    'activity_log',
    'calendar_items',
    'campaigns',
    'file_tracker_assets',
    'lead_files',
    'lead_rows',
    'marketing_requests',
    'meeting_scripts',
    'meeting_templates',
    'message_templates',
    'ops_emails',
    'outreach_leads',
    'potential_projects',
    'project_review_tickets',
    'public_links',
    'read_announcements',
    'synced_lead_files',
    'tasks',
    'team_directory',
    'template_categories',
    'timeline_leads',
    'timeline_tables',
    'website_requests',
    'website_requests_seen',
    'workspace_cards'
  ]
  LOOP
    IF to_regclass(format('public.%I', protected_table)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      protected_table
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS staff_only ON public.%I',
      protected_table
    );
    EXECUTE format(
      'CREATE POLICY staff_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())',
      protected_table
    );
  END LOOP;
END
$$;
