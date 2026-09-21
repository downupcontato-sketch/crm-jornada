-- As 8 colunas que src/types/database.ts declara e o banco não tem.
--
-- Todas são escritas ou lidas pelo front hoje. Como quase nenhuma dessas
-- chamadas confere o erro do Supabase, a falha nunca apareceu para ninguém:
-- o dado simplesmente não era gravado, ou a consulta inteira voltava vazia.
--
-- O caso mais visível é duplicata_revisada: a tela Duplicatas filtra por ela,
-- a consulta falha, e o resultado vazio é exibido como "Nenhuma duplicata
-- pendente". A detecção por telefone normalizado sempre esteve correta.
--
-- Todas com IF NOT EXISTS: rodar de novo não dá erro.

-- ── contacts ────────────────────────────────────────────────────────────────

-- Fila de espera da distribuição. Nulo = não está na fila.
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS posicao_fila integer;

-- NOT NULL de propósito: o front filtra `.eq('duplicata_revisada', false)`, e
-- em SQL `NULL = false` não é verdadeiro — uma coluna anulável esconderia
-- todas as duplicatas de novo, pelo mesmo efeito que estamos corrigindo.
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS duplicata_revisada boolean NOT NULL DEFAULT false;

-- Lead que sobreviveu à mesclagem (distribuicao.ts → mesclarLeads).
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS duplicata_origem_id uuid
  REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Marca de "dado reportado como incorreto" exibida no card do lead.
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS dado_reportado boolean NOT NULL DEFAULT false;

-- Aulas: inscrição confirmada pelo voluntário.
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS inscricao_confirmada boolean NOT NULL DEFAULT false;

-- Timer de acompanhamento do DrawerLead.
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS data_aguardando_resposta timestamptz;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS timer_status text NOT NULL DEFAULT 'nenhum';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_timer_status_check') THEN
    ALTER TABLE public.contacts ADD CONSTRAINT contacts_timer_status_check
      CHECK (timer_status IN ('nenhum', 'aguardando', 'feedback_pendente'));
  END IF;
END $$;

-- ── profiles ────────────────────────────────────────────────────────────────

-- Lista de especializações do voluntário. Vazia, nunca nula: o front itera
-- sobre ela sem proteger contra nulo.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS especializacao text[] NOT NULL DEFAULT '{}';
