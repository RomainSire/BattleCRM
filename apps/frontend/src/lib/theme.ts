import { useCallback, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'battlecrm-theme'

function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function applyTheme(theme: Theme) {
  const isDark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

let listeners: Array<() => void> = []

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot(): Theme {
  return getStoredTheme()
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
  emitChange()
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot)

  const cycle = useCallback(() => {
    const order: Theme[] = ['system', 'light', 'dark']
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
  }, [theme])

  return { theme, setTheme, cycle }
}

// Apply theme on load + listen for system preference changes
applyTheme(getStoredTheme())
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  applyTheme(getStoredTheme())
})
