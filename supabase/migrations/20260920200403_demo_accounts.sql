-- Demo progress is owned by an authenticated user. No anonymous access.
create table public.demo_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 262144),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
alter table public.demo_accounts enable row level security;
revoke all on public.demo_accounts from anon, authenticated;
grant select on public.demo_accounts to authenticated;
grant update (state, revision, updated_at) on public.demo_accounts to authenticated;
grant all on public.demo_accounts to service_role;
create policy "Read own demo account" on public.demo_accounts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Save own demo account" on public.demo_accounts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.save_demo_account(expected_revision bigint, next_state jsonb)
returns table(revision bigint) language sql security invoker set search_path = '' as $$
  update public.demo_accounts a
  set state = next_state, revision = a.revision + 1, updated_at = now()
  where a.user_id = (select auth.uid()) and a.revision = expected_revision
  returning a.revision;
$$;
revoke all on function public.save_demo_account(bigint,jsonb) from public, anon;
grant execute on function public.save_demo_account(bigint,jsonb) to authenticated;

-- Only the signup function's service client may consume rate-limit buckets.
create table public.demo_signup_limits (
  bucket text primary key,
  count integer not null,
  expires_at timestamptz not null
);
alter table public.demo_signup_limits enable row level security;
revoke all on public.demo_signup_limits from anon, authenticated;
grant all on public.demo_signup_limits to service_role;
create function public.consume_demo_signup(bucket_key text, max_attempts integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare attempts integer;
begin
  delete from public.demo_signup_limits where expires_at < now();
  insert into public.demo_signup_limits as limits(bucket,count,expires_at)
  values(bucket_key,1,now()+interval '1 hour')
  on conflict(bucket) do update set count=limits.count+1 returning count into attempts;
  return attempts <= max_attempts;
end;
$$;
revoke all on function public.consume_demo_signup(text,integer) from public, anon, authenticated;
grant execute on function public.consume_demo_signup(text,integer) to service_role;
