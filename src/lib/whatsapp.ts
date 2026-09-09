/**
 * Links de WhatsApp para a lista de contatos do relatório.
 *
 * Os cadastros convivem em dois formatos: os antigos com máscara
 * ((11) 95967-2998) e os novos em E.164 (+5511959672998). Aqui tudo é
 * reduzido a dígitos e recebe o DDI 55 quando falta.
 */

/** Limite de caracteres de um hyperlink no Excel. */
const MAX_URL = 2000

/** Telefone em dígitos com DDI, ou null quando não dá para discar. */
export function telefoneDiscavel(telefone: string | null | undefined): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '')
  if (digitos.length < 10) return null
  if (digitos.length <= 11) return `55${digitos}`
  return digitos
}

/** Variáveis que o usuário pode usar no texto da mensagem. */
export const VARIAVEIS_MENSAGEM = [
  { chave: '{nome}',          descricao: 'Nome completo' },
  { chave: '{primeiro_nome}', descricao: 'Primeiro nome' },
  { chave: '{grupo}',         descricao: 'Grupo' },
  { chave: '{etapa}',         descricao: 'Etapa no pipeline' },
  { chave: '{voluntario}',    descricao: 'Voluntário responsável' },
  { chave: '{local}',         descricao: 'Local do culto' },
] as const

export interface DadosMensagem {
  nome: string
  grupo: string
  etapa: string
  voluntario: string
  local: string
}

/** Substitui as variáveis do template pelos dados do contato. */
export function aplicarVariaveis(template: string, d: DadosMensagem): string {
  return template
    .replace(/\{nome\}/g, d.nome)
    .replace(/\{primeiro_nome\}/g, d.nome.trim().split(/\s+/)[0] ?? '')
    .replace(/\{grupo\}/g, d.grupo)
    .replace(/\{etapa\}/g, d.etapa)
    .replace(/\{voluntario\}/g, d.voluntario)
    .replace(/\{local\}/g, d.local)
}

/**
 * Link wa.me já com a mensagem preenchida. Retorna null quando o telefone
 * não serve ou quando a URL passa do que o Excel aceita em um hyperlink.
 */
export function linkWhatsApp(
  telefone: string | null | undefined,
  mensagem: string,
  d: DadosMensagem,
): string | null {
  const numero = telefoneDiscavel(telefone)
  if (!numero) return null
  const texto = aplicarVariaveis(mensagem, d).trim()
  const url = texto
    ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/${numero}`
  return url.length > MAX_URL ? `https://wa.me/${numero}` : url
}
