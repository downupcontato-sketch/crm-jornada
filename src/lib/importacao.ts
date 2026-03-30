import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { ResultadoLinha, RelatorioImportacao } from '@/types/importacao'

// ─── Mapeamentos ─────────────────────────────────────────────────────────────

const TIPO_MAP: Record<string, string> = {
  'novonascimento': 'novo_nascimento', 'novo_nascimento': 'novo_nascimento',
  'nn': 'novo_nascimento', 'novo': 'novo_nascimento', 'nascimento': 'novo_nascimento',
  'reconciliacao': 'reconciliacao', 'reconcil': 'reconciliacao', 'recon': 'reconciliacao', 'r': 'reconciliacao',
  'visitante': 'visitante', 'visita': 'visitante', 'v': 'visitante',
}

const GRUPO_MAP: Record<string, string> = {
  'rise': 'rise', 'flow': 'flow', 'vox': 'vox', 'ek': 'ek',
  'ziongeral': 'zion_geral', 'zion_geral': 'zion_geral', 'geral': 'zion_geral', 'zion': 'zion_geral',
}

// Aliases de colunas → chave canônica
// Chave: normalizeKey aplicado ao header real; Valor: campo canônico
const COLUNA_MAP: Record<string, string> = {
  // ── nome ──
  'nome': 'nome', 'name': 'nome', 'nomecompleto': 'nome', 'nomecompletodoparticipante': 'nome',
  'nomeparticipante': 'nome', 'nomecontato': 'nome', 'participante': 'nome',
  'nomemembro': 'nome', 'nomedomembro': 'nome', 'nomevisitante': 'nome',
  // ── telefone ──
  'telefone': 'telefone', 'celular': 'telefone', 'whatsapp': 'telefone', 'wpp': 'telefone',
  'tel': 'telefone', 'fone': 'telefone', 'phone': 'telefone', 'cel': 'telefone',
  'numerodetelefone': 'telefone', 'numerodowpp': 'telefone', 'numerodowhat': 'telefone',
  'numerodowhatsapp': 'telefone', 'celularwhatsapp': 'telefone', 'telefoneouce': 'telefone',
  'telefoneoucelular': 'telefone', 'telefoneoufone': 'telefone', 'celularoufone': 'telefone',
  'telefonecelular': 'telefone', 'celularouwhatsapp': 'telefone', 'whatsappoucelular': 'telefone',
  'contatotelefone': 'telefone', 'numeroderede': 'telefone', 'contato': 'telefone',
  'numero': 'telefone', 'num': 'telefone', 'n': 'telefone',
  // ── email ──
  'email': 'email', 'mail': 'email', 'correioeletronico': 'email',
  // ── tipo ──
  'tipo': 'tipo', 'tipodecontato': 'tipo', 'tipocontato': 'tipo', 'tipo_contato': 'tipo',
  'tipovisita': 'tipo', 'categoria': 'tipo', 'classificacao': 'tipo', 'conversao': 'tipo',
  'tipodevisita': 'tipo', 'tipodemembro': 'tipo', 'origemmembro': 'tipo', 'statusconversao': 'tipo',
  // ── grupo ──
  'grupo': 'grupo', 'nucleo': 'grupo', 'celula': 'grupo', 'ministerio': 'grupo',
  'grupodejovens': 'grupo', 'ministerios': 'grupo', 'departamento': 'grupo',
  // ── sexo ──
  'sexo': 'sexo', 'genero': 'sexo', 'gender': 'sexo',
  // ── idade ──
  'idade': 'idade', 'age': 'idade', 'anos': 'idade',
  // ── igreja ──
  'igrejaorigem': 'igreja_origem', 'igrejadeorigem': 'igreja_origem',
  'igrejaanterior': 'igreja_origem', 'igrejaatual': 'igreja_origem', 'igreja': 'igreja_origem',
  'igrejadeprocedencia': 'igreja_origem',
  // ── culto ──
  'culto': 'culto_captacao', 'cultodecaptacao': 'culto_captacao',
  'culto_captacao': 'culto_captacao', 'servico': 'culto_captacao', 'cultofrequentado': 'culto_captacao',
  // ── observações ──
  'observacoes': 'observacoes', 'obs': 'observacoes', 'nota': 'observacoes',
  'notas': 'observacoes', 'anotacoes': 'observacoes', 'comentario': 'observacoes',
  'comentarios': 'observacoes', 'descricao': 'observacoes', 'informacoes': 'observacoes',
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

/** Remove acentos, espaços, underscores, pontos, parênteses, barras, minúsculo */
function normalizeKey(k: string): string {
  return k
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_\-().\/ºª°:,;]/g, '')
}

