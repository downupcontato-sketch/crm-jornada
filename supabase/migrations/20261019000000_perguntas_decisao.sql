-- Duas perguntas sugeridas pela Jaque, que atende na ponta.
--
-- Ela notou que a pessoa às vezes marca "Novo Nascimento" sendo reconciliação,
-- ou o contrário, e isso só aparece na conversa depois. As perguntas dão ao
-- voluntário o contexto antes da primeira ligação.
--
-- Anuláveis de propósito: cadastros antigos não têm resposta, e visitante não
-- vê as perguntas. Nulo = não perguntado, que é diferente de "não".

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS ja_fez_decisao_antes boolean,
  ADD COLUMN IF NOT EXISTS ja_batizou_outra_igreja boolean;

COMMENT ON COLUMN public.contacts.ja_fez_decisao_antes IS
  'Resposta a "Você já fez essa decisão antes?" no cadastro. Nulo = não perguntado.';

COMMENT ON COLUMN public.contacts.ja_batizou_outra_igreja IS
  'Resposta a "Já se batizou em outra igreja?" no cadastro. Nulo = não perguntado.';
