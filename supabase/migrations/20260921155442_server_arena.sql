-- Authoritative demo data is separate from the former client-owned snapshot.
-- Existing snapshots remain archived; they are never promoted to verified results.
create table public.arena_accounts (
  user_id uuid primary key references public.demo_accounts(user_id) on delete cascade,
  revision bigint not null default 0,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.arena_challenges (
  code text primary key,
  creator_id uuid not null references public.demo_accounts(user_id),
  guest_id uuid references public.demo_accounts(user_id),
  revision bigint not null default 0,
  state jsonb not null,
  expires_at timestamptz not null
);
create index arena_challenges_creator on public.arena_challenges(creator_id);
create index arena_challenges_guest on public.arena_challenges(guest_id);
create table public.arena_events (
  user_id uuid not null references public.demo_accounts(user_id) on delete cascade,
  request_id text not null,
  received_at timestamptz not null default now(),
  details jsonb not null,
  primary key(user_id,request_id)
);
alter table public.arena_accounts enable row level security;
alter table public.arena_challenges enable row level security;
alter table public.arena_events enable row level security;
revoke all on public.arena_accounts,public.arena_challenges,public.arena_events from public,anon,authenticated;
grant all on public.arena_accounts,public.arena_challenges,public.arena_events to service_role;

-- Service-only transaction: account and challenge revisions are checked together.
-- A failed challenge compare rolls back the balance change as well.
create function public.commit_arena(
  owner_id uuid, expected_revision bigint, next_account jsonb,
  challenge_code text, expected_challenge_revision bigint, next_challenge jsonb,
  request_id text, event_details jsonb, read_challenges jsonb default '[]'::jsonb
) returns boolean language plpgsql security invoker set search_path='' as $$
declare current_revision bigint; challenge_revision bigint; dependency jsonb;
begin
  select a.revision into current_revision from public.arena_accounts a where a.user_id=owner_id for update;
  if current_revision is null or current_revision<>expected_revision then return false; end if;
  for dependency in select value from jsonb_array_elements(read_challenges) order by value->>'code' loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(dependency->>'code',0));
    select c.revision into challenge_revision from public.arena_challenges c where c.code=dependency->>'code' for update;
    if challenge_revision is null or challenge_revision<>(dependency->>'revision')::bigint then return false; end if;
  end loop;
  if next_challenge is not null then
    -- Serialize creation too, where SELECT FOR UPDATE cannot lock a missing row.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(challenge_code,0));
    select c.revision into challenge_revision from public.arena_challenges c where c.code=challenge_code for update;
    if (expected_challenge_revision=-1 and challenge_revision is not null)
       or (expected_challenge_revision<>-1 and (challenge_revision is null or challenge_revision<>expected_challenge_revision)) then return false; end if;
  end if;
  if exists(select 1 from public.arena_events e where e.user_id=owner_id and e.request_id=commit_arena.request_id) then return false; end if;
  update public.arena_accounts set state=next_account,revision=revision+1,updated_at=now() where user_id=owner_id;
  if next_challenge is not null then
    insert into public.arena_challenges(code,creator_id,guest_id,state,expires_at)
      values(challenge_code,(next_challenge->>'creator_id')::uuid,(next_challenge->>'guest_id')::uuid,next_challenge,(next_challenge->>'expires_at')::timestamptz)
      on conflict(code) do update set state=excluded.state,guest_id=excluded.guest_id,revision=public.arena_challenges.revision+1;
  end if;
  insert into public.arena_events(user_id,request_id,details) values(owner_id,request_id,event_details);
  return true;
end; $$;
revoke all on function public.commit_arena(uuid,bigint,jsonb,text,bigint,jsonb,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_arena(uuid,bigint,jsonb,text,bigint,jsonb,text,jsonb,jsonb) to service_role;
