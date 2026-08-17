-- Standalone reconciliation for environments where legacy migration 043 is
-- not recorded. Marketing may manage timeline tables and column metadata;
-- only sales may move leads into/beyond the configured SOW boundary or change
-- which column is the boundary.
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
      OR jsonb_typeof(timeline.columns) <> 'array'
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
END;
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
        AND NEW.sales_restricted_from_key IS DISTINCT FROM OLD.sales_restricted_from_key
      )
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Only the sales account can change the timeline sales boundary';
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
      MESSAGE = 'Only the sales account can move leads into or beyond SOW and Pricing Finalization';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_sales_only_sow_transition_trigger ON public.timeline_leads;
CREATE TRIGGER enforce_sales_only_sow_transition_trigger
BEFORE INSERT OR UPDATE ON public.timeline_leads
FOR EACH ROW
EXECUTE FUNCTION public.enforce_sales_only_sow_transition();
