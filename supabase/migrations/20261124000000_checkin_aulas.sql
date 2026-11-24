-- Check-in do aluno nas aulas do Jornada por link/QR Code, sem login.
-- O aluno informa nome e WhatsApp; a vida é achada pelo telefone e o primeiro
-- nome precisa conferir. Só registra PRESENÇA: falta continua sendo marcada
-- pelo voluntário na ficha (vidas antigas têm aulas sem registro, e marcar
-- falta nelas sozinho poderia dar alguém como perdido por engano).
--
-- SECURITY DEFINER: o anônimo não lê nem altera contacts; a função devolve só
-- um código de resultado e o primeiro nome, nada além.

CREATE OR REPLACE FUNCTION public.registrar_checkin(p_aula integer, p_nome text, p_telefone text)
RETURNS TABLE (resultado text, primeiro_nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Últimos 10 dígitos: casa com e sem o 55, como a busca do CRM.
  v_dig   text := right(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 10);
  v_de    text := 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç';
  v_para  text := 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc';
  c       public.contacts%ROWTYPE;
  v_pres  boolean[];
  v_presentes integer;
  v_upd_fase text;
BEGIN
  IF p_aula NOT BETWEEN 1 AND 4 OR length(v_dig) < 10 OR coalesce(trim(p_nome), '') = '' THEN
    RETURN QUERY SELECT 'dados_invalidos'::text, NULL::text; RETURN;
  END IF;

  SELECT * INTO c FROM public.contacts
  WHERE right(telefone_digits, 10) = v_dig
    AND fase_pipeline IN ('QUALIFICACAO', 'AULAS') AND status = 'ativo'
  ORDER BY (fase_pipeline = 'AULAS') DESC, updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      CASE WHEN EXISTS (SELECT 1 FROM public.contacts WHERE right(telefone_digits, 10) = v_dig)
           THEN 'fora_das_aulas' ELSE 'nao_encontrado' END, NULL::text;
    RETURN;
  END IF;

  IF lower(translate(split_part(trim(c.nome), ' ', 1), v_de, v_para))
     <> lower(translate(split_part(trim(p_nome), ' ', 1), v_de, v_para)) THEN
    RETURN QUERY SELECT 'nome_nao_confere'::text, NULL::text; RETURN;
  END IF;

  v_pres := ARRAY[c.presenca_aula1, c.presenca_aula2, c.presenca_aula3, c.presenca_aula4];
  IF v_pres[p_aula] IS TRUE THEN
    RETURN QUERY SELECT 'ja_registrado'::text, split_part(trim(c.nome), ' ', 1); RETURN;
  END IF;
  v_pres[p_aula] := true;
  SELECT count(*) INTO v_presentes FROM unnest(v_pres) p WHERE p IS TRUE;

  -- Mesma regra da ficha: ao fechar a Aula 4 com 3+ presenças, segue para o Pós-aula.
  -- Com menos, fica na Aula 4 para o voluntário conferir as faltas na ficha.
  v_upd_fase := CASE WHEN p_aula = 4 AND v_presentes >= 3 THEN 'POS_AULA' ELSE 'AULAS' END;

  UPDATE public.contacts SET
    presenca_aula1 = v_pres[1], presenca_aula2 = v_pres[2],
    presenca_aula3 = v_pres[3], presenca_aula4 = v_pres[4],
    fase_pipeline = v_upd_fase,
    subetapa_qualificacao = NULL,
    subetapa_encaminhamento = CASE WHEN v_upd_fase = 'POS_AULA' THEN 'ENCAMINHADO' ELSE subetapa_encaminhamento END,
    updated_at = now()
  WHERE id = c.id;

  -- lead_historico exige um usuário; sem voluntário atribuído fica só a presença.
  IF c.voluntario_atribuido_id IS NOT NULL THEN
    INSERT INTO public.lead_historico (contact_id, user_id, tipo, descricao)
    VALUES (c.id, c.voluntario_atribuido_id, 'PRESENCA',
            format('Aula %s: presente ✓ (check-in do aluno)', p_aula));
  END IF;

  RETURN QUERY SELECT 'ok'::text, split_part(trim(c.nome), ' ', 1);
END $$;

REVOKE ALL ON FUNCTION public.registrar_checkin(integer, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.registrar_checkin(integer, text, text) TO anon, authenticated;
