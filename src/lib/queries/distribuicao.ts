import { supabase } from '@/lib/supabase'

/** Contatos ativos sem voluntário atribuído — aguardando distribuição formal */
export async function contarPendentesDistribuicao(grupo?: string | null): Promise<number> {
  let q = supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'ativo')
    .is('voluntario_atribuido_id', null)
  if (grupo) q = q.eq('grupo', grupo)
  const { count } = await q
  return count ?? 0
}
