// Filtro padrão para queries de coordenadores: apenas contatos formalmente distribuídos.
// Admins e líderes não aplicam este filtro — eles veem todos os contatos.
export const COORDINATOR_CONTACT_FILTER = { atribuido_por_coordenador: true } as const
