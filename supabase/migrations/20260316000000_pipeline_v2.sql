-- =====================================================================
-- Pipeline v2 — Subetapas, Presença em Aulas, Trilhas Paralelas
-- Executar no Supabase SQL Editor
-- =====================================================================

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS fase_pipeline      text NOT NULL DEFAULT 'CONTATO_INICIAL',
  ADD COLUMN IF NOT EXISTS subetapa_contato   text DEFAULT 'TENTATIVA_1',
  ADD COLUMN IF NOT EXISTS subetapa_qualificacao text,
  ADD COLUMN IF NOT EXISTS subetapa_encaminhamento text,
  ADD COLUMN IF NOT EXISTS subetapa_batismo   text,
  ADD COLUMN IF NOT EXISTS presenca_aula1     boolean,
  ADD COLUMN IF NOT EXISTS presenca_aula2     boolean,
  ADD COLUMN IF NOT EXISTS presenca_aula3     boolean,
  ADD COLUMN IF NOT EXISTS presenca_aula4     boolean,
  ADD COLUMN IF NOT EXISTS pro_ver_inscrito   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_ver_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS data_batismo_agendado timestamptz,
  ADD COLUMN IF NOT EXISTS data_batismo_realizado timestamptz,
  ADD COLUMN IF NOT EXISTS link_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_perda       text,
  ADD COLUMN IF NOT EXISTS observacao_perda   text,
  ADD COLUMN IF NOT EXISTS perda_definitiva   boolean NOT NULL DEFAULT false;

-- Inicializar fase_pipeline para contatos existentes
UPDATE public.contacts SET
  fase_pipeline = CASE
    WHEN status = 'batizado'   THEN 'BATIZADO'
    WHEN status = 'arquivado'  THEN 'PERDIDO'
    WHEN status = 'encaminhado' THEN 'POS_AULA'
    ELSE 'CONTATO_INICIAL'
  END,
  subetapa_contato = CASE
    WHEN status NOT IN ('batizado','arquivado','encaminhado') THEN 'TENTATIVA_1'
    ELSE NULL
  END
WHERE fase_pipeline = 'CONTATO_INICIAL';

-- Tabela de histórico detalhado de ações
CREATE TABLE IF NOT EXISTS public.lead_historico (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id),
  tipo        text NOT NULL, -- AVANCO_ETAPA | PRESENCA | PERDA | REENCAMINHAMENTO | CONTATO | EDICAO
  descricao   text NOT NULL,
  dados_antes jsonb,
  dados_depois jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_historico_contact_idx ON public.lead_historico(contact_id);
CREATE INDEX IF NOT EXISTS lead_historico_created_idx ON public.lead_historico(created_at DESC);

ALTER TABLE public.lead_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_historico_read" ON public.lead_historico
  FOR SELECT TO authenticated
  USING (
    public.get_user_nivel() IN ('admin', 'lider')
    OR (
      public.get_user_nivel() = 'coordenador'
      AND EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = contact_id AND c.grupo = public.get_user_grupo()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_id AND c.voluntario_atribuido_id = auth.uid()
    )
  );

CREATE POLICY "lead_historico_insert" ON public.lead_historico
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
