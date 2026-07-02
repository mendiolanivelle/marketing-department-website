-- Auto-generate tracking_id for marketing_requests using a sequence
CREATE SEQUENCE IF NOT EXISTS marketing_requests_tracking_seq START 1;

CREATE OR REPLACE FUNCTION assign_tracking_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_id IS NULL OR NEW.tracking_id = '' THEN
    NEW.tracking_id := 'MRQ-' || LPAD(nextval('marketing_requests_tracking_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_tracking_id ON marketing_requests;
CREATE TRIGGER trg_assign_tracking_id
  BEFORE INSERT ON marketing_requests
  FOR EACH ROW
  EXECUTE FUNCTION assign_tracking_id();