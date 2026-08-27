-- Keep the schema-cache reload in a separate migration so the attachment DDL,
-- foreign keys, policies, and trigger functions are committed first.
select pg_notify('pgrst', 'reload schema');
