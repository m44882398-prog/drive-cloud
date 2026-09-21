alter table public.base_config enable row level security;
alter table public.databases enable row level security;
alter table public.file_categories enable row level security;
alter table public.system_settings enable row level security;

create policy "Authenticated users read base config" on public.base_config for select using (auth.role() = 'authenticated');
create policy "Users manage own databases" on public.databases for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Authenticated users read categories" on public.file_categories for select using (auth.role() = 'authenticated');
create policy "Users read public settings" on public.system_settings for select using (is_public or auth.role() = 'authenticated');
