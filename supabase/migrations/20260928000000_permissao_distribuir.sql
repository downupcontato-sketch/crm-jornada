-- Só quem tem esta permissão vê os controles de atribuir voluntário.
-- Administrador não depende dela: o front libera admin sempre, para ninguém
-- ficar sem saída se o responsável estiver indisponível.
--
-- Por enquanto, só o Bruno. Para liberar outra pessoa:
--   UPDATE public.profiles SET pode_distribuir = true WHERE email = '...';
-- Para tirar:
--   UPDATE public.profiles SET pode_distribuir = false WHERE email = '...';
--
-- A regra vive na interface: os botões somem e os seletores ficam travados.
-- O banco não recusa a gravação — decisão consciente, para uma equipe pequena
-- e de confiança. Se um dia precisar de trava de verdade, é uma política de
-- RLS em contacts sobre a coluna voluntario_atribuido_id.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pode_distribuir boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.pode_distribuir IS
  'true = pode atribuir voluntário a uma vida. Admin pode independentemente deste campo.';

UPDATE public.profiles
SET pode_distribuir = true
WHERE lower(email) = 'brunobenites1@gmail.com';

-- Conferência: deve listar o Bruno e os administradores.
-- SELECT nome, email, nivel, pode_distribuir FROM public.profiles
-- WHERE pode_distribuir = true OR nivel = 'admin' ORDER BY nivel, nome;
