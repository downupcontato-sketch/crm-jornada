import { useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, X, AlertCircle, Info } from 'lucide-react'
import { Layout } from '@/components/layout/Layout'
import { RelatorioImportacaoView } from '@/components/importacao/RelatorioImportacao'
import { processarImportacaoExcel } from '@/lib/importacao'
import type { RelatorioImportacao } from '@/types/importacao'
import { cn } from '@/lib/utils'

type Estado = 'idle' | 'processando' | 'concluido' | 'erro'

export default function Importacao() {
  const [estado, setEstado] = useState<Estado>('idle')
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null)
  const [erroGlobal, setErroGlobal] = useState<string | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [headersDetectados, setHeadersDetectados] = useState<Record<string, string[]> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function processar(file: File) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErroGlobal('Por favor, selecione um arquivo .xlsx ou .xls.')
      return
    }
    setNomeArquivo(file.name)
    setErroGlobal(null)
    setHeadersDetectados(null)
    setEstado('processando')
    try {
      const buffer = await file.arrayBuffer()
      // Extrai headers + primeiras linhas para diagnóstico
      try {
        const wb = XLSX.read(buffer, { type: 'array' })
        const headers: Record<string, string[]> = {}
        for (const aba of wb.SheetNames) {
          const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[aba], { header: 1 })
          // Inclui as primeiras 3 linhas para diagnóstico (header + dados)
          const linhas: string[] = []
          for (let i = 0; i < Math.min(rows.length, 3); i++) {
            linhas.push((rows[i] as unknown[]).map(v => String(v ?? '')).join(' | '))
          }
          if (linhas.length > 0) headers[aba] = linhas
        }
        setHeadersDetectados(headers)
      } catch { /* ignora erros no diagnóstico */ }
      const resultado = await processarImportacaoExcel(buffer)
      setRelatorio(resultado)
      setEstado('concluido')
    } catch (err: any) {
      setErroGlobal(err?.message ?? 'Erro inesperado ao processar o arquivo.')
      setEstado('erro')
    }
  }

  function handleFile(files: FileList | null) {
    if (!files?.length) return
    processar(files[0])
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files)
  }, [])

  function resetar() {
    setEstado('idle')
    setRelatorio(null)
    setErroGlobal(null)
    setNomeArquivo(null)
    setHeadersDetectados(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <Layout title="Importar Contatos">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Zona de upload */}
        {estado === 'idle' || estado === 'erro' ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all',
              dragging ? 'border-menta-light bg-menta-light/5' : 'border-border hover:border-menta-light/50 hover:bg-muted/20'
            )}
          >
            <div className="w-14 h-14 rounded-full bg-menta-dark/20 flex items-center justify-center">
              <FileSpreadsheet size={26} className="text-menta-light" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-offwhite">Arraste seu arquivo aqui</p>
              <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar um .xlsx</p>
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleFile(e.target.files)} />
          </div>
        ) : null}

        {/* Erro global */}
        {erroGlobal && (
          <div className="zion-card border-red-400/30 flex items-start gap-3">
            <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-400 font-medium">Erro</p>
              <p className="text-xs text-muted-foreground mt-0.5">{erroGlobal}</p>
            </div>
          </div>
        )}

        {/* Processando */}
        {estado === 'processando' && (
          <div className="zion-card flex flex-col items-center gap-4 py-10">
            <div className="w-10 h-10 border-2 border-menta-light border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-offwhite">Processando {nomeArquivo}</p>
              <p className="text-xs text-muted-foreground mt-1">Verificando duplicatas e validando registros…</p>
            </div>
          </div>
        )}

        {/* Arquivo selecionado (idle com nome) */}
        {estado === 'concluido' && nomeArquivo && (
          <div className="zion-card flex items-center gap-3">
            <FileSpreadsheet size={18} className="text-menta-light flex-shrink-0" />
            <span className="text-sm text-offwhite flex-1 truncate">{nomeArquivo}</span>
            <button onClick={resetar} className="text-muted-foreground hover:text-red-400 p-1">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Relatório */}
        {estado === 'concluido' && relatorio && (
          <RelatorioImportacaoView relatorio={relatorio} />
        )}

        {/* Headers detectados — diagnóstico quando tudo falha */}
        {estado === 'concluido' && relatorio && relatorio.importados === 0 && headersDetectados && (
          <div className="zion-card border-yellow-400/20 space-y-3">
            <div className="flex items-center gap-2">
              <Info size={14} className="text-yellow-400" />
              <p className="text-xs font-semibold text-yellow-400">Colunas detectadas no arquivo</p>
            </div>
            <p className="text-xs text-muted-foreground">Primeiras linhas de cada aba (verifique se "Nome" e "Telefone/Celular" estão visíveis):</p>
            {Object.entries(headersDetectados).map(([aba, linhas]) => (
              <div key={aba} className="bg-muted/30 rounded-lg p-2 space-y-1">
                <p className="text-[10px] text-menta-light font-semibold uppercase tracking-wider">{aba}</p>
                {linhas.map((linha, i) => (
                  <p key={i} className={cn('text-[10px] font-mono break-all', i === 0 ? 'text-offwhite' : 'text-muted-foreground')}>
                    L{i + 1}: {linha || '(vazio)'}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Nova importação */}
        {estado === 'concluido' && (
          <button onClick={resetar} className="zion-btn-secondary w-full flex items-center justify-center gap-2 text-sm">
            <Upload size={15} />Nova importação
          </button>
        )}

        {/* Instruções */}
        {(estado === 'idle' || estado === 'erro') && (
          <div className="zion-card space-y-2">
            <p className="text-xs font-semibold text-offwhite">Formato esperado</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Cada aba representa um grupo (RISE, FLOW, VOX, EK) ou é ignorada (ORIGEM, CONFIG, LEGENDA)</li>
              <li>Colunas obrigatórias: <strong className="text-offwhite">Nome</strong>, <strong className="text-offwhite">Telefone</strong></li>
              <li>Colunas opcionais: Tipo, Grupo, Email, Sexo, Idade, Igreja Origem, Observações</li>
              <li>Tipo aceito: <em>novo_nascimento</em>, <em>reconciliacao</em>, <em>visitante</em></li>
              <li>Linhas em branco são ignoradas automaticamente</li>
              <li>Registros válidos são importados mesmo se houver erros em outras linhas</li>
            </ul>
          </div>
        )}
      </div>
    </Layout>
  )
}
