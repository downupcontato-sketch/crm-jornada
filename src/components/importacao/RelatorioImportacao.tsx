import { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { exportarErrosCSV } from '@/lib/importacao'
import type { RelatorioImportacao, StatusLinha, ResultadoLinha } from '@/types/importacao'

const STATUS_LABEL: Record<StatusLinha, string> = {
  SUCESSO: 'Sucesso',
  ERRO_CAMPO_OBRIGATORIO: 'Campo obrigatório',
  ERRO_TELEFONE_INVALIDO: 'Telefone inválido',
  ERRO_DUPLICATA: 'Duplicata',
  ERRO_TIPO_INVALIDO: 'Tipo inválido',
  ERRO_ABA_CORROMPIDA: 'Aba corrompida',
  AVISO_DADO_INCOMPLETO: 'Dado incompleto',
}

const STATUS_COLOR: Record<StatusLinha, string> = {
  SUCESSO: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  ERRO_CAMPO_OBRIGATORIO: 'text-red-400 bg-red-400/10 border-red-400/20',
  ERRO_TELEFONE_INVALIDO: 'text-red-400 bg-red-400/10 border-red-400/20',
  ERRO_DUPLICATA: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  ERRO_TIPO_INVALIDO: 'text-red-400 bg-red-400/10 border-red-400/20',
  ERRO_ABA_CORROMPIDA: 'text-red-400 bg-red-400/10 border-red-400/20',
  AVISO_DADO_INCOMPLETO: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
}

type TabKey = 'erros' | 'avisos' | 'sucesso'

interface Props {
  relatorio: RelatorioImportacao
}

export function RelatorioImportacaoView({ relatorio }: Props) {
  const [tab, setTab] = useState<TabKey>('erros')
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const erros = relatorio.resultados.filter(r =>
    r.status !== 'SUCESSO' && r.status !== 'AVISO_DADO_INCOMPLETO'
  )
  const avisos = relatorio.resultados.filter(r => r.status === 'AVISO_DADO_INCOMPLETO')
  const sucessos = relatorio.resultados.filter(r => r.status === 'SUCESSO')

  const tabData: Record<TabKey, ResultadoLinha[]> = { erros, avisos, sucesso: sucessos }
  const rows = tabData[tab]

  function toggleRow(idx: number) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  const temErros = erros.length > 0 || avisos.length > 0

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="zion-card text-center">
          <CheckCircle size={20} className="text-emerald-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-emerald-400">{relatorio.importados}</p>
          <p className="text-xs text-muted-foreground">Importados</p>
        </div>
        <div className="zion-card text-center">
          <XCircle size={20} className="text-red-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-400">{relatorio.erros}</p>
          <p className="text-xs text-muted-foreground">Erros</p>
        </div>
        <div className="zion-card text-center">
          <AlertTriangle size={20} className="text-yellow-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-yellow-400">{relatorio.avisos}</p>
          <p className="text-xs text-muted-foreground">Avisos</p>
        </div>
      </div>

      {/* Erros críticos agrupados por tipo */}
      {erros.length > 0 && (
        <div className="zion-card border-red-400/20">
          <div className="flex items-center gap-2 mb-3">
            <XCircle size={16} className="text-red-400" />
            <h3 className="text-sm font-semibold text-red-400">Erros críticos — linhas não importadas</h3>
          </div>
          <div className="space-y-1">
            {(['ERRO_ABA_CORROMPIDA', 'ERRO_CAMPO_OBRIGATORIO', 'ERRO_TELEFONE_INVALIDO', 'ERRO_TIPO_INVALIDO', 'ERRO_DUPLICATA'] as StatusLinha[]).map(tipo => {
              const grupo = erros.filter(e => e.status === tipo)
              if (!grupo.length) return null
              return (
                <div key={tipo} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground">{STATUS_LABEL[tipo]}</span>
                  <span className={cn('px-2 py-0.5 rounded-full border text-xs font-medium', STATUS_COLOR[tipo])}>{grupo.length}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      {temErros && (
        <div className="flex gap-2">
          {([['erros', `Erros (${erros.length})`], ['avisos', `Avisos (${avisos.length})`], ['sucesso', `Sucesso (${sucessos.length})`]] as [TabKey, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                tab === k ? 'bg-menta-light/15 border-menta-light/40 text-menta-light' : 'border-border text-muted-foreground'
              )}>
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Tabela */}
      {rows.length > 0 && (
        <div className="zion-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium w-14">Linha</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Aba</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Nome</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden sm:table-cell">Telefone</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Status</th>
                  <th className="w-8 px-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <>
                    <tr key={idx} className="border-b border-border/40 last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => toggleRow(idx)}>
                      <td className="px-3 py-2 text-muted-foreground">{r.linha}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[80px]">{r.aba}</td>
                      <td className="px-3 py-2 text-offwhite truncate max-w-[120px]">{r.nome ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{r.telefone ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={cn('px-1.5 py-0.5 rounded-full border text-[10px] font-medium whitespace-nowrap', STATUS_COLOR[r.status])}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {expandedRows.has(idx) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </td>
                    </tr>
                    {expandedRows.has(idx) && (
                      <tr key={`${idx}-detail`} className="bg-muted/10 border-b border-border/40">
                        <td colSpan={6} className="px-3 py-2 text-muted-foreground italic text-[11px]">
                          {r.mensagem}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <div className="zion-card text-center py-8 text-muted-foreground text-sm">
          Nenhum registro nesta categoria.
        </div>
      )}

      {/* Export CSV */}
      {temErros && (
        <button
          onClick={() => exportarErrosCSV(relatorio)}
          className="zion-btn-secondary w-full flex items-center justify-center gap-2 text-sm"
        >
          <Download size={15} />Exportar erros e avisos (.csv)
        </button>
      )}
    </div>
  )
}
