-- ============================================
-- Classroom-System Tabellen
-- ============================================

-- Schüler (verknüpft mit fahrschueler-Tabelle)
create table if not exists students (
  id uuid primary key default uuid_generate_v4(),
  phone_number varchar(20) not null unique,
  full_name varchar(255) not null,
  fahrschueler_id uuid,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Lektionen
create table if not exists lessons (
  id uuid primary key default uuid_generate_v4(),
  unternehmen_id uuid not null,
  topic_number integer not null,
  title varchar(255) not null,
  start_time timestamptz,
  room_code varchar(6),
  jitsi_room varchar(255),
  status varchar(20) default 'geplant',
  created_at timestamptz default now()
);

-- Aktive Raum-Codes (kurzlebig)
create table if not exists active_codes (
  id uuid primary key default uuid_generate_v4(),
  room_code varchar(6) not null unique,
  lesson_id uuid references lessons(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Anwesenheits-Logs
create table if not exists attendance_logs (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) not null,
  lesson_id uuid references lessons(id) not null,
  joined_at timestamptz default now(),
  checks_total integer default 0,
  checks_confirmed integer default 0,
  status varchar(20) default 'ausstehend',
  unique(student_id, lesson_id)
);

-- RLS aktivieren
alter table students enable row level security;
alter table lessons enable row level security;
alter table attendance_logs enable row level security;
alter table active_codes enable row level security;

-- Indexes für Performance
create index if not exists idx_active_codes_room_code on active_codes(room_code);
create index if not exists idx_attendance_logs_lesson on attendance_logs(lesson_id);
create index if not exists idx_students_phone on students(phone_number);
