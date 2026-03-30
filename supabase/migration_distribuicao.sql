-- =============================================================
-- CRM Jornada — Módulo de Distribuição Inteligente
-- Aplicar APÓS o schema.sql inicial
-- =============================================================

-- ============================
-- ATUALIZAÇÕES EM profiles
-- ============================
alter table public.profiles
  add column if not exists ultima_atribuicao timestamptz,
  add column if not exists especializacao text[] not null default '{}';
  -- array vazio = aceita todos os tipos de lead

-- ============================
-- ATUALIZAÇÕES EM contacts
-- ============================
alter table public.contacts
  add column if not exists posicao_fila integer,           -- null = atribuído, número = posição na fila
  add column if not exists duplicata_origem_id uuid references public.contacts(id);

-- ============================
-- TABELA: atribuicoes (histórico completo)
-- ============================
create table if not exists public.atribuicoes (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  voluntario_id uuid not null references public.profiles(id),
  tipo text not null check (tipo in ('AUTOMATICA', 'MANUAL', 'REDISTRIBUICAO_SLA', 'OVERFLOW')),
  motivo text,
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists atribuicoes_contact_idx on public.atribuicoes(contact_id);
create index if not exists atribuicoes_voluntario_idx on public.atribuicoes(voluntario_id);

-- ============================
-- TABELA: alertas_sla
-- ============================
create table if not exists public.alertas_sla (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tipo text not null check (tipo in ('SLA_48H_VOLUNTARIO', 'SLA_72H_COORDENADOR', 'FILA_CHEIA')),
  resolvido boolean not null default false,
  resolvido_em timestamptz,
  resolvido_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists alertas_sla_contact_idx on public.alertas_sla(contact_id);
create index if not exists alertas_sla_resolvido_idx on public.alertas_sla(resolvido);

-- ============================
-- RLS: atribuicoes
-- ============================
alter table public.atribuicoes enable row level security;

create policy "atribuicoes_read" on public.atribuicoes
  for select to authenticated
  using (
    public.get_user_nivel() in ('admin', 'lider')
    or (
      public.get_user_nivel() = 'coordenador'
      and exists (
        select 1 from public.contacts c
        where c.id = contact_id and c.grupo = public.get_user_grupo()
      )
    )
    or voluntario_id = auth.uid()
  );

create policy "atribuicoes_insert" on public.atribuicoes
  for insert to authenticated
  with check (public.get_user_nivel() in ('admin', 'lider', 'coordenador'));

-- ============================
-- RLS: alertas_sla
-- ============================
alter table public.alertas_sla enable row level security;

create policy "alertas_sla_read" on public.alertas_sla
  for select to authenticated
  using (
    public.get_user_nivel() in ('admin', 'lider')
    or (
      public.get_user_nivel() = 'coordenador'
      and exists (
        select 1 from public.contacts c
        where c.id = contact_id and c.grupo = public.get_user_grupo()
      )
    )
    or exists (
      select 1 from public.contacts c
      where c.id = contact_id and c.voluntario_atribuido_id = auth.uid()
    )
  );

create policy "alertas_sla_update" on public.alertas_sla
  for update to authenticated
  using (public.get_user_nivel() in ('admin', 'lider', 'coordenador'));

-- ============================
-- FUNÇÃO: distribuir_lead
-- ============================
create or replace function public.distribuir_lead(p_contact_id uuid)
returns table(voluntario_id uuid, tipo_atribuicao text, motivo text)
language plpgsql security definer
as $$
declare
  v_contact record;
  v_voluntario_id uuid;
  v_posicao_fila int;
begin
  select * into v_contact from public.contacts where id = p_contact_id;

  if not found then
    return query select null::uuid, 'ERRO'::text, 'Contato não encontrado'::text;
    return;
  end if;

  -- Busca voluntário elegível com 4 regras em cascata:
  -- 1. ativo + mesmo grupo
  -- 2. especializacao compatível (array vazio = aceita todos)
  -- 3. abaixo da capacidade máxima
  -- 4. menor carga → desempate por ultima_atribuicao ASC
  select p.id into v_voluntario_id
  from public.profiles p
  where p.ativo = true
    and p.nivel = 'voluntario'
    and (p.grupo = v_contact.grupo or p.grupo is null)
    and (
      cardinality(p.especializacao) = 0
      or v_contact.tipo::text = any(p.especializacao)
    )
    and (
      select count(*) from public.contacts c
      where c.voluntario_atribuido_id = p.id
        and c.status = 'ativo'
    ) < p.max_contatos_ativos
  order by
    (select count(*) from public.contacts c
     where c.voluntario_atribuido_id = p.id
       and c.status = 'ativo') asc,
    p.ultima_atribuicao asc nulls first
  limit 1;

  if v_voluntario_id is not null then
    -- Atribui o contato
    update public.contacts
    set
      voluntario_atribuido_id = v_voluntario_id,
      data_distribuicao = now(),
      posicao_fila = null,
      etapa_atual = 8,
      sla_status = 'ok',
      updated_at = now()
    where id = p_contact_id;

    -- Registra histórico
    insert into public.atribuicoes (contact_id, voluntario_id, tipo)
    values (p_contact_id, v_voluntario_id, 'AUTOMATICA');

    -- Atualiza ultima_atribuicao do voluntário
    update public.profiles
    set ultima_atribuicao = now()
    where id = v_voluntario_id;

    return query select v_voluntario_id, 'AUTOMATICA'::text, null::text;
  else
    -- Coloca na fila de espera
    select coalesce(max(posicao_fila), 0) + 1 into v_posicao_fila
    from public.contacts
    where grupo = v_contact.grupo
      and status = 'ativo'
      and voluntario_atribuido_id is null;

    update public.contacts
    set posicao_fila = v_posicao_fila, updated_at = now()
    where id = p_contact_id;

    return query select
      null::uuid,
      'FILA'::text,
      ('Todos os voluntários do grupo ' || v_contact.grupo || ' estão no limite de capacidade')::text;
  end if;
end;
$$;

-- ============================
-- FUNÇÃO: verificar_sla_leads (chamada pelo cron)
-- ============================
create or replace function public.verificar_sla_leads()
returns void
language plpgsql security definer
as $$
begin
  -- Atualiza sla_status nos contacts
  update public.contacts
  set sla_status = 'vencido'
  where status = 'ativo'
    and data_distribuicao is not null
    and data_primeiro_contato is null
    and data_distribuicao < now() - interval '48 hours'
    and sla_status != 'vencido';

  update public.contacts
  set sla_status = 'atencao'
  where status = 'ativo'
    and data_distribuicao is not null
    and data_primeiro_contato is null
    and data_distribuicao between now() - interval '48 hours' and now() - interval '24 hours'
    and sla_status = 'ok';

  -- Alerta 48h: voluntário sem registrar contato
  insert into public.alertas_sla (contact_id, tipo)
  select c.id, 'SLA_48H_VOLUNTARIO'
  from public.contacts c
  where c.status = 'ativo'
    and c.data_distribuicao < now() - interval '48 hours'
    and c.data_primeiro_contato is null
    and not exists (
      select 1 from public.alertas_sla a
      where a.contact_id = c.id
        and a.tipo = 'SLA_48H_VOLUNTARIO'
        and a.resolvido = false
    );

  -- Alerta 72h: escalar para coordenador
  insert into public.alertas_sla (contact_id, tipo)
  select c.id, 'SLA_72H_COORDENADOR'
  from public.contacts c
  where c.status = 'ativo'
    and c.data_distribuicao < now() - interval '72 hours'
    and c.data_primeiro_contato is null
    and not exists (
      select 1 from public.alertas_sla a
      where a.contact_id = c.id
        and a.tipo = 'SLA_72H_COORDENADOR'
        and a.resolvido = false
    );

  -- Alerta fila cheia: 3+ contatos aguardando por grupo
  insert into public.alertas_sla (contact_id, tipo)
  select c.id, 'FILA_CHEIA'
  from public.contacts c
  where c.status = 'ativo'
    and c.voluntario_atribuido_id is null
    and (
      select count(*) from public.contacts c2
      where c2.grupo = c.grupo
        and c2.status = 'ativo'
        and c2.voluntario_atribuido_id is null
    ) >= 3
    and not exists (
      select 1 from public.alertas_sla a
      where a.contact_id = c.id
        and a.tipo = 'FILA_CHEIA'
        and a.resolvido = false
    );
end;
$$;

-- ============================
-- FUNÇÃO: tentar_distribuir_fila
-- Redistribui contatos na fila quando capacidade liberar
-- ============================
create or replace function public.tentar_distribuir_fila(p_grupo contact_grupo default null)
returns integer
language plpgsql security definer
as $$
declare
  v_contact record;
  v_resultado record;
  v_redistribuidos integer := 0;
begin
  for v_contact in
    select id from public.contacts
    where status = 'ativo'
      and voluntario_atribuido_id is null
      and (p_grupo is null or grupo = p_grupo)
    order by posicao_fila asc nulls last, created_at asc
  loop
    select * into v_resultado
    from public.distribuir_lead(v_contact.id);

    if v_resultado.tipo_atribuicao = 'AUTOMATICA' then
      v_redistribuidos := v_redistribuidos + 1;
    end if;
  end loop;

  return v_redistribuidos;
end;
$$;

-- ============================
-- CRON: verificar SLA a cada hora
-- (requer pg_cron extension habilitada no Supabase)
-- ============================
-- Habilite em: Supabase Dashboard → Database → Extensions → pg_cron
-- Depois execute:
-- SELECT cron.schedule('verificar-sla-hourly', '0 * * * *', 'SELECT public.verificar_sla_leads()');
-- SELECT cron.schedule('redistribuir-fila-hourly', '30 * * * *', 'SELECT public.tentar_distribuir_fila()');
