alter table public.databases
  add column if not exists s3_access_key text,
  add column if not exists s3_secret_key text,
  add column if not exists s3_region varchar default 'ap-southeast-2',
  add column if not exists s3_endpoint text;
