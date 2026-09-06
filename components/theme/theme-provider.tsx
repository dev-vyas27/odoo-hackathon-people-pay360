'use client'



import { useCallback, useSyncExternalStore } from 'react'
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme'

type Resolved = 'light' | 'dark'


type Snapshot = 'server' | `${Theme}|${Resolved}`

const SERVER_SNAPSHOT: Snapshot = 'server'

const listeners = new Set<() => void>()
let snapshot: Snapshot = SERVER_SNAPSHOT

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    
  }
  return 'system'
}

function currentlyDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

function compute(): Snapshot {
  return `${readStoredTheme()}|${currentlyDark() ? 'dark' : 'light'}`
}


function sync() {
  const next = compute()
  if (next === snapshot) return
  snapshot = next
  for (const listener of listeners) listener()
}


function applyTheme(theme: Theme): Resolved {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  


  root.style.colorScheme = dark ? 'dark' : 'light'
  return dark ? 'dark' : 'light'
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  const media = window.matchMedia('(prefers-color-scheme: dark)')

  
  
  const onMediaChange = () => {
    if (readStoredTheme() === 'system') applyTheme('system')
    sync()
  }
  
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return
    applyTheme(readStoredTheme())
    sync()
  }

  media.addEventListener('change', onMediaChange)
  window.addEventListener('storage', onStorage)

  


  sync()

  return () => {
    listeners.delete(listener)
    media.removeEventListener('change', onMediaChange)
    window.removeEventListener('storage', onStorage)
  }
}

const getSnapshot = () => snapshot
const getServerSnapshot = () => SERVER_SNAPSHOT

export interface ThemeState {
  
  theme: Theme
  
  resolvedTheme: Resolved
  setTheme: (theme: Theme) => void
  


  mounted: boolean
}

export function useTheme(): ThemeState {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const mounted = value !== 'server'
  const [theme, resolvedTheme] = (mounted ? value : 'system|light').split('|') as [Theme, Resolved]

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      
    }
    sync()
  }, [])

  return { theme, resolvedTheme, setTheme, mounted }
}