/** Constrói mapa { campo_canonico: valor } a partir de uma linha bruta do Excel */
function normalizarLinha(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    const kNorm = normalizeKey(k)
    const canonica = COLUNA_MAP[kNorm]
    if (canonica && !(canonica in out)) out[canonica] = v
    // Guarda também a versão normalizada para debug
    if (!(kNorm in out)) out[`__raw_${kNorm}`] = v
  }
  return out
}

/** Converte para string, trata notação científica do Excel (ex: 1.1987654321E+10) */
function toStr(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'number') {
    // Números inteiros grandes: não usar toString() científico
    if (Number.isFinite(val) && Math.abs(val) < 1e15) return String(Math.round(val))
    return String(val)
  }
  const s = String(val).trim()
  if (/^-?\d+\.?\d*[eE][+-]?\d+$/i.test(s)) {
    try { return String(Math.round(parseFloat(s))) } catch { /* fallback */ }
  }
  return s
}

function normStr(val: unknown): string {
  return normalizeKey(toStr(val))
}

function isRowEmpty(row: Record<string, unknown>): boolean {
  return Object.entries(row)
    .filter(([k]) => !k.startsWith('__raw_'))
    .every(([, v]) => v === null || v === undefined || toStr(v) === '')
}

// Validação de telefone
function normalizarTelefone(raw: unknown): string | null {
  const s = toStr(raw)
  if (!s) return null
  const digits = s.replace(/\D/g, '')
  if (digits.length === 0) return null
  if (digits.length === 13 && digits.startsWith('55')) return digits.slice(2)
  if (digits.length === 12 && digits.startsWith('55')) return digits.slice(2)
  if (digits.length === 11 || digits.length === 10) return digits
  // 9 dígitos sem DDD — inválido mas registra para debug
  return null
}

function validarTelefone(raw: unknown): boolean {
  return normalizarTelefone(raw) !== null
}

// ─── Fetch telefones existentes ───────────────────────────────────────────────

async function fetchTelefonesExistentes(): Promise<Set<string>> {
  const set = new Set<string>()
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data } = await supabase.from('contacts').select('telefone').range(from, from + pageSize - 1)
    if (!data?.length) break
    for (const c of data) {
      const norm = normalizarTelefone(c.telefone)
      if (norm) set.add(norm)
    }
    if (data.length < pageSize) break
    from += pageSize
  }
  return set
}

// ─── Detectar linha de cabeçalho ──────────────────────────────────────────────

/**
 * Algumas planilhas têm metadados antes dos headers (ex: nome do voluntário, data).
 * Procura a primeira linha que contenha pelo menos uma coluna reconhecida.
 */
function detectarLinhaHeader(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue
    const temReconhecida = row.some(cell => {
      const k = normalizeKey(toStr(cell))
      return k in COLUNA_MAP
    })
    if (temReconhecida) return i
  }
  return 0 // assume primeira linha como header
}

// ─── Processamento de linha ───────────────────────────────────────────────────

