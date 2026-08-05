-- 016_documents.sql
-- Uploaded documents attached to a student: transcripts, recommendation
-- letters, FAFSA summaries, and the like.
--
-- ===========================================================================
-- TWO HALVES: A TABLE AND A BUCKET
-- ===========================================================================
-- public.documents is metadata only. The bytes live in Supabase Storage, in a
-- private bucket also created here. The two are joined by storage_path, which
-- is unique so no two rows can claim the same object.
--
-- Access follows the established shared pattern: everyone who can see the
-- student's record can list, upload, and delete their documents. There is NO
-- update policy — a document is immutable once uploaded, and replacing one is
-- a delete plus a fresh upload. That also keeps the metadata row and the stored
-- object from drifting apart, since neither can be repointed at the other.
--
-- ===========================================================================
-- PATH CONVENTION — LOAD BEARING
-- ===========================================================================
-- Every object MUST be stored as:
--
--     <student_id>/<anything>
--
-- e.g. "ccd81345-e414-448a-8035-2b6f792c1bd3/1a2b3c-transcript.pdf"
--
-- The storage policies at the bottom of this file read the FIRST path segment,
-- parse it as a student id, and run the same can_access_student() test used
-- everywhere else. An upload written to any other shape is simply refused —
-- there is no fallback. Application code and this file have to agree.
--
-- Filenames are not unique on their own, so put a uuid or timestamp in the
-- second segment; two "transcript.pdf" uploads for one student would otherwise
-- collide, and storage_path is unique.
--
-- Depends on 001-015 (can_access_student comes from 010).

-- ---------------------------------------------------------------------------
-- Metadata table
-- ---------------------------------------------------------------------------

create table public.documents (
  id              uuid        primary key default gen_random_uuid(),
  student_id      uuid        not null references public.students (id) on delete cascade,
  file_name       text        not null,
  -- The object key inside the bucket, following the convention above. Unique so
  -- one stored object maps to exactly one metadata row.
  storage_path    text        not null unique,
  mime_type       text,
  -- bigint, not integer: a 25MB cap fits in int4 today, but the column should
  -- not be the reason a future limit cannot be raised.
  file_size_bytes bigint,
  uploaded_by     uuid        references public.profiles (id),
  created_at      timestamptz not null default now()
);

create index documents_student_id_idx on public.documents (student_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: public.documents
-- ---------------------------------------------------------------------------

alter table public.documents enable row level security;

create policy "Anyone with student access can view documents"
  on public.documents
  for select
  to authenticated
  using (public.can_access_student(student_id));

-- uploaded_by gets the same self-attribution check used for added_by elsewhere:
-- a caller may stamp their own id or leave it null, but not someone else's.
create policy "Anyone with student access can add documents"
  on public.documents
  for insert
  to authenticated
  with check (
    public.can_access_student(student_id)
    and (uploaded_by is null or uploaded_by = auth.uid())
  );

create policy "Anyone with student access can delete documents"
  on public.documents
  for delete
  to authenticated
  using (public.can_access_student(student_id));

-- No UPDATE policy, deliberately. See the header.

-- ---------------------------------------------------------------------------
-- uuid parsing that cannot raise
-- ---------------------------------------------------------------------------
-- The storage policies below parse a path segment as a uuid. A plain cast on a
-- non-uuid segment raises, and an exception inside a policy fails the whole
-- query rather than just excluding that row — so one stray object at the bucket
-- root would break every storage listing. This returns null instead, and
-- can_access_student(null) is simply false.

create or replace function public.safe_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception
  when others then
    return null;
end;
$$;

revoke execute on function public.safe_uuid(text) from public;
grant execute on function public.safe_uuid(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------
-- private (public = false): objects are reachable only through a signed URL or
-- an authenticated request that satisfies the policies below.
--
-- allowed_mime_types is an ALLOW-list. Supabase Storage has no deny-list, so
-- executables are excluded by not appearing here rather than by being named.
-- The practical difference: anything not on this list is refused, including
-- formats a school might legitimately send. Add to the list as needed — but
-- note the check is on the CLIENT-DECLARED content type, so it is a guardrail
-- against accident, not an attacker.
--
-- ON CONFLICT DO NOTHING keeps this rerunnable, and means editing the limits
-- later requires an UPDATE rather than re-running this insert.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  26214400, -- 25 MiB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic'
  ]
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage object policies
-- ---------------------------------------------------------------------------
-- Creating the bucket is not enough: storage.objects has RLS of its own, and a
-- private bucket with no policies is reachable only by the service role. These
-- mirror the table policies above so the same people who can see a student's
-- document list can also read and write the underlying files.
--
-- Each one re-derives the student from the first path segment — hence the
-- convention at the top of this file.
--
-- No UPDATE policy here either, matching public.documents: objects are written
-- once and deleted, never overwritten in place.

create policy "Anyone with student access can read student documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and public.can_access_student(
      public.safe_uuid((storage.foldername(name))[1])
    )
  );

create policy "Anyone with student access can upload student documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and public.can_access_student(
      public.safe_uuid((storage.foldername(name))[1])
    )
  );

create policy "Anyone with student access can delete student documents"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and public.can_access_student(
      public.safe_uuid((storage.foldername(name))[1])
    )
  );
