import { createContext, useContext, useState } from 'react'

interface ViewAsState {
  id: string
  nome: string
}

interface ViewAsContextValue {
  viewingAs: ViewAsState | null
  setViewingAs: (v: ViewAsState) => void
  clearViewingAs: () => void
}

const ViewAsContext = createContext<ViewAsContextValue>({
  viewingAs: null,
  setViewingAs: () => {},
  clearViewingAs: () => {},
})

export function ViewAsProvider({ children }: { children: React.ReactNode }) {
  const [viewingAs, setViewingAsState] = useState<ViewAsState | null>(null)

  return (
    <ViewAsContext.Provider value={{
      viewingAs,
      setViewingAs: (v) => setViewingAsState(v),
      clearViewingAs: () => setViewingAsState(null),
    }}>
      {children}
    </ViewAsContext.Provider>
  )
}

export function useViewAs() {
  return useContext(ViewAsContext)
}
