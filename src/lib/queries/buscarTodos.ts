// O PostgREST do Supabase devolve no máximo 1000 linhas por requisição e corta o
// resto sem erro. Nas telas que listam o pipeline inteiro isso escondia os leads
// mais recentes (a ordenação é por updated_at crescente, então eles ficam no fim).
// Aqui buscamos página a página até acabar.
const TAMANHO_PAGINA = 1000

type PaginaResultado<T> = PromiseLike<{ data: T[] | null; error: unknown }>

/**
 * `montarQuery` recebe o intervalo [de, ate] e deve devolver a query já com
 * `.range(de, ate)` aplicado. A query precisa de uma ordenação estável
 * (inclua `id` como desempate) para as páginas não se sobreporem.
 */
export async function buscarTodos<T>(
  montarQuery: (de: number, ate: number) => PaginaResultado<T>,
): Promise<T[]> {
  const todos: T[] = []
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await montarQuery(de, de + TAMANHO_PAGINA - 1)
    if (error) throw error
    const pagina = data ?? []
    todos.push(...pagina)
    if (pagina.length < TAMANHO_PAGINA) return todos
  }
}
