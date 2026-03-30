import { useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/layout/Layout'
import { PipelineVoluntario } from '@/components/pipeline/PipelineVoluntario'
import { PipelineExecutivo } from '@/components/pipeline/PipelineExecutivo'

export default function Pipeline() {
  const { isAdmin, isLider, isCoordenador } = useAuth()
  const isExecutivo = isAdmin || isLider || isCoordenador

  return (
    <Layout title="Pipeline">
      {isExecutivo ? <PipelineExecutivo /> : <PipelineVoluntario />}
    </Layout>
  )
}
