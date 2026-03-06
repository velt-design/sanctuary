-- Normalize legacy burgundy crew defaults to the shared green brand accent.
update schedule_crews
set color = '#353d2f'
where lower(trim(color)) in ('#813f39', '#7a3b3b');