function processarLinha(
  rawOriginal: Record<string, unknown>,
  numeroLinha: number,
  aba: string,
  telefonesDB: Set<string>,
  telefonesArquivo: Set<string>,
): ResultadoLinha[] {
  if (isRowEmpty(rawOriginal)) return []

  const row = normalizarLinha(rawOriginal)

  const nome = toStr(row.nome)
  const telefoneRaw = row.telefone
  const email = toStr(row.email)
  const tipoRaw = normStr(row.tipo)
  const grupoRaw = normStr(row.grupo)
  const observacoes = toStr(row.observacoes)
  const igrejaOrigem = toStr(row.igreja_origem)
  const cultoCaptacao = toStr(row.culto_captacao)
  const sexoRaw = normStr(row.sexo)
  const idadeRaw = row.idade

  console.log(`[import] Linha ${numeroLinha} | aba="${aba}" | nome="${nome}" | tel="${toStr(telefoneRaw)}" | rawKeys=${Object.keys(rawOriginal).join(',')}`)

  if (!nome) {
    return [{ linha: numeroLinha, aba, status: 'ERRO_CAMPO_OBRIGATORIO', mensagem: `Nome ausente. Colunas detectadas: ${Object.keys(rawOriginal).join(', ')}` }]
  }
  if (!telefoneRaw && toStr(telefoneRaw) === '') {
    return [{ linha: numeroLinha, aba, status: 'ERRO_CAMPO_OBRIGATORIO', nome, mensagem: 'Telefone ausente.' }]
  }
  if (!validarTelefone(telefoneRaw)) {
    const telStr = toStr(telefoneRaw)
    const digitos = telStr.replace(/\D/g, '')
    if (!telStr) {
      return [{ linha: numeroLinha, aba, status: 'ERRO_CAMPO_OBRIGATORIO', nome, mensagem: 'Telefone ausente.' }]
    }
    return [{
      linha: numeroLinha, aba, status: 'ERRO_TELEFONE_INVALIDO', nome, telefone: telStr,
      mensagem: `Telefone inválido: "${telStr}" (${digitos.length} dígitos). Esperado: 10 ou 11 dígitos com DDD.`,
    }]
  }

  const telefoneFinal = normalizarTelefone(telefoneRaw)!

  if (telefonesArquivo.has(telefoneFinal)) {
    return [{ linha: numeroLinha, aba, status: 'ERRO_DUPLICATA', nome, telefone: telefoneFinal, mensagem: `Duplicata no arquivo: ${telefoneFinal}` }]
  }
  if (telefonesDB.has(telefoneFinal)) {
    return [{ linha: numeroLinha, aba, status: 'ERRO_DUPLICATA', nome, telefone: telefoneFinal, mensagem: `Já cadastrado no sistema: ${telefoneFinal}` }]
  }
  telefonesArquivo.add(telefoneFinal)

  const tipo = TIPO_MAP[tipoRaw] ?? null
  const avisos: ResultadoLinha[] = []
  if (!tipoRaw || !tipo) {
    avisos.push({
      linha: numeroLinha, aba, status: 'AVISO_DADO_INCOMPLETO', nome, telefone: telefoneFinal,
      mensagem: tipoRaw ? `Tipo "${tipoRaw}" não reconhecido — importado como "visitante".` : 'Tipo não informado — importado como "visitante".',
    })
  }

  let grupo = GRUPO_MAP[grupoRaw] ?? null
  if (!grupo) {
    // Tenta inferir do nome da aba (ex: "VOX_NomeVoluntario" → "vox")
    const abaNorm = normalizeKey(aba)
    for (const [k, v] of Object.entries(GRUPO_MAP)) {
      if (abaNorm.startsWith(k) || abaNorm.includes(k)) { grupo = v; break }
    }
    grupo = grupo ?? 'zion_geral'
  }

  const sexo = sexoRaw.startsWith('f') ? 'feminino'
    : sexoRaw.startsWith('m') ? 'masculino'
    : (sexoRaw === 'outro' || sexoRaw === 'o') ? 'outro'
    : null

  return [
    ...avisos,
    {
      linha: numeroLinha, aba, status: 'SUCESSO', nome, telefone: telefoneFinal,
      mensagem: 'Importado com sucesso.',
      dados: {
        nome, telefone: telefoneFinal, email: email || null,
        tipo: tipo ?? 'visitante', grupo, sexo,
        idade: idadeRaw ? (Number(toStr(idadeRaw)) || null) : null,
        igreja_origem: igrejaOrigem || null,
        culto_captacao: cultoCaptacao || null,
        observacoes: observacoes || null,
        etapa_atual: 1, status: 'ativo', autorizacao_contato: true,
      },
    },
  ]
}

// ─── Processamento de aba ─────────────────────────────────────────────────────

