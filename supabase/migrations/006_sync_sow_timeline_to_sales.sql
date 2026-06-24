CREATE OR REPLACE FUNCTION public.is_sow_costing_creation_column(columns_json JSONB, column_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(columns_json) AS column_item
    WHERE column_item->>'key' = column_key
      AND POSITION('sow' IN LOWER(REGEXP_REPLACE(COALESCE(column_item->>'label', ''), '[^a-z0-9]+', ' ', 'g'))) > 0
      AND POSITION('costing' IN LOWER(REGEXP_REPLACE(COALESCE(column_item->>'label', ''), '[^a-z0-9]+', ' ', 'g'))) > 0
      AND POSITION('creation' IN LOWER(REGEXP_REPLACE(COALESCE(column_item->>'label', ''), '[^a-z0-9]+', ' ', 'g'))) > 0
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_sow_timeline_lead_to_sales()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_table RECORD;
  target_column_label TEXT;
  sales_client_key TEXT;
  sales_client_id UUID;
  sales_forward_id UUID;
  synced_notes TEXT;
BEGIN
  SELECT *
  INTO target_table
  FROM public.timeline_tables
  WHERE id = NEW.table_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_sow_costing_creation_column(target_table.columns, NEW.column_key) THEN
    RETURN NEW;
  END IF;

  SELECT column_item->>'label'
  INTO target_column_label
  FROM jsonb_array_elements(target_table.columns) AS column_item
  WHERE column_item->>'key' = NEW.column_key
  LIMIT 1;

  SELECT id
  INTO sales_client_id
  FROM public.clients
  WHERE (NEW.email IS NOT NULL AND LOWER(contact_email) = LOWER(NEW.email))
    OR client_key = LOWER(CONCAT_WS('|', NEW.company, NEW.contact))
  ORDER BY created_at ASC
  LIMIT 1;

  sales_client_key := LOWER(CONCAT_WS('|', NEW.company, NEW.contact));

  synced_notes := CONCAT_WS(
    E'\n\n',
    'Auto-synced from marketing timeline stage: ' || COALESCE(target_column_label, 'SOW and Costing Creation'),
    'Lead value: ' || COALESCE(NEW.value, ''),
    'Lead date: ' || COALESCE(NEW.date, ''),
    NULLIF(NEW.notes, '')
  );

  IF sales_client_id IS NULL THEN
    INSERT INTO public.clients (
      client_key,
      contact_name,
      contact_email,
      company_name
    )
    VALUES (
      sales_client_key,
      NEW.contact,
      NEW.email,
      NEW.company
    )
    RETURNING id INTO sales_client_id;
  ELSE
    UPDATE public.clients
    SET
      client_key = sales_client_key,
      contact_name = NEW.contact,
      contact_email = NEW.email,
      company_name = NEW.company,
      updated_at = NOW()
    WHERE id = sales_client_id;
  END IF;

  SELECT id
  INTO sales_forward_id
  FROM public.marketing_forwards
  WHERE client_id = sales_client_id
  ORDER BY forwarded_at ASC
  LIMIT 1;

  IF sales_forward_id IS NULL THEN
    INSERT INTO public.marketing_forwards (
      client_id,
      forwarded_by,
      marketing_notes,
      status
    )
    VALUES (
      sales_client_id,
      COALESCE(auth.email(), 'Marketing Timeline'),
      synced_notes,
      'pending'
    );
  ELSE
    UPDATE public.marketing_forwards
    SET
      forwarded_by = COALESCE(auth.email(), forwarded_by, 'Marketing Timeline'),
      marketing_notes = synced_notes
    WHERE id = sales_forward_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_sow_timeline_lead_to_sales_trigger ON public.timeline_leads;

CREATE TRIGGER sync_sow_timeline_lead_to_sales_trigger
AFTER INSERT OR UPDATE ON public.timeline_leads
FOR EACH ROW
EXECUTE FUNCTION public.sync_sow_timeline_lead_to_sales();

UPDATE public.timeline_leads AS lead
SET updated_at = NOW()
FROM public.timeline_tables AS table_item
WHERE table_item.id = lead.table_id
  AND public.is_sow_costing_creation_column(table_item.columns, lead.column_key);
