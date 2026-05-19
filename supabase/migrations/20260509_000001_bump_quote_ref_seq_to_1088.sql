-- One-off data bump: jump the quote-ref sequence forward by 1000 so the
-- next quote issued is Q-1089 (current latest was Q-0088). Discussed
-- with the owner: avoids the 0xxx range that maps to the old paper
-- quoting system so new quotes are visually distinct from migrated
-- historical numbers.
--
-- `setval(seq, n, true)` sets the sequence so the NEXT `nextval(seq)`
-- returns n + 1. We want the next nextval to return 1089, so set to
-- 1088. Idempotent re-runs are safe (setval is absolute, not
-- additive) -- but on environments that have already issued > 1088
-- quotes, the GREATEST() guard below keeps the sequence from going
-- BACKWARDS, which would risk duplicate Q- refs.
select setval(
  'public.quote_ref_seq',
  greatest(1088, (select last_value from public.quote_ref_seq)),
  true
);
