import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import Login from '@/pages/Login'
import SolicitarAcesso from '@/pages/SolicitarAcesso'
import AguardandoAprovacao from '@/pages/AguardandoAprovacao'
import Dashboard from '@/pages/Dashboard'
import Pipeline from '@/pages/Pipeline'
import MeusContatos from '@/pages/MeusContatos'
import Cadastro from '@/pages/Cadastro'
import ContatoDetail from '@/pages/ContatoDetail'
import Equipe from '@/pages/Equipe'
import Usuarios from '@/pages/Usuarios'
import Importacao from '@/pages/Importacao'
import GestaoLeads from '@/pages/GestaoLeads'
import Culto from '@/pages/Culto'
import DashboardCoordenador from '@/pages/DashboardCoordenador'
import FormularioPublico from '@/pages/FormularioPublico'
import Relatorios from '@/pages/Relatorios'
import DashboardEntrada from '@/pages/DashboardEntrada'
import EsqueciSenha from '@/pages/EsqueciSenha'
import ResetPassword from '@/pages/ResetPassword'
import AcessoNegado from '@/pages/AcessoNegado'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } })

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/solicitar-acesso" element={<SolicitarAcesso />} />
            <Route path="/formulario" element={<FormularioPublico />} />
            <Route path="/aguardando-aprovacao" element={<AguardandoAprovacao />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/cadastro" element={<ProtectedRoute><Cadastro /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin','lider']}><Dashboard /></ProtectedRoute>} />
            <Route path="/pipeline" element={<ProtectedRoute allowedRoles={['admin','lider','coordenador','linha_de_frente']}><Pipeline /></ProtectedRoute>} />
            <Route path="/meus-contatos" element={<ProtectedRoute allowedRoles={['voluntario']}><MeusContatos /></ProtectedRoute>} />
            <Route path="/contato/:id" element={<ProtectedRoute allowedRoles={['admin','lider','coordenador','voluntario','linha_de_frente']}><ContatoDetail /></ProtectedRoute>} />
            <Route path="/equipe" element={<ProtectedRoute allowedRoles={['admin','lider','coordenador']}><Equipe /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute allowedRoles={['admin','coordenador']}><Usuarios /></ProtectedRoute>} />
            <Route path="/importacao" element={<ProtectedRoute allowedRoles={['admin','lider','coordenador']}><Importacao /></ProtectedRoute>} />
            <Route path="/gestao/leads" element={<ProtectedRoute allowedRoles={['admin','lider','coordenador']}><GestaoLeads /></ProtectedRoute>} />
            <Route path="/culto" element={<ProtectedRoute allowedRoles={['linha_de_frente','admin','lider']}><Culto /></ProtectedRoute>} />
            <Route path="/dashboard/coordenador" element={<ProtectedRoute allowedRoles={['coordenador','admin','lider']}><DashboardCoordenador /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute allowedRoles={['admin','lider']}><Relatorios /></ProtectedRoute>} />
            <Route path="/dashboard/entrada" element={<ProtectedRoute allowedRoles={['admin','lider']}><DashboardEntrada /></ProtectedRoute>} />
            <Route path="/acesso-negado" element={<AcessoNegado />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" toastOptions={{ style: { background: '#0D2B35', border: '1px solid #1C3D4A', color: '#FFFCF2' } }} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
