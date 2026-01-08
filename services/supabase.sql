-- Supabase schema: single-table auth using public.profiles
-- Includes migration helpers to adapt an existing minimal `profiles` table.

-- enable UUID generation if not already available
create extension if not exists "pgcrypto";

-- profiles table
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now()
);

-- Migration helpers for an existing bare profiles table
do $$
begin
  -- Fix common typo if present
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_nmae'
  ) then
    alter table public.profiles rename column display_nmae to display_name;
  end if;
exception when others then null;
end $$;

alter table public.profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists password_hash text,
  add column if not exists password_salt text,
  add column if not exists created_at timestamptz default now();

do $$
begin
  -- id primary key
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'p'
  ) then
    alter table public.profiles
      add constraint profiles_pkey primary key (id);
  end if;

  -- unique email
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'u' and conname = 'profiles_email_key'
  ) then
    alter table public.profiles
      add constraint profiles_email_key unique (email);
  end if;
end $$;

alter table public.profiles
  alter column id set not null,
  alter column email set not null,
  alter column display_name set not null,
  alter column password_hash set not null,
  alter column password_salt set not null,
  alter column created_at set not null;

-- Ensure defaults exist even if columns pre-existed without them
alter table public.profiles
  alter column id set default gen_random_uuid(),
  alter column created_at set default now();

-- If PostgREST schema cache seems stale after creating tables, you can poke it to reload:
-- select pg_notify('pgrst', 'reload schema');
