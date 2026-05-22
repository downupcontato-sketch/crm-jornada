-- Migration: campo inscricao_confirmada para rastrear confirmação no PROVER
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS inscricao_confirmada BOOLEAN DEFAULT false;

COMMENT ON COLUMN contacts.inscricao_confirmada IS
  'Indica que a pessoa confirmou inscrição no curso PROVER';
COMMENT ON COLUMN contacts.link_confirmado_em IS
  'DEPRECATED — usar data_envio_convite + inscricao_confirmada';