function processarAba(
  sheet: XLSX.WorkSheet,
  nomeAba: string,
  telefonesDB: Set<string>,
  telefonesArquivo: Set<string>,
): ResultadoLinha[] {
  try {
    // Lê como array de arrays para detectar onde está o header
    const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
    const headerIdx = detectarLinhaHeader(rawMatrix)

    // Monta headers a partir da linha detectada
    const headers = (rawMatrix[headerIdx] as unknown[] ?? []).map(h => toStr(h))

    console.log(`[import] Aba "${nomeAba}": headerIdx=${headerIdx}, headers=[${headers.join(' | ')}], totalLinhas=${rawMatrix.length}`)
    if (rawMatrix[headerIdx + 1]) {
      console.log(`[import] Aba "${nomeAba}" linha 1 dados raw:`, JSON.stringify(rawMatrix[headerIdx + 1]))
    }

    // Converte para objetos usando os headers detectados
    const dataRows = rawMatrix.slice(headerIdx + 1)
    const resultados: ResultadoLinha[] = []

    dataRows.forEach((rowArr, idx) => {
      const rowObj: Record<string, unknown> = {}
      ;(rowArr as unknown[]).forEach((val, colIdx) => {
        const key = headers[colIdx] || `col_${colIdx}`
        rowObj[key] = val
      })
      const linhas = processarLinha(rowObj, idx + headerIdx + 2, nomeAba, telefonesDB, telefonesArquivo)
      resultados.push(...linhas)
    })

    return resultados
  } catch (e) {
    console.error(`[import] Erro ao processar aba "${nomeAba}":`, e)
    return [{ linha: 1, aba: nomeAba, status: 'ERRO_ABA_CORROMPIDA', mensagem: `Aba "${nomeAba}" não pôde ser lida: ${String(e)}` }]
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function processarImportacaoExcel(buffer: ArrayBuffer): Promise<RelatorioImportacao> {
  const iniciadoEm = new Date()
  console.log('=== INÍCIO IMPORTAÇÃO ===')

  const telefonesDB = await fetchTelefonesExistentes()
  console.log(`[import] Telefones no banco: ${telefonesDB.size}`)
  const telefonesArquivo = new Set<string>()

  // ── Testes de telefone ────────────────────────────────────────────────────
  const testes = ['11987654321','(11) 98765-4321','11 98765-4321','+55 11 98765-4321','+5511987654321','987654321','(11)987654321','1.1987654321E+10']
  console.log('=== TESTES DE VALIDAÇÃO DE TELEFONE ===')
  testes.forEach(t => {
    const valid = validarTelefone(t)
    const norm = normalizarTelefone(t)
    console.log(`"${t}" → ${valid ? '✅' : '❌'} normalizado="${norm}"`)
  })

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'array' })
  } catch (e) {
    return {
      totalLinhas: 0, importados: 0, erros: 1, avisos: 0, iniciadoEm, finalizadoEm: new Date(),
      resultados: [{ linha: 0, aba: 'Arquivo', status: 'ERRO_ABA_CORROMPIDA', mensagem: `Arquivo inválido: ${String(e)}` }],
    }
  }

  console.log(`[import] Abas encontradas: [${workbook.SheetNames.join(', ')}]`)

  // ── Diagnóstico de cada aba (primeiras 3) ─────────────────────────────────
  for (const aba of workbook.SheetNames.slice(0, 3)) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[aba], { header: 1 })
    console.log(`\n--- Aba: ${aba} ---`)
    console.log('Total de linhas:', rows.length)
    console.log('Linha 0 (raw):', JSON.stringify(rows[0]))
    console.log('Linha 1 (raw):', JSON.stringify(rows[1]))
    console.log('Linha 2 (raw):', JSON.stringify(rows[2]))
  }

  const ABAS_IGNORAR = new Set(['ORIGEM', 'CONFIG', 'LEGENDA', 'INSTRUCOES', 'INSTRUÇÕES', 'SHEET1', 'PLANILHA1', 'INSTRUÇÃO'])
  const abasProcessar = workbook.SheetNames.filter(n => !ABAS_IGNORAR.has(n.toUpperCase().trim()))
  console.log(`[import] Abas a processar: [${abasProcessar.join(', ')}]`)

  const todosResultados: ResultadoLinha[] = []
  for (const aba of abasProcessar) {
    const resultados = processarAba(workbook.Sheets[aba], aba, telefonesDB, telefonesArquivo)
    todosResultados.push(...resultados)
  }

  // Inserir individualmente para não cancelar tudo em caso de falha parcial
  const sucessos = todosResultados.filter(r => r.status === 'SUCESSO' && r.dados)
  console.log(`[import] Registros válidos para inserir: ${sucessos.length}`)
  for (const resultado of sucessos) {
    const { error } = await supabase.from('contacts').insert(resultado.dados as any)
    if (error) {
      console.error(`[import] Erro ao inserir "${resultado.nome}":`, error.message)
      resultado.status = 'ERRO_CAMPO_OBRIGATORIO'
      resultado.mensagem = `Erro ao salvar: ${error.message}`
    }
  }

  const final = {
    totalLinhas: todosResultados.length,
    importados: todosResultados.filter(r => r.status === 'SUCESSO').length,
    erros: todosResultados.filter(r => r.status !== 'SUCESSO' && r.status !== 'AVISO_DADO_INCOMPLETO').length,
    avisos: todosResultados.filter(r => r.status === 'AVISO_DADO_INCOMPLETO').length,
    resultados: todosResultados,
    iniciadoEm,
    finalizadoEm: new Date(),
  }
  console.log(`=== FIM IMPORTAÇÃO === importados=${final.importados} erros=${final.erros} avisos=${final.avisos}`)
  return final
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

export function exportarErrosCSV(relatorio: RelatorioImportacao): void {
  const linhas = relatorio.resultados.filter(r => r.status !== 'SUCESSO')
  if (!linhas.length) return
  const headers = ['Linha', 'Aba', 'Status', 'Nome', 'Telefone', 'Mensagem']
  const rows = linhas.map(r => [r.linha, r.aba, r.status, r.nome ?? '', r.telefone ?? '', r.mensagem])
  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `erros_importacao_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
