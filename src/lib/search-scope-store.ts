import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SearchScopeState = {
  scopeConnection: boolean
  scopeDirectory: boolean
  toggleScopeConnection: () => void
  toggleScopeDirectory: () => void
}

export const useSearchScopeStore = create<SearchScopeState>()(
  persist(
    (set) => ({
      scopeConnection: true,
      scopeDirectory: true,
      toggleScopeConnection: () =>
        set((s) => ({ scopeConnection: !s.scopeConnection })),
      toggleScopeDirectory: () =>
        set((s) => ({ scopeDirectory: !s.scopeDirectory })),
    }),
    { name: 'drivecellar:search-scope' },
  ),
)
