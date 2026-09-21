-- Contas que existem para ver o sistema com um nível de acesso, não para
-- atender, estavam recebendo leads da distribuição automática. Como começam
-- com carga zero, a regra de "menor carga" as escolhia primeiro.
--
-- Cria a flag profiles.recebe_distribuicao (padrão true, então nada muda
-- para os voluntários reais), desliga para as duas contas de visualização,
-- devolve os leads delas para "sem voluntário" e passa a respeitar a flag
-- na distribuição. Para voltar a incluir uma conta:
--   UPDATE public.profiles SET recebe_distribuicao = true WHERE email = '...';
--
-- Atribuição manual (Minha Equipe, Gestão de Leads) não é afetada: é uma
-- decisão explícita de quem atribui.

-- 1. A flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS recebe_distribuicao boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.recebe_distribuicao IS
  'false = a distribuição automática nunca escolhe este perfil. Para contas de visualização/teste.';

-- 2. Contas de visualização
UPDATE public.profiles
SET recebe_distribuicao = false
WHERE lower(email) IN ('downup.contato@gmail.com', 'alexandre123.ascl@gmail.com');

-- 3. Devolve os leads delas para o estado de "nunca distribuído".
--    O histórico em `atribuicoes` fica: registra que passaram por essas contas.
UPDATE public.contacts c
SET voluntario_atribuido_id   = NULL,
    atribuido_por_coordenador = false,
    data_distribuicao         = NULL,
    posicao_fila              = NULL,
    sla_status                = 'ok',
    updated_at                = now()
FROM public.profiles p
WHERE c.voluntario_atribuido_id = p.id
  AND lower(p.email) IN ('downup.contato@gmail.com', 'alexandre123.ascl@gmail.com');

-- 4. Distribuição passa a respeitar a flag
CREATE OR REPLACE FUNCTION public.distribuir_lead(p_contact_id uuid)
RETURNS TABLE (tipo_atribuicao text, voluntario_id uuid, posicao_fila integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- %TYPE em vez do nome do enum: o tipo vem da própria coluna, então um
  -- rename futuro do enum não quebra a função.
  v_grupo       public.contacts.grupo%TYPE;
  v_status      public.contacts.status%TYPE;
  v_atual       uuid;
  v_escolhido   uuid;
  v_posicao     integer;
BEGIN
  -- Serializa as distribuições concorrentes. No culto vários cadastros caem
  -- no mesmo segundo; sem isto dois leads leriam a mesma carga e iriam para o
  -- mesmo voluntário, estourando a capacidade dele.
  PERFORM pg_advisory_xact_lock(hashtext('distribuir_lead'));

  SELECT c.grupo, c.status, c.voluntario_atribuido_id
    INTO v_grupo, v_status, v_atual
  FROM public.contacts c
  WHERE c.id = p_contact_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contato % não encontrado', p_contact_id;
  END IF;

  -- Idempotente: chamar duas vezes não rouba o lead de quem já o tem.
  IF v_atual IS NOT NULL THEN
    RETURN QUERY SELECT 'AUTOMATICA'::text, v_atual, NULL::integer;
    RETURN;
  END IF;

  -- Cadastro ainda pendente de aprovação não entra na fila de ninguém.
  IF v_status <> 'ativo' THEN
    RETURN QUERY SELECT 'NAO_ELEGIVEL'::text, NULL::uuid, NULL::integer;
    RETURN;
  END IF;

  -- Menor carga primeiro; empate desempata por quem está há mais tempo sem
  -- receber, para não sobrecarregar sempre o mesmo nome.
  SELECT p.id INTO v_escolhido
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT count(*) AS carga
    FROM public.contacts c
    WHERE c.voluntario_atribuido_id = p.id
      AND c.status = 'ativo'
  ) cg ON true
  WHERE p.nivel = 'voluntario'
    AND p.ativo = true
    -- Contas de visualização/teste ficam fora até alguém ligar a flag.
    AND p.recebe_distribuicao = true
    AND p.grupo = v_grupo
    -- max_contatos_ativos nulo = nunca preenchido: assume 10 em vez de zero,
    -- senão um campo em branco tiraria o voluntário da distribuição.
    AND cg.carga < COALESCE(p.max_contatos_ativos, 10)
  ORDER BY cg.carga ASC, p.ultima_atribuicao ASC NULLS FIRST, p.id
  LIMIT 1;

  -- ── Tem vaga: atribui ────────────────────────────────────────────────────
  IF v_escolhido IS NOT NULL THEN
    UPDATE public.contacts
    SET voluntario_atribuido_id   = v_escolhido,
        data_distribuicao         = now(),
        atribuido_por_coordenador = true,
        sla_status                = 'ok',
        posicao_fila              = NULL,
        updated_at                = now()
    WHERE id = p_contact_id;

    UPDATE public.profiles
    SET ultima_atribuicao = now()
    WHERE id = v_escolhido;

    INSERT INTO public.atribuicoes (contact_id, voluntario_id, tipo, motivo)
    VALUES (p_contact_id, v_escolhido, 'AUTOMATICA', 'Distribuição automática por menor carga');

    RETURN QUERY SELECT 'AUTOMATICA'::text, v_escolhido, NULL::integer;
    RETURN;
  END IF;

  -- ── Sem vaga: fila de espera + alerta ────────────────────────────────────
  SELECT count(*) + 1 INTO v_posicao
  FROM public.contacts c
  WHERE c.grupo = v_grupo
    AND c.status = 'ativo'
    AND c.voluntario_atribuido_id IS NULL
    AND c.posicao_fila IS NOT NULL;

  UPDATE public.contacts
  SET posicao_fila = v_posicao,
      updated_at   = now()
  WHERE id = p_contact_id;

  -- Um alerta aberto por contato basta; não repete a cada nova tentativa.
  INSERT INTO public.alertas_sla (contact_id, tipo)
  SELECT p_contact_id, 'FILA_CHEIA'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.alertas_sla a
    WHERE a.contact_id = p_contact_id AND a.tipo = 'FILA_CHEIA' AND a.resolvido = false
  );

  RETURN QUERY SELECT 'FILA'::text, NULL::uuid, v_posicao;
END;
$$;

REVOKE ALL ON FUNCTION public.distribuir_lead(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.distribuir_lead(uuid) TO authenticated;
