import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { UserNivel } from '@/types/database'

export function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserNivel[] }) {
  const { user, loading, nivel, profile } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-petroleo flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-menta-light border-t-transparent animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (profile?.status === 'pendente') return <Navigate to="/aguardando-aprovacao" replace />
  if (allowedRoles && nivel && !allowedRoles.includes(nivel)) return <Navigate to="/acesso-negado" replace />
  return <>{children}</>
}
