-- Finley x Omi command log
create table if not exists public.omi_commands (
  id          bigserial primary key,
  session_id  text not null,
  seg_start   double precision not null,
  command     text not null,
  reply       text,
  status      text not null default 'logged'
              check (status in ('logged', 'pending_approval', 'done')),
  created_at  timestamptz not null default now(),
  unique (session_id, seg_start)
);

-- Server-only access: RLS on, no policies (service role bypasses RLS)
alter table public.omi_commands enable row level security;

create index if not exists omi_commands_status_idx
  on public.omi_commands (status, created_at desc);
