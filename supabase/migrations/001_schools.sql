-- 001_schools.sql
-- Creates the schools table (tenant root) with RLS enabled and no policies.
-- NOTE: With RLS enabled and zero policies, this table is fully locked down for
-- anon/authenticated clients. Policies are added in the next migration, once
-- user roles exist. The service_role key bypasses RLS, so server-side access
-- still works in the meantime.

create table public.schools (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  slug       text        not null unique,
  created_at timestamptz not null default now()
);

alter table public.schools enable row level security;

insert into public.schools (name, slug)
values ('Walnut Grove Christian School', 'walnut-grove');
