create extension if not exists pgcrypto;

create table if not exists public.base_config (
  key varchar primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz default now()
);

insert into public.base_config (key, value, description) values
  ('app_name', '"Cloud Drive"'::jsonb, 'Nama aplikasi'),
  ('app_version', '"1.0.0"'::jsonb, 'Versi aplikasi')
on conflict (key) do nothing;

create table if not exists public.databases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name varchar not null,
  description text,
  supabase_url text not null,
  supabase_anon_key text not null,
  supabase_service_key text,
  color varchar default '#3B82F6',
  icon varchar default 'database',
  is_active boolean default true,
  is_default boolean default false,
  last_synced_at timestamptz,
  total_size bigint default 0,
  file_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.file_categories (
  id uuid primary key default gen_random_uuid(), name varchar not null,
  mime_types text[], icon varchar, color varchar, created_at timestamptz default now()
);

create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(), setting_key varchar unique not null,
  setting_value jsonb not null, is_public boolean default false, updated_at timestamptz default now()
);
