import { ReactNode, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { useBadges } from '@/hooks/useBadges'

function TitleUpdater() {
  const { totalPendentes } = useBadges()
  useEffect(() => {
    document.title = totalPendentes > 0 ? `(${totalPendentes}) Jornada CRM` : 'Jornada CRM'
  }, [totalPendentes])
  return null
}

export function Layout({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="min-h-screen flex bg-petroleo">
      <TitleUpdater />
      <Sidebar />
      <main className="flex-1 lg:ml-64 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pt-16 lg:pt-6">
          {title && <h1 className="text-xl font-semibold text-offwhite mb-6">{title}</h1>}
          {children}
        </div>
      </main>
    </div>
  )
}
