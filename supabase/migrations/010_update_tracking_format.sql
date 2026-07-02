-- Update tracking_id format to: MKTGRQ - DEPARTMENT - YYMM - UUID

CREATE OR REPLACE FUNCTION assign_tracking_id()
RETURNS TRIGGER AS $$
DECLARE
  dept_abbr text;
  yy_mm text;
  uuid_part text;
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
    uuid_part := SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8);
    NEW.tracking_id := 'MKTGRQ - ' || dept_abbr || ' - ' || yy_mm || ' - ' || uuid_part;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;