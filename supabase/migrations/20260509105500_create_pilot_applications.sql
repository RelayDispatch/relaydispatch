create table public.pilot_applications (
  id uuid default gen_random_uuid() primary key,
  business_name text not null,
  contact_name text not null,
  phone text not null,
  software text not null,
  weekly_volume text not null,
  created_at timestamp with time zone default now() not null
);

alter table public.pilot_applications enable row level security;
-- Service role only table
