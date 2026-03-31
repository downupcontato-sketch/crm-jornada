import { useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/layout/Layout'
import { PipelineVoluntario } from '@/components/pipeline/PipelineVoluntario'
import { PipelineExecutivo } from '@/components/pipeline/PipelineExecutivo'
import { PipelineLider } from '@/components/pipeline/PipelineLider'

export default function Pipeline() {
  const { isAdmin, isLider, isCoordenador } = useAuth()

  return (
    <Layout title="Pipeline">
      {isLider ? <PipelineLider /> : isAdmin || isCoordenador ? <PipelineExecutivo /> : <PipelineVoluntario />}
    </Layout>
  )
}
