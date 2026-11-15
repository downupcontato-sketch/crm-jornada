-- Quem preencheu o cadastro da vida. O formulário público não tem login,
-- então captador_id fica nulo; guardamos nome e telefone de quem se
-- identificou no início da sessão. Nulo = cadastro antigo ou autocadastro.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS cadastrado_por_nome     text,
  ADD COLUMN IF NOT EXISTS cadastrado_por_telefone text;
