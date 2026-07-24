-- The atomic marketing enquiry intake stores the same indicative pricing
-- snapshot used by the autoresponder. Existing enquiry_requests tables may
-- predate these nullable columns because the legacy root schema file is only a
-- baseline snapshot and CREATE TABLE IF NOT EXISTS does not evolve a table.

alter table public.enquiry_requests
  add column if not exists base_budget_low_inc_gst integer,
  add column if not exists base_budget_high_inc_gst integer,
  add column if not exists blinds_budget_low_inc_gst integer,
  add column if not exists blinds_budget_high_inc_gst integer,
  add column if not exists budget_basis text;

notify pgrst, 'reload schema';
