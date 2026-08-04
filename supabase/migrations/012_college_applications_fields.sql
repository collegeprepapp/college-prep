-- 012_college_applications_fields.sql
-- Widens college_applications to match the fields a counselor actually tracks
-- on a college planning spreadsheet: tour dates, essay and recommendation
-- requirements, admissions contacts, links, and scholarship amount.
--
-- Two outcomes get added to the status vocabulary — 'waitlisted' and 'denied' —
-- so an application can record a result other than success. Nothing about the
-- existing five changes.
--
-- No RLS changes. Every policy on this table from 011 gates on
-- can_access_student(student_id) and none of them names a column, so they
-- already cover everything added here.
--
-- Depends on 011.

-- ---------------------------------------------------------------------------
-- Status vocabulary
-- ---------------------------------------------------------------------------
-- The constraint in 011 was written inline on the column, so Postgres named it
-- college_applications_status_check. It is recreated below under that same name
-- so a future migration can find it the same way.
--
-- VERIFIED against the live database on 2026-08-04: the name is
-- college_applications_status_check, so the drop below matches. Re-check with
-- this if the schema is ever rebuilt from scratch:
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.college_applications'::regclass
--     and contype = 'c';
--
-- Why it matters: IF EXISTS makes the drop rerunnable, but it also means a
-- wrong name fails silently — the OLD five-value constraint would stay in force
-- alongside the new one and keep rejecting 'waitlisted' and 'denied', while the
-- migration itself reported success.

alter table public.college_applications
  drop constraint if exists college_applications_status_check;

alter table public.college_applications
  add constraint college_applications_status_check
  check (
    status in (
      'researching',
      'touring',
      'applied',
      'accepted',
      'committed',
      'waitlisted',
      'denied'
    )
  );

-- ---------------------------------------------------------------------------
-- New columns
-- ---------------------------------------------------------------------------
-- Everything here is either nullable or defaulted, so this is a metadata-only
-- change: no table rewrite, no lock held while rows are scanned, and nothing to
-- backfill. The two NOT NULL booleans are safe for the same reason — Postgres
-- 11+ applies a default to existing rows without rewriting them.
--
-- Those two flags are two-state on purpose: false means "not required", and
-- there is no third "never recorded" state to disambiguate in the UI.

alter table public.college_applications
  add column date_toured                  date,
  add column goal_completion_date         date,
  add column requires_common_app_essay    boolean not null default false,
  add column requires_supplemental_essay  boolean not null default false,
  add column recommendations_needed       integer,
  add column recommendation_notes         text,
  add column website_link                 text,
  add column scholarship_info_link        text,
  add column resume_link                  text,
  add column other_links                  text,
  add column admission_rep_name           text,
  add column admission_rep_email          text,
  -- Unconstrained precision, as specified. numeric with no (p,s) stores any
  -- magnitude exactly, so it will not silently round an award figure.
  add column scholarship_amount           numeric;
