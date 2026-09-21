-- Realtime: o rodapé da sidebar ficava em "Conectando..." para sempre.
--
-- O front assina postgres_changes em contacts e profiles (useBadges) e só
-- marca "Tempo real ativo" quando o Supabase confirma a inscrição. Se as
-- tabelas não estão na publicação supabase_realtime, a confirmação nunca
-- chega: o rótulo fica amarelo e os números só mudam ao recarregar a página.
--
-- Idempotente: rodar de novo não dá erro.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- Conferência: deve devolver as duas linhas.
-- SELECT schemaname, tablename FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime' AND tablename IN ('contacts', 'profiles');
