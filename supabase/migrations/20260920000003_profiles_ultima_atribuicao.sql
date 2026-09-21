-- profiles.ultima_atribuicao não existe no banco, embora src/types/database.ts
-- a declare e redistribuirLead() escreva nela desde sempre — sem checar erro,
-- então a falha nunca apareceu para ninguém.
--
-- A coluna serve de desempate na distribuição: entre dois voluntários com a
-- mesma carga, recebe quem está há mais tempo sem receber. Sem ela, o desempate
-- cairia no id, e o mesmo nome levaria todos os empates para sempre.
--
-- Additiva: coluna nova, nula para todos. Nulo ordena primeiro (NULLS FIRST),
-- então quem nunca recebeu tem prioridade — que é o comportamento desejado.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ultima_atribuicao timestamptz;

COMMENT ON COLUMN public.profiles.ultima_atribuicao IS
  'Momento da última vez que este voluntário recebeu um lead. Desempate da distribuição por menor carga.';
