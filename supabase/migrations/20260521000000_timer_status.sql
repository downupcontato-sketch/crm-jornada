-- Migration: campos de timer de resposta persistidos no banco
-- Gerado em 2026-05-21

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS data_aguardando_resposta TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timer_status TEXT DEFAULT 'nenhum'
    CHECK (timer_status IN ('nenhum', 'aguardando', 'feedback_pendente'));

-- Index para o cron job consultar apenas os contatos relevantes
CREATE INDEX IF NOT EXISTS idx_contacts_timer_status
  ON contacts (timer_status)
  WHERE timer_status = 'aguardando';

COMMENT ON COLUMN contacts.data_aguardando_resposta IS
  'Momento em que o WhatsApp foi enviado pela primeira vez (início do timer de 48h)';
COMMENT ON COLUMN contacts.timer_status IS
  'Estado do timer de resposta: nenhum | aguardando | feedback_pendente';
