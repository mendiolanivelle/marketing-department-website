-- Reconcile the missing production effect of historical migration 022
-- without replaying the unsafe 017-051 migration range.
ALTER TABLE public.marketing_requests
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pending';
