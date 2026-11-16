import { useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/layout/Layout'
import { PipelineVoluntario } from '@/components/pipeline/PipelineVoluntario'
import { PipelineQuadro } from '@/components/pipeline/PipelineQuadro'
import { PipelineSplitView } from '@/components/pipeline/PipelineSplitView'

export default function Pipeline() {
  const { etapa } = useParams<{ etapa: string }>()
  const { isAdmin, isLider, isCoordenador } = useAuth()

  // Split view for admin/coordenador when a phase is selected
  if (etapa && (isAdmin || isCoordenador || isLider)) {
    return (
      <Layout title="Pipeline">
        <PipelineSplitView />
      </Layout>
    )
  }

  return (
    <Layout title="Pipeline">
      {isAdmin || isLider || isCoordenador ? <PipelineQuadro /> : <PipelineVoluntario />}
    </Layout>
  )
}
