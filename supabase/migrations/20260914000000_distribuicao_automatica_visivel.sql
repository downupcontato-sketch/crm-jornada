-- Leads distribuídos sumiam do pipeline do voluntário.
--
-- O pipeline do voluntário (e o do coordenador) só mostra contatos com
-- atribuido_por_coordenador = true. A função distribuir_lead atribui o
-- voluntário mas não marca essa flag: quem marcava era o front, num UPDATE
-- logo depois da chamada.
--
-- Esse UPDATE falha em silêncio em dois casos:
--   a) a distribuição acontece fora do front (cron tentar_distribuir_fila);
--   b) quem cadastrou é linha_de_frente ou voluntario — a política
--      contacts_voluntario_update não cobre esses papéis, então o UPDATE
--      atinge zero linhas e ninguém recebe erro.
--
-- Nos dois casos o lead fica atribuído e invisível para quem deveria
-- trabalhá-lo. A correção tira a responsabilidade do front e passa para um
-- trigger, que roda como dono da tabela e não depende de RLS.
--
-- Executar no Supabase SQL Editor.

-- 1. Toda distribuição (voluntário novo + data_distribuicao renovada) conta
--    como atribuição confirmada. Imports sem voluntário não são afetados.
CREATE OR REPLACE FUNCTION public.marcar_distribuicao_confirmada()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.voluntario_atribuido_id IS NOT NULL
     AND NEW.voluntario_atribuido_id IS DISTINCT FROM OLD.voluntario_atribuido_id
     AND NEW.data_distribuicao IS DISTINCT FROM OLD.data_distribuicao THEN
    NEW.atribuido_por_coordenador := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_distribuicao_confirmada ON public.contacts;
CREATE TRIGGER contacts_distribuicao_confirmada
  BEFORE UPDATE OF voluntario_atribuido_id, data_distribuicao ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.marcar_distribuicao_confirmada();

-- 2. Leads sem subetapa na fase de Contato Inicial ficavam fora dos chips do
--    pipeline. Normaliza para a primeira tentativa.
UPDATE public.contacts
SET subetapa_contato = 'TENTATIVA_1'
WHERE fase_pipeline = 'CONTATO_INICIAL'
  AND subetapa_contato IS NULL;

-- 3. RECUPERAÇÃO DOS LEADS JÁ PRESOS — bloco separado, de propósito.
--
--    A versão anterior deste arquivo cruzava com a tabela `atribuicoes`, que
--    não existe neste banco (era a causa do erro 42P01). O critério abaixo não
--    depende dela: se o lead tem voluntário E data de distribuição, ele passou
--    por uma distribuição de verdade e deve estar visível.
--
--    Confira o tamanho do estrago ANTES de rodar:
--      SELECT count(*) FROM public.contacts
--      WHERE voluntario_atribuido_id IS NOT NULL
--        AND data_distribuicao IS NOT NULL
--        AND atribuido_por_coordenador = false;
--
-- UPDATE public.contacts
-- SET atribuido_por_coordenador = true
-- WHERE voluntario_atribuido_id IS NOT NULL
--   AND data_distribuicao IS NOT NULL
--   AND atribuido_por_coordenador = false;
