-- Desliga a distribuição automática, mantendo o motor no banco.
--
-- A escolha do voluntário passa a ser sempre manual (Minha Equipe e Gestão de
-- Leads). A atribuição manual continua gravando data_distribuicao, então o
-- acompanhamento de 48h segue valendo para o que for atribuído à mão.
--
-- A fila atual e os alertas FILA_CHEIA são mantidos de propósito: servem de
-- lista de espera priorizada por ordem de chegada para quem atribuir à mão.
--
-- Para religar:
--   UPDATE public.configuracoes SET valor = true
--   WHERE chave = 'distribuicao_automatica';
--   SELECT cron.schedule('distribuir-fila', '*/15 * * * *',
--                        $cron$SELECT public.tentar_distribuir_fila()$cron$);

-- 1. Onde a chave mora
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave         text PRIMARY KEY,
  valor         boolean NOT NULL,
  descricao     text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Leitura para qualquer usuário logado; escrita só pelo SQL Editor (nenhuma
-- política de UPDATE), para a chave não ser virada por engano pela interface.
DROP POLICY IF EXISTS configuracoes_select ON public.configuracoes;
CREATE POLICY configuracoes_select ON public.configuracoes
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.configuracoes (chave, valor, descricao)
VALUES ('distribuicao_automatica', false,
        'false = o sistema nunca escolhe voluntário sozinho; a atribuição é manual.')
ON CONFLICT (chave) DO UPDATE SET valor = false, atualizado_em = now();

-- 2. Leitor da chave. SECURITY DEFINER para funcionar dentro de distribuir_lead
--    independentemente do papel de quem cadastrou.
CREATE OR REPLACE FUNCTION public.distribuicao_automatica_ligada()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE(
    (SELECT valor FROM public.configuracoes WHERE chave = 'distribuicao_automatica'),
    false
  );
$fn$;

-- 3. Tira o agendamento de 15 em 15 minutos que esvaziava a fila.
DO $unsched$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'distribuir-fila') THEN
    PERFORM cron.unschedule('distribuir-fila');
  END IF;
END
$unsched$;

-- 4. A função passa a respeitar a chave
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
  -- Chave geral. Desligada, a função não escolhe voluntário, não põe o lead
  -- na fila e não gera alerta: o cadastro simplesmente fica sem responsável,
  -- para alguém atribuir à mão em Minha Equipe.
  IF NOT public.distribuicao_automatica_ligada() THEN
    RETURN QUERY SELECT 'DESLIGADA'::text, NULL::uuid, NULL::integer;
    RETURN;
  END IF;

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
