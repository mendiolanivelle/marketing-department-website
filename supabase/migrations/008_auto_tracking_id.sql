-- Auto-generate tracking_id for marketing_requests
-- Format: MKRQ - DEPARTMENT - YYMM - 001

CREATE SEQUENCE IF NOT EXISTS marketing_requests_tracking_seq START 1;

CREATE OR REPLACE FUNCTION assign_tracking_id()
RETURNS TRIGGER AS $$
DECLARE
  dept_abbr text;
  yy_mm text;
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
    NEW.tracking_id := 'MKRQ - ' || dept_abbr || ' - ' || yy_mm || ' - ' || LPAD(nextval('marketing_requests_tracking_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_tracking_id ON marketing_requests;
CREATE TRIGGER trg_assign_tracking_id
  BEFORE INSERT ON marketing_requests
  FOR EACH ROW
  EXECUTE FUNCTION assign_tracking_id();