import type { ContactGrupo } from '@/types/database'

export function calcularGrupo(idade: number): ContactGrupo {
  if (idade < 12) return 'zion_geral'  // G5.2 → mapeado para zion_geral
  if (idade < 15) return 'rise'        // 12–14 anos
  if (idade < 18) return 'flow'        // 15–17 anos
  if (idade < 30) return 'vox'         // 18–29 anos
  if (idade < 39) return 'ek'          // 30–38 anos
  return 'zion_geral'                  // 39+ anos
}
