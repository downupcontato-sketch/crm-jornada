export const LOCAL_OPTIONS = [
  {
    group: 'Campus Chácara Flora',
    items: ['Culto 08:00', 'Culto 11:00', 'Culto 16:00', 'Culto 19:00'],
  },
  {
    group: 'Transmissão',
    items: ['Ao Vivo (online)'],
  },
  {
    group: 'Cultos por Ministério',
    items: ['Culto Rise', 'Culto Flow', 'Culto Vox', 'Culto Eklektos', 'Diamantes'],
  },
  {
    group: 'Outros',
    items: ['Reunião de Oração das Mães', 'Links', 'Evangelismo', 'Outros'],
  },
] as const

export type LocalCulto = typeof LOCAL_OPTIONS[number]['items'][number]
