-- A completion email is reserved before SMTP and never automatically reclaimed.
-- An unresolved Sending row requires administrator reconciliation; this
-- intentionally prefers a missed retry over a duplicate client notification.

CREATE TABLE IF NOT EXISTS public.completion_notification_deliveries (
  source text NOT NULL
    CHECK (source IN ('campaigns', 'marketing_requests')),
  source_record_id bigint NOT NULL
    CHECK (source_record_id > 0),
  payload_hash text NOT NULL
    CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'Sending'
    CHECK (status IN ('Sending', 'Sent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  PRIMARY KEY (source, source_record_id, payload_hash),
  CHECK (
    (status = 'Sending' AND sent_at IS NULL)
    OR (status = 'Sent' AND sent_at IS NOT NULL)
  )
);

ALTER TABLE public.completion_notification_deliveries
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.completion_notification_deliveries
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.completion_notification_deliveries
  TO service_role;

COMMENT ON TABLE public.completion_notification_deliveries IS
  'Idempotency ledger for notify-complete; unresolved Sending rows are fail-closed.';
