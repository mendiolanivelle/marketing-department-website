CREATE OR REPLACE FUNCTION public.import_lead_file(
  p_name text,
  p_columns text[],
  p_source text,
  p_rows jsonb
)
RETURNS TABLE(file_id uuid, duplicate_count integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  duplicate_file_id uuid;
  duplicate_rows jsonb;
  email_column text;
  main_rows jsonb;
  new_file_id uuid;
  next_duplicate_index integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' OR length(p_name) > 200
    OR lower(btrim(p_name)) = 'duplicate leads'
    OR p_source IS NULL OR p_source NOT IN ('csv', 'spreadsheet')
    OR p_columns IS NULL OR cardinality(p_columns) < 1 OR cardinality(p_columns) > 200
    OR EXISTS (SELECT 1 FROM unnest(p_columns) AS column_name WHERE column_name IS NULL OR btrim(column_name) = '' OR length(column_name) > 200)
    OR cardinality(p_columns) <> (SELECT count(DISTINCT column_name) FROM unnest(p_columns) AS column_name)
    OR p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array'
    OR jsonb_array_length(p_rows) > 10000
    OR octet_length(p_rows::text) > 5 * 1024 * 1024
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) AS row_item WHERE jsonb_typeof(row_item) <> 'object')
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_rows) AS row_item
      CROSS JOIN LATERAL jsonb_each(row_item) AS field(key, value)
      WHERE jsonb_typeof(field.value) <> 'string' OR length(field.value #>> '{}') > 10000
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid lead import';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('public.lead_duplicate_routing'));

  SELECT column_name
  INTO email_column
  FROM unnest(p_columns) AS column_name
  WHERE lower(column_name) LIKE '%email%'
  LIMIT 1;

  IF email_column IS NULL THEN
    main_rows := p_rows;
    duplicate_rows := '[]'::jsonb;
  ELSE
    SELECT
      coalesce(jsonb_agg(row_item ORDER BY row_number) FILTER (WHERE NOT is_duplicate), '[]'::jsonb),
      coalesce(jsonb_agg(row_item ORDER BY row_number) FILTER (WHERE is_duplicate), '[]'::jsonb)
    INTO main_rows, duplicate_rows
    FROM (
      SELECT
        normalized.row_item,
        normalized.row_number,
        normalized.normalized_email IS NOT NULL
          AND (
            EXISTS (
              SELECT 1
              FROM public.lead_rows AS existing
              CROSS JOIN LATERAL jsonb_each_text(
                CASE
                  WHEN jsonb_typeof(existing.data) = 'object' THEN existing.data
                  ELSE '{}'::jsonb
                END
              ) AS field(key, value)
              WHERE jsonb_typeof(existing.data) = 'object'
                AND lower(field.key) LIKE '%email%'
                AND lower(btrim(field.value)) = normalized.normalized_email
            )
            OR row_number() OVER (
              PARTITION BY normalized.normalized_email
              ORDER BY normalized.row_number
            ) > 1
          ) AS is_duplicate
      FROM (
        SELECT
          input.value AS row_item,
          input.ordinality AS row_number,
          nullif(lower(btrim(input.value->>email_column)), '') AS normalized_email
        FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS input(value, ordinality)
      ) AS normalized
    ) AS classified;
  END IF;

  INSERT INTO public.lead_files (name, columns, source)
  VALUES (btrim(p_name), p_columns, p_source)
  RETURNING id INTO new_file_id;

  INSERT INTO public.lead_rows (file_id, row_index, data)
  SELECT new_file_id, input.ordinality - 1, input.value
  FROM jsonb_array_elements(main_rows) WITH ORDINALITY AS input(value, ordinality);

  duplicate_count := jsonb_array_length(duplicate_rows);
  IF duplicate_count > 0 THEN
    SELECT id
    INTO duplicate_file_id
    FROM public.lead_files
    WHERE name = 'Duplicate Leads'
    ORDER BY created_at
    LIMIT 1;

    IF duplicate_file_id IS NULL THEN
      INSERT INTO public.lead_files (name, columns, source)
      VALUES ('Duplicate Leads', p_columns || ARRAY['Source File'], 'spreadsheet')
      RETURNING id INTO duplicate_file_id;
    ELSE
      UPDATE public.lead_files AS duplicate_file
      SET columns = merged.columns
      FROM (
        SELECT array_agg(column_name ORDER BY first_position) AS columns
        FROM (
          SELECT column_name, min(position) AS first_position
          FROM unnest(
            (SELECT columns FROM public.lead_files WHERE id = duplicate_file_id)
            || p_columns
            || ARRAY['Source File']
          ) WITH ORDINALITY AS item(column_name, position)
          GROUP BY column_name
        ) AS unique_columns
      ) AS merged
      WHERE duplicate_file.id = duplicate_file_id;
    END IF;

    SELECT coalesce(max(row_index) + 1, 0)
    INTO next_duplicate_index
    FROM public.lead_rows
    WHERE lead_rows.file_id = duplicate_file_id;

    INSERT INTO public.lead_rows (file_id, row_index, data)
    SELECT
      duplicate_file_id,
      next_duplicate_index + input.ordinality - 1,
      input.value || jsonb_build_object('Source File', btrim(p_name))
    FROM jsonb_array_elements(duplicate_rows) WITH ORDINALITY AS input(value, ordinality);
  END IF;

  RETURN QUERY SELECT new_file_id, duplicate_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_calling_card_lead(p_data jsonb)
RETURNS TABLE(file_id uuid, row_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_row_id uuid;
  next_row_index integer;
  target_file_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object'
    OR octet_length(p_data::text) > 64 * 1024
    OR EXISTS (
      SELECT 1
      FROM jsonb_each(p_data) AS field(key, value)
      WHERE field.key <> ALL (ARRAY[
        'Name', 'Company', 'Role / Position', 'Email',
        'Contact Number', 'Address', 'Notes', 'Raw OCR Text'
      ])
        OR jsonb_typeof(field.value) <> 'string'
        OR length(field.value #>> '{}') > 10000
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid calling card lead';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('public.calling_card_leads'));

  SELECT id
  INTO target_file_id
  FROM public.lead_files
  WHERE name = 'Calling Card Leads' AND source = 'spreadsheet'
  ORDER BY created_at
  LIMIT 1;

  IF target_file_id IS NULL THEN
    INSERT INTO public.lead_files (name, columns, source)
    VALUES (
      'Calling Card Leads',
      ARRAY['Name', 'Company', 'Role / Position', 'Email', 'Contact Number', 'Address', 'Notes', 'Raw OCR Text'],
      'spreadsheet'
    )
    RETURNING id INTO target_file_id;
  END IF;

  SELECT coalesce(max(row_index) + 1, 0)
  INTO next_row_index
  FROM public.lead_rows
  WHERE lead_rows.file_id = target_file_id;

  INSERT INTO public.lead_rows (file_id, row_index, data)
  VALUES (target_file_id, next_row_index, p_data)
  RETURNING id INTO new_row_id;

  RETURN QUERY SELECT target_file_id, new_row_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.route_lead_rows_to_duplicates(p_row_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  duplicate_file_id uuid;
  moved_count integer := 0;
  row_email text;
  source_record record;
  target_row_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;
  IF p_row_ids IS NULL OR cardinality(p_row_ids) < 1 OR cardinality(p_row_ids) > 1000
    OR cardinality(p_row_ids) <> (SELECT count(DISTINCT row_id) FROM unnest(p_row_ids) AS row_id)
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid duplicate rows';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('public.lead_duplicate_routing'));

  FOREACH target_row_id IN ARRAY p_row_ids
  LOOP
    SELECT
      lead_row.data,
      lead_file.columns,
      lead_file.id AS source_file_id,
      lead_file.name AS source_file_name
    INTO source_record
    FROM public.lead_rows AS lead_row
    JOIN public.lead_files AS lead_file ON lead_file.id = lead_row.file_id
    WHERE lead_row.id = target_row_id
    FOR UPDATE OF lead_row;

    IF NOT FOUND
      OR source_record.source_file_name = 'Duplicate Leads'
      OR jsonb_typeof(source_record.data) <> 'object'
    THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Duplicate source row is unavailable';
    END IF;

    SELECT lower(btrim(field.value))
    INTO row_email
    FROM jsonb_each_text(source_record.data) AS field(key, value)
    WHERE lower(field.key) LIKE '%email%' AND btrim(field.value) <> ''
    LIMIT 1;

    IF row_email IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.lead_rows AS other_row
      CROSS JOIN LATERAL jsonb_each_text(
        CASE
          WHEN jsonb_typeof(other_row.data) = 'object' THEN other_row.data
          ELSE '{}'::jsonb
        END
      ) AS field(key, value)
      WHERE other_row.id <> target_row_id
        AND jsonb_typeof(other_row.data) = 'object'
        AND lower(field.key) LIKE '%email%'
        AND lower(btrim(field.value)) = row_email
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Lead row is not a duplicate';
    END IF;

    IF duplicate_file_id IS NULL THEN
      SELECT id
      INTO duplicate_file_id
      FROM public.lead_files
      WHERE name = 'Duplicate Leads'
      ORDER BY created_at
      LIMIT 1;
    END IF;

    IF duplicate_file_id IS NULL THEN
      INSERT INTO public.lead_files (name, columns, source)
      VALUES ('Duplicate Leads', source_record.columns || ARRAY['Source File'], 'spreadsheet')
      RETURNING id INTO duplicate_file_id;
    ELSE
      UPDATE public.lead_files AS duplicate_file
      SET columns = merged.columns
      FROM (
        SELECT array_agg(column_name ORDER BY first_position) AS columns
        FROM (
          SELECT column_name, min(position) AS first_position
          FROM unnest(
            (SELECT columns FROM public.lead_files WHERE id = duplicate_file_id)
            || source_record.columns
            || ARRAY['Source File']
          ) WITH ORDINALITY AS item(column_name, position)
          GROUP BY column_name
        ) AS unique_columns
      ) AS merged
      WHERE duplicate_file.id = duplicate_file_id;
    END IF;

    INSERT INTO public.lead_rows (file_id, row_index, data)
    SELECT
      duplicate_file_id,
      coalesce(max(row_index) + 1, 0),
      source_record.data || jsonb_build_object('Source File', source_record.source_file_name)
    FROM public.lead_rows
    WHERE file_id = duplicate_file_id;

    DELETE FROM public.lead_rows WHERE id = target_row_id;
    moved_count := moved_count + 1;
  END LOOP;

  RETURN moved_count;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lead_rows_data_object'
      AND conrelid = 'public.lead_rows'::regclass
  ) THEN
    ALTER TABLE public.lead_rows
      ADD CONSTRAINT lead_rows_data_object
      CHECK (jsonb_typeof(data) = 'object') NOT VALID;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.import_lead_file(text, text[], text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.append_calling_card_lead(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.route_lead_rows_to_duplicates(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_lead_file(text, text[], text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_calling_card_lead(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.route_lead_rows_to_duplicates(uuid[]) TO authenticated;
