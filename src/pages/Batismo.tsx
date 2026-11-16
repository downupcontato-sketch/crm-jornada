import { Layout } from '@/components/layout/Layout'
import { QuadroKanban } from '@/components/pipeline/QuadroKanban'
import { EstadoQuadro, useVidasQuadro } from '@/components/pipeline/PipelineQuadro'
import { COLUNAS_BATISMO, camposParaColunaBatismo, colunaBatismo } from '@/lib/quadro'

// Módulo separado do Jornada (reunião de 12/11), com as 5 etapas da Amanda.
// shortcut: lê as vidas que já estão na trilha de batismo do Jornada; o cadastro
// direto pelo formulário de batismo entra depois do briefing com a Amanda.
export default function Batismo() {
  const { vidas, nomes, recarregar } = useVidasQuadro(
    'batismo', ['POS_AULA', 'BATIZADO', 'REENCAMINHADO'], ['ativo', 'batizado'],
    'subetapa_batismo.not.is.null,fase_pipeline.eq.BATIZADO',
  )
  return (
    <Layout title="Batismo">
      <EstadoQuadro isLoading={vidas.isLoading} error={vidas.error} />
      {!vidas.isLoading && !vidas.error && (
        <QuadroKanban colunas={COLUNAS_BATISMO} contacts={vidas.data ?? []} nomes={nomes}
          colunaDe={colunaBatismo} campos={camposParaColunaBatismo} onAtualizado={recarregar} />
      )}
    </Layout>
  )
}
