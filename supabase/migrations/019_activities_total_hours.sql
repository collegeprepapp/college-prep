-- 019_activities_total_hours.sql
-- Replaces the two-part hour estimate on activities with a single total.
--
-- hours_per_week and weeks_per_year came from the Common App's own phrasing,
-- but they ask a student to model their year before they can record anything —
-- and most of what a counselor actually wants ("about 220 hours") is a number
-- the student already knows. One nullable numeric replaces both.
--
-- ===========================================================================
-- THIS TABLE HAS DATA — THE ORDER BELOW MATTERS
-- ===========================================================================
-- public.activities is NOT empty (3 rows when this was written), so the columns
-- are not simply dropped: total_hours is added first, populated from the two
-- existing values, and only then are they removed. Dropping first would discard
-- the numbers with no way to recover them.
--
-- What the existing rows convert to:
--
--   "Congressional Award"   5 hrs/wk x 25 wks/yr  ->  125
--   "Congressional Award"  15 hrs/wk x 25 wks/yr  ->  375
--   "Test Activity"         5 hrs/wk x NULL       ->  NULL
--
-- That last one is the honest result, not a bug: an hours-per-week figure with
-- no week count does not describe a total, and inventing one would be worse
-- than leaving it blank for someone to fill in.
--
-- numeric rather than integer: a student who logs 2.5 hours a session should
-- not have to round, and there is no arithmetic here that needs an int.
--
-- No RLS changes. Every policy on this table from 015 tests student_id and
-- names no columns, so all four operations already cover the new field.
--
-- Depends on 015.

alter table public.activities
  add column total_hours numeric;

-- Both operands must be present for the product to mean anything; a null in
-- either would make the whole expression null anyway, but the WHERE says so
-- explicitly rather than relying on that.
update public.activities
   set total_hours = hours_per_week * weeks_per_year
 where hours_per_week is not null
   and weeks_per_year is not null;

alter table public.activities
  drop column hours_per_week,
  drop column weeks_per_year;
