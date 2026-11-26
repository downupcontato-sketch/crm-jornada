-- Check-in v2. Na primeira aula com o check-in (25/11) quem tentou e não foi
-- reconhecido ficou sem registro nenhum: a vida estava parada em Contato
-- inicial (o CRM não sabia que ela já estava nas aulas) ou o número não batia.
--
-- Agora: todo check-in é gravado. Quando dá para confirmar sozinho, a presença
-- entra na hora; quando não dá, fica "pendente" para a equipe vincular à vida.

CREATE TABLE IF NOT EXISTS public.checkins_aula (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula        integer NOT NULL CHECK (aula BETWEEN 1 AND 4),
  nome        text NOT NULL,
  telefone    text NOT NULL,
  contact_id  uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'pendente' CHECK (status IN ('confirmado', 'pendente', 'descartado')),
  motivo      text,                     -- por que ficou pendente
  resolvido_por uuid REFERENCES public.profiles(id),
  resolvido_em  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkins_aula_pendentes_idx ON public.checkins_aula (created_at DESC) WHERE status = 'pendente';

ALTER TABLE public.checkins_aula ENABLE ROW LEVEL SECURITY;
-- Ninguém insere direto: só pela função. A equipe lê e descarta.
DROP POLICY IF EXISTS checkins_aula_ler ON public.checkins_aula;
CREATE POLICY checkins_aula_ler ON public.checkins_aula FOR SELECT TO authenticated
  USING (public.get_user_nivel() IN ('admin', 'lider', 'coordenador'));
DROP POLICY IF EXISTS checkins_aula_atualizar ON public.checkins_aula;
CREATE POLICY checkins_aula_atualizar ON public.checkins_aula FOR UPDATE TO authenticated
  USING (public.get_user_nivel() IN ('admin', 'lider', 'coordenador'));

-- Registra a presença numa vida. Uma regra só, usada pelo aluno e pela equipe.
CREATE OR REPLACE FUNCTION public.aplicar_presenca_checkin(p_contact_id uuid, p_aula integer, p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.contacts%ROWTYPE;
  v_pres boolean[];
  v_presentes integer;
  v_fase text;
BEGIN
  SELECT * INTO c FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  v_pres := ARRAY[c.presenca_aula1, c.presenca_aula2, c.presenca_aula3, c.presenca_aula4];
  v_pres[p_aula] := true;
  SELECT count(*) INTO v_presentes FROM unnest(v_pres) p WHERE p IS TRUE;
  -- Fechou a Aula 4 com 3+ presenças: Pós-aula. Senão está nas aulas,
  -- mesmo que o CRM ainda a tivesse em Contato inicial ou Em contato.
  v_fase := CASE WHEN p_aula = 4 AND v_presentes >= 3 THEN 'POS_AULA' ELSE 'AULAS' END;

  UPDATE public.contacts SET
    presenca_aula1 = v_pres[1], presenca_aula2 = v_pres[2],
    presenca_aula3 = v_pres[3], presenca_aula4 = v_pres[4],
    fase_pipeline = v_fase,
    status = 'ativo',
    perda_definitiva = false,  -- a equipe pode confirmar alguém que estava como perdido e voltou
    subetapa_contato = NULL,
    subetapa_qualificacao = NULL,
    subetapa_encaminhamento = CASE WHEN v_fase = 'POS_AULA' THEN 'ENCAMINHADO' ELSE subetapa_encaminhamento END,
    updated_at = now()
  WHERE id = c.id;

  IF coalesce(p_user, c.voluntario_atribuido_id) IS NOT NULL THEN
    INSERT INTO public.lead_historico (contact_id, user_id, tipo, descricao)
    VALUES (c.id, coalesce(p_user, c.voluntario_atribuido_id), 'PRESENCA',
            format('Aula %s: presente ✓ (check-in%s)', p_aula, CASE WHEN p_user IS NULL THEN ' do aluno' ELSE ' confirmado pela equipe' END));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.aplicar_presenca_checkin(uuid, integer, uuid) FROM public, anon, authenticated;

-- Chamada pela página do aluno (sem login).
DROP FUNCTION IF EXISTS public.registrar_checkin(integer, text, text);
CREATE FUNCTION public.registrar_checkin(p_aula integer, p_nome text, p_telefone text)
RETURNS TABLE (resultado text, primeiro_nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Últimos 8 dígitos: casa com ou sem 55, DDD e o 9 da frente.
  v_dig   text := right(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 8);
  v_de    text := 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç';
  v_para  text := 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc';
  v_primeiro text := lower(translate(split_part(trim(coalesce(p_nome, '')), ' ', 1), v_de, v_para));
  c       public.contacts%ROWTYPE;
  v_motivo text;
BEGIN
  IF p_aula NOT BETWEEN 1 AND 4 OR length(v_dig) < 8 OR v_primeiro = '' THEN
    RETURN QUERY SELECT 'dados_invalidos'::text, NULL::text; RETURN;
  END IF;

  -- Entre os números que batem, prefere quem tem o mesmo primeiro nome e já está mais adiante.
  SELECT * INTO c FROM public.contacts
  WHERE right(telefone_digits, 8) = v_dig
  ORDER BY (lower(translate(split_part(trim(nome), ' ', 1), v_de, v_para)) = v_primeiro) DESC,
           (fase_pipeline = 'AULAS') DESC, updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    v_motivo := 'Número não encontrado no CRM';
  ELSIF lower(translate(split_part(trim(c.nome), ' ', 1), v_de, v_para)) <> v_primeiro THEN
    v_motivo := format('Nome diferente do cadastro (%s)', c.nome);
  ELSIF c.fase_pipeline NOT IN ('CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS') OR c.status NOT IN ('ativo', 'inativo') THEN
    v_motivo := format('Vida em outra etapa (%s, %s)', c.fase_pipeline, c.status);
  END IF;

  IF v_motivo IS NULL THEN
    PERFORM public.aplicar_presenca_checkin(c.id, p_aula, NULL);
    INSERT INTO public.checkins_aula (aula, nome, telefone, contact_id, status)
    VALUES (p_aula, trim(p_nome), p_telefone, c.id, 'confirmado');
    RETURN QUERY SELECT 'ok'::text, split_part(trim(c.nome), ' ', 1);
  ELSE
    INSERT INTO public.checkins_aula (aula, nome, telefone, contact_id, status, motivo)
    VALUES (p_aula, trim(p_nome), p_telefone, c.id, 'pendente', v_motivo);
    RETURN QUERY SELECT 'pendente'::text, split_part(trim(p_nome), ' ', 1);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.registrar_checkin(integer, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.registrar_checkin(integer, text, text) TO anon, authenticated;

-- Chamada pela equipe na lista "Check-ins para confirmar".
CREATE OR REPLACE FUNCTION public.confirmar_checkin(p_checkin_id uuid, p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_aula integer;
BEGIN
  IF public.get_user_nivel() NOT IN ('admin', 'lider', 'coordenador') THEN
    RAISE EXCEPTION 'Sem permissão para confirmar check-in';
  END IF;
  SELECT aula INTO v_aula FROM public.checkins_aula WHERE id = p_checkin_id AND status = 'pendente' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check-in já resolvido'; END IF;
  PERFORM public.aplicar_presenca_checkin(p_contact_id, v_aula, auth.uid());
  UPDATE public.checkins_aula
  SET status = 'confirmado', contact_id = p_contact_id, resolvido_por = auth.uid(), resolvido_em = now()
  WHERE id = p_checkin_id;
END $$;
REVOKE ALL ON FUNCTION public.confirmar_checkin(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_checkin(uuid, uuid) TO authenticated;
