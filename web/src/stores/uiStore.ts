import { create } from 'zustand'
import type { GameVariant, PlayMode } from '../engines/types'

document.documentElement.classList.add('light')

interface UIState {
  selectedVariant: GameVariant | null
  selectedMode: PlayMode | null
  lightMode: boolean
  pvpWaitingForPass: boolean
  pvpActivePlayer: number // which player index should see their cards

  setVariant: (v: GameVariant) => void
  setMode: (m: PlayMode) => void
  toggleLightMode: () => void
  setPvpWaitingForPass: (waiting: boolean) => void
  setPvpActivePlayer: (index: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedVariant: null,
  selectedMode: null,
  lightMode: true,
  pvpWaitingForPass: false,
  pvpActivePlayer: 0,

  setVariant: (v) => set({ selectedVariant: v }),
  setMode: (m) => set({ selectedMode: m }),
  toggleLightMode: () =>
    set((s) => {
      const next = !s.lightMode
      document.documentElement.classList.toggle('light', next)
      return { lightMode: next }
    }),
  setPvpWaitingForPass: (waiting) => set({ pvpWaitingForPass: waiting }),
  setPvpActivePlayer: (index) => set({ pvpActivePlayer: index }),
}))
