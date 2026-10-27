-- ============================================================
-- Cole este arquivo inteiro no Supabase em: SQL Editor > New query > Run
-- Cria a tabela de clientes e as regras de segurança.
-- ============================================================

create table if not exists public.clientes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome          text not null,
  cpf           text not null,
  nascimento    date,
  telefone      text not null,
  email         text,
  cep           text,
  rua           text,
  numero        text,
  bairro        text,
  cidade        text,
  uf            text,
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz,
  unique (user_id, cpf)  -- o mesmo CPF não pode ser cadastrado duas vezes na mesma conta
);

create index if not exists clientes_user_id_idx on public.clientes (user_id);

-- Segurança: cada usuário só enxerga e altera os PRÓPRIOS clientes.
alter table public.clientes enable row level security;

drop policy if exists "clientes_select" on public.clientes;
drop policy if exists "clientes_insert" on public.clientes;
drop policy if exists "clientes_update" on public.clientes;
drop policy if exists "clientes_delete" on public.clientes;

create policy "clientes_select" on public.clientes
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "clientes_insert" on public.clientes
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "clientes_update" on public.clientes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "clientes_delete" on public.clientes
  for delete to authenticated using ((select auth.uid()) = user_id);
