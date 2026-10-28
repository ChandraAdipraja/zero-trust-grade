create type user_role as enum ('mahasiswa', 'dosen', 'admin');

create table users (
  id uuid primary key default gen_random_uuid(),
  nim text,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role user_role not null,
  created_at timestamptz not null default now(),
  constraint users_mahasiswa_nim_required_check check (role <> 'mahasiswa' or nim is not null)
);

create unique index users_nim_unique_idx on users (nim) where nim is not null;

create table devices (
  id uuid primary key,
  user_id uuid not null references users (id) on delete cascade,
  device_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index devices_user_id_idx on devices (user_id);

create table classes (
  id uuid primary key,
  class_name text not null,
  course_name text not null,
  lecturer_id uuid not null references users (id) on delete restrict,
  is_finalized boolean not null default false,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  constraint classes_finalization_state_check check (
    (is_finalized and finalized_at is not null)
    or (not is_finalized and finalized_at is null)
  )
);

create index classes_lecturer_id_idx on classes (lecturer_id);

create table enrollments (
  id uuid primary key,
  class_id uuid not null references classes (id) on delete cascade,
  student_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint enrollments_class_student_unique unique (class_id, student_id)
);

create index enrollments_student_id_idx on enrollments (student_id);
create index enrollments_class_id_idx on enrollments (class_id);

create table grades (
  id uuid primary key,
  enrollment_id uuid not null unique references enrollments (id) on delete cascade,
  score numeric(5, 2) not null,
  is_finalized boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint grades_score_range_check check (score >= 0 and score <= 100)
);

create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint refresh_tokens_revoked_before_expiry_check check (revoked_at is null or revoked_at <= expires_at)
);

create index refresh_tokens_user_id_idx on refresh_tokens (user_id);

create table service_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  client_secret_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table transcripts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references users (id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table transcript_items (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references transcripts (id) on delete cascade,
  class_id uuid references classes (id) on delete set null,
  class_name text not null,
  course_name text not null,
  score numeric(5, 2) not null,
  released_at timestamptz not null default now(),
  constraint transcript_items_transcript_class_unique unique (transcript_id, class_id)
);

create index transcript_items_transcript_id_idx on transcript_items (transcript_id);

create table audit_logs (
  id bigint generated always as identity primary key,
  timestamp timestamptz not null default now(),
  subject text not null,
  subject_role text,
  endpoint text not null,
  http_method text,
  device_id text,
  decision text not null check (decision in ('allow', 'deny')),
  reason text not null,
  request_id text,
  created_at timestamptz not null default now()
);

create index audit_logs_timestamp_idx on audit_logs (timestamp desc);
create index audit_logs_decision_idx on audit_logs (decision);
create index audit_logs_subject_idx on audit_logs (subject);

alter table users enable row level security;
alter table devices enable row level security;
alter table classes enable row level security;
alter table enrollments enable row level security;
alter table grades enable row level security;
alter table refresh_tokens enable row level security;
alter table service_clients enable row level security;
alter table transcripts enable row level security;
alter table transcript_items enable row level security;
alter table audit_logs enable row level security;

revoke all on users from anon, authenticated;
revoke all on devices from anon, authenticated;
revoke all on classes from anon, authenticated;
revoke all on enrollments from anon, authenticated;
revoke all on grades from anon, authenticated;
revoke all on refresh_tokens from anon, authenticated;
revoke all on service_clients from anon, authenticated;
revoke all on transcripts from anon, authenticated;
revoke all on transcript_items from anon, authenticated;
revoke all on audit_logs from anon, authenticated;
