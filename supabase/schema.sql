-- Palco · schema inicial (correr en Supabase → SQL Editor → New query → Run)
-- Proyecto: palco (auth magic link + datasets + cuenta por usuario)

-- ---------------------------------------------------------------------------
-- Datasets públicos (palco_entities, etc.) — lo sube el pipeline con service role
-- ---------------------------------------------------------------------------
create table if not exists public.ui_data (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.ui_data enable row level security;

drop policy if exists "ui_data read anon" on public.ui_data;
create policy "ui_data read anon"
  on public.ui_data for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Cuenta Palco: watchlist, plan y avisos por usuario logueado
-- ---------------------------------------------------------------------------
create table if not exists public.palco_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan text,
  watchlist jsonb not null default '[]'::jsonb,
  avisos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists palco_accounts_email_idx on public.palco_accounts (email);

alter table public.palco_accounts enable row level security;

drop policy if exists "palco_accounts select own" on public.palco_accounts;
create policy "palco_accounts select own"
  on public.palco_accounts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "palco_accounts insert own" on public.palco_accounts;
create policy "palco_accounts insert own"
  on public.palco_accounts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "palco_accounts update own" on public.palco_accounts;
create policy "palco_accounts update own"
  on public.palco_accounts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger: fila vacía al registrarse (opcional; la app también puede hacer upsert)
create or replace function public.handle_new_palco_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.palco_accounts (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_palco on auth.users;
create trigger on_auth_user_created_palco
  after insert on auth.users
  for each row execute function public.handle_new_palco_user();
