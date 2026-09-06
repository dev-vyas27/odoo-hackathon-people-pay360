'use client'

/**
 * The theme choice, read as what it actually is: external mutable state.
 *
 * The class on <html> was already set before first paint by
 * `THEME_INIT_SCRIPT` (see lib/theme.ts). Nothing here re-applies it on mount,
 * so there is no second application and nothing flickers — this only reads what
 * the script decided, and writes when the user picks something new.
 *
 * ── Why `useSyncExternalStore` and not an effect ───────────────────────────
 *
 * The theme lives in localStorage and in `prefers-color-scheme`, neither of
 * which React owns and neither of which the server can see. Reading them in an
 * effect and calling setState is the obvious shape and the wrong one: it
 * renders once with a guess, then corrects, and it silently ignores the same
 * value changing anywhere else.
 *
 * Subscribing gets three things the effect version could not:
 *
 *   - a `getServerSnapshot`, so hydration matches by construction instead of by
 *     a `mounted` flag
 *   - live OS changes, for people on "System" who flip their machine to dark at
 *     sunset without reloading
 *   - CROSS-TAB sync, free: `storage` fires in every other tab, so changing the
 *     theme in one updates the rest
 *
 * The snapshot is a STRING, not an object. `getSnapshot` must be referentially
 * stable between renders or React re-renders forever; returning a fresh
 * `{theme, resolved}` object would do exactly that.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme'

type Resolved = 'light' | 'dark'
/**
 * `"<choice>|<resolved>"`, e.g. `"system|dark"` — or the `'server'` sentinel
 * before the client has looked.
 *
 * The sentinel is what carries `mounted`. Deriving it by comparing against a
 * concrete default would be wrong for the commonest case in the world: somebody
 * on "System" with a light desktop would produce exactly the default value, so
 * the toggle would decide it had never mounted and never show its tick.
 */
type Snapshot = 'server' | `${Theme}|${Resolved}`

const SERVER_SNAPSHOT: Snapshot = 'server'

const listeners = new Set<() => void>()
let snapshot: Snapshot = SERVER_SNAPSHOT

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Private browsing can throw on access rather than returning null.
  }
  return 'system'
}

function currentlyDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

function compute(): Snapshot {
  return `${readStoredTheme()}|${currentlyDark() ? 'dark' : 'light'}`
}

/** Recompute and notify, but only if something actually moved. */
function sync() {
  const next = compute()
  if (next === snapshot) return
  snapshot = next
  for (const listener of listeners) listener()
}

/** Put a choice on the document. Returns what it resolved to. */
function applyTheme(theme: Theme): Resolved {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  /**
   * `color-scheme` is what makes the browser's own furniture follow: scrollbars,
   * the picker inside `<input type="date">`, form control defaults. Without it a
   * dark page keeps a white scrollbar and a blinding calendar popup.
   */
  root.style.colorScheme = dark ? 'dark' : 'light'
  return dark ? 'dark' : 'light'
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  const media = window.matchMedia('(prefers-color-scheme: dark)')

  // Only meaningful while the choice is "System" — an explicit light or dark
  // must never be overridden by the machine behind the user's back.
  const onMediaChange = () => {
    if (readStoredTheme() === 'system') applyTheme('system')
    sync()
  }
  // Another tab changed it. `storage` does not fire in the tab that wrote.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return
    applyTheme(readStoredTheme())
    sync()
  }

  media.addEventListener('change', onMediaChange)
  window.addEventListener('storage', onStorage)

  /**
   * React subscribes after the first commit, by which point the real value may
   * already differ from the server snapshot it rendered with. Syncing here is
   * what moves the UI from the placeholder to the truth.
   */
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
  /** What the user chose. Can be 'system'. */
  theme: Theme
  /** What is on screen. Never 'system'. */
  resolvedTheme: Resolved
  setTheme: (theme: Theme) => void
  /**
   * False on the server and during hydration.
   *
   * The server cannot know the theme, so a control that renders differently per
   * theme must render neutrally until this is true.
   */
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
      // Storage denied — the choice still holds for this page's lifetime.
    }
    sync()
  }, [])

  return { theme, resolvedTheme, setTheme, mounted }
}
