-- ==========================================================
-- MVP afiliados - estructura base para roles y beneficiarios
-- ==========================================================
-- Ejecuta este script en Supabase SQL Editor.
-- Recomendado: primero en entorno de pruebas.

begin;

-- 1) Tabla beneficiarios
-- cliente_id debe ser bigint para coincidir con clientes.id (bigint)
create table if not exists public.beneficiarios (
  id uuid primary key default gen_random_uuid(),
  cliente_id bigint not null references public.clientes(id) on delete cascade,
  nombre text not null,
  parentesco text,
  documento text,
  created_at timestamptz not null default now()
);

create index if not exists idx_beneficiarios_cliente_id
  on public.beneficiarios(cliente_id);

-- 2) Tabla logs de consultas
create table if not exists public.logs_consultas (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  documento text not null,
  fecha timestamptz not null default now()
);

create index if not exists idx_logs_consultas_user_id
  on public.logs_consultas(user_id);

create index if not exists idx_logs_consultas_documento
  on public.logs_consultas(documento);

-- 3) Tabla profiles conectada a auth.users
-- Rol solicitado: admin | user
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  cliente_id bigint references public.clientes(id) on delete set null,
  documento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_profiles_email_unique
  on public.profiles(email);

-- 4) Trigger para autogenerar profile al crear usuario en auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, ''), 'user')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

commit;

-- ==========================================================
-- Nota para RLS (paso siguiente recomendado):
-- - clientes: admin puede todo; user solo select por reglas
-- - beneficiarios: admin puede todo; afiliado solo cliente_id vinculado
-- - profiles: cada usuario solo su propio profile
-- - logs_consultas: cada user inserta y ve solo sus logs
-- ==========================================================
