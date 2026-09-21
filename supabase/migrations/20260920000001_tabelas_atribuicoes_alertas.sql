-- Cria duas tabelas que o front usa há tempos e que não existem no banco.
--
-- Sem elas:
--   · `atribuicoes` — o Histórico de Interações do lead aparece sempre vazio e
--     o botão "Atribuir" da tela Minha Equipe responde "Erro ao atribuir"
--     MESMO tendo atribuído (redistribuirLead grava o contato, depois tenta
--     gravar o histórico, falha, e devolve esse erro ao front).
--   · `alertas_sla` — a aba Alertas responde "Tudo sob controle" sempre,
--     porque nunca houve onde gravar um alerta.
--
-- Os nomes de constraint aqui importam: o PostgREST embute
-- `profiles!atribuicoes_voluntario_id_fkey(nome)` e `contacts(...)` pelo nome
-- da chave estrangeira. Os nomes abaixo são os que o Postgres gera por padrão,
-- que são exatamente os que o front já pede.
--
-- Additiva: não altera nenhuma tabela existente.

-- ── atribuicoes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.atribuicoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  voluntario_id uuid NOT NULL REFERENCES public.profiles(id),
  tipo         text NOT NULL CHECK (tipo IN ('AUTOMATICA', 'MANUAL', 'REDISTRIBUICAO_SLA')),
  motivo       text,
  criado_por   uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atribuicoes_contact_id_idx   ON public.atribuicoes (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS atribuicoes_voluntario_id_idx ON public.atribuicoes (voluntario_id);

ALTER TABLE public.atribuicoes ENABLE ROW LEVEL SECURITY;

-- Quem enxerga o contato enxerga o histórico dele. O EXISTS abaixo passa pela
-- política de leitura de contacts, então o recorte por papel/grupo é herdado
-- sem precisar repetir a regra aqui.
DROP POLICY IF EXISTS atribuicoes_select ON public.atribuicoes;
CREATE POLICY atribuicoes_select ON public.atribuicoes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id));

DROP POLICY IF EXISTS atribuicoes_insert ON public.atribuicoes;
CREATE POLICY atribuicoes_insert ON public.atribuicoes
  FOR INSERT TO authenticated WITH CHECK (true);

-- mesclarLeads() move o histórico do lead descartado para o mantido.
DROP POLICY IF EXISTS atribuicoes_update ON public.atribuicoes;
CREATE POLICY atribuicoes_update ON public.atribuicoes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── alertas_sla ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alertas_sla (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tipo         text NOT NULL,
  resolvido    boolean NOT NULL DEFAULT false,
  resolvido_em timestamptz,
  resolvido_por uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- A aba Alertas lista só os pendentes, do mais antigo para o mais novo.
CREATE INDEX IF NOT EXISTS alertas_sla_pendentes_idx
  ON public.alertas_sla (created_at) WHERE resolvido = false;

ALTER TABLE public.alertas_sla ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alertas_sla_select ON public.alertas_sla;
CREATE POLICY alertas_sla_select ON public.alertas_sla
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id));

DROP POLICY IF EXISTS alertas_sla_insert ON public.alertas_sla;
CREATE POLICY alertas_sla_insert ON public.alertas_sla
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS alertas_sla_update ON public.alertas_sla;
CREATE POLICY alertas_sla_update ON public.alertas_sla
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
