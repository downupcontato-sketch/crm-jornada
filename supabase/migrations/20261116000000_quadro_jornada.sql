-- Quadro do Jornada (reunião de 12/11): FUP 01 a 05, Links → Raízes,
-- dias na etapa e o módulo de Batismo com as 5 etapas da Amanda.
-- Não reclassifica ninguém: cada vida cai na coluna a partir do que já está gravado.

-- 1. Novos valores (FUP_2..FUP_5 em subetapa_contato, RAIZES em subetapa_encaminhamento).
--    Se alguma CHECK criada pelo painel restringir essas colunas, ela sai.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'contacts' AND con.contype = 'c'
      AND (pg_get_constraintdef(con.oid) ILIKE '%subetapa_contato%'
        OR pg_get_constraintdef(con.oid) ILIKE '%subetapa_encaminhamento%')
  LOOP
    EXECUTE format('ALTER TABLE public.contacts DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 2. Desde quando a vida está na etapa atual (base dos prazos do quadro).
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS etapa_desde timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS batismo_finalizado_em timestamptz;

-- Vidas antigas: última mudança registrada no histórico; sem histórico, o cadastro.
UPDATE public.contacts c
SET etapa_desde = GREATEST(
  c.created_at,
  COALESCE(c.data_primeiro_contato, c.created_at),
  COALESCE((SELECT max(h.created_at) FROM public.lead_historico h
            WHERE h.contact_id = c.id AND h.tipo IN ('AVANCO_ETAPA','PRESENCA','PERDA','REENCAMINHAMENTO')), c.created_at)
);

-- Qualquer caminho que mude a etapa (ficha, quadro, presença, importação) zera o relógio.
CREATE OR REPLACE FUNCTION public.contacts_marcar_etapa_desde()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fase_pipeline           IS DISTINCT FROM OLD.fase_pipeline
  OR NEW.subetapa_contato        IS DISTINCT FROM OLD.subetapa_contato
  OR NEW.subetapa_qualificacao   IS DISTINCT FROM OLD.subetapa_qualificacao
  OR NEW.subetapa_encaminhamento IS DISTINCT FROM OLD.subetapa_encaminhamento
  OR NEW.subetapa_batismo        IS DISTINCT FROM OLD.subetapa_batismo
  OR NEW.data_primeiro_contato   IS DISTINCT FROM OLD.data_primeiro_contato
  OR NEW.presenca_aula1 IS DISTINCT FROM OLD.presenca_aula1
  OR NEW.presenca_aula2 IS DISTINCT FROM OLD.presenca_aula2
  OR NEW.presenca_aula3 IS DISTINCT FROM OLD.presenca_aula3
  OR NEW.presenca_aula4 IS DISTINCT FROM OLD.presenca_aula4
  OR NEW.batismo_finalizado_em   IS DISTINCT FROM OLD.batismo_finalizado_em
  THEN
    NEW.etapa_desde := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS contacts_etapa_desde ON public.contacts;
CREATE TRIGGER contacts_etapa_desde
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.contacts_marcar_etapa_desde();
