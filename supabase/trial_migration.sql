-- Palco · migración "prueba gratis" (correr en Supabase → SQL Editor → Run)
-- Agrega el estado comercial + fin de prueba a cuentas ya existentes.
-- Es idempotente: podés correrlo las veces que quieras.

-- 1) Columnas nuevas
alter table public.palco_accounts add column if not exists status text not null default 'trial';
alter table public.palco_accounts add column if not exists trial_ends_at timestamptz;
create index if not exists palco_accounts_status_idx on public.palco_accounts (status);

-- 2) Backfill: cuentas con watchlist pero sin trial → ya completaron onboarding.
update public.palco_accounts
set trial_ends_at = coalesce(trial_ends_at, created_at + interval '2 days'),
    status = case when status = 'pending' and jsonb_array_length(watchlist) > 0 then 'trial' else status end
where trial_ends_at is null and jsonb_array_length(watchlist) > 0;

-- Cuentas sin watchlist → pending (aún no hicieron onboarding).
update public.palco_accounts
set status = 'pending', trial_ends_at = null
where jsonb_array_length(watchlist) = 0 and status = 'trial' and trial_ends_at is not null;

-- 3) Trigger: cuenta vacía al registrarse (trial al terminar onboarding).
create or replace function public.handle_new_palco_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.palco_accounts (user_id, email, status, plan, trial_ends_at)
  values (new.id, new.email, 'pending', null, null)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_palco on auth.users;
create trigger on_auth_user_created_palco
  after insert on auth.users
  for each row execute function public.handle_new_palco_user();

-- ---------------------------------------------------------------------------
-- CHEATSHEET (lo que hacés a mano, sin backoffice):
--
--   -- Ver quién está por vencer / vencido:
--   select email, status, trial_ends_at from public.palco_accounts order by trial_ends_at;
--
--   -- ACTIVAR una cuenta que pagó (acceso pleno, sin vencimiento):
--   update public.palco_accounts set status='active' where email='cliente@empresa.com';
--
--   -- DAR MÁS DÍAS de prueba:
--   update public.palco_accounts set trial_ends_at = now() + interval '7 days'
--   where email='cliente@empresa.com';
--
--   -- CORTAR una cuenta a mano:
--   update public.palco_accounts set status='blocked' where email='cliente@empresa.com';
-- ---------------------------------------------------------------------------
