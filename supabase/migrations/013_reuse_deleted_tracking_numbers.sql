-- Update tracking_id trigger to reuse lowest freed number globally (any department)

CREATE OR REPLACE FUNCTION assign_tracking_id()
RETURNS TRIGGER AS $$
DECLARE
  dept_abbr text;
  yy_mm text;
  next_seq integer;
BEGIN
  IF NEW.tracking_id IS NULL OR NEW.tracking_id = '' THEN
    dept_abbr := CASE NEW.department
      WHEN 'HR Department' THEN 'HR'
      WHEN 'Operations Department' THEN 'OPS'
      WHEN 'Finance Department' THEN 'FIN'
      WHEN 'Sales Department' THEN 'SAL'
      WHEN 'IT Department' THEN 'IT'
      WHEN 'Facilities Department' THEN 'FAC'
      ELSE UPPER(SUBSTRING(NEW.department, 1, 3))
    END;
    yy_mm := TO_CHAR(NOW(), 'YYMM');

    SELECT COALESCE(MIN(t.seq), 1) INTO next_seq
    FROM (
      SELECT generate_series(1, (
        SELECT GREATEST(MAX(CAST(SPLIT_PART(tracking_id, ' - ', 4) AS integer)), 0) + 1
        FROM marketing_requests
        WHERE tracking_id LIKE 'MKRQ - %'
      )) AS seq
    ) t
    WHERE t.seq NOT IN (
      SELECT CAST(SPLIT_PART(tracking_id, ' - ', 4) AS integer)
      FROM marketing_requests
      WHERE tracking_id LIKE 'MKRQ - %'
    );

    NEW.tracking_id := 'MKRQ - ' || dept_abbr || ' - ' || yy_mm || ' - ' || LPAD(next_seq::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;