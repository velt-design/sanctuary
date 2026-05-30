update public.project_notes
set author_display_name = 'Ellen'
where lower(btrim(author_email)) = 'info@sanctuarypergolas.co.nz'
  and (
    author_display_name is null
    or btrim(author_display_name) = ''
    or lower(btrim(author_display_name)) = 'info'
  );
