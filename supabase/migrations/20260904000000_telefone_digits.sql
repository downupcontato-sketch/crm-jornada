-- Busca por telefone independente de formatação.
-- Cadastros antigos ficaram com máscara ((11) 95967-2998) e os novos gravam
-- E.164 (+5511959672998), então o ilike no texto cru não encontrava o lead.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS telefone_digits text
  GENERATED ALWAYS AS (regexp_replace(COALESCE(telefone, ''), '\D', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS contacts_telefone_digits_trgm_idx
  ON public.contacts USING gin (telefone_digits gin_trgm_ops);
