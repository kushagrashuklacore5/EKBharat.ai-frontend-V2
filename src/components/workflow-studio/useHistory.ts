import { useCallback, useRef, useState } from 'react'

/** Snapshot-based undo/redo. Call `snapshot()` before each discrete change. */
export function useHistory<T>(getCurrent: () => T, apply: (s: T) => void, limit = 60) {
  const past = useRef<T[]>([])
  const future = useRef<T[]>([])
  const [, bump] = useState(0)
  const refresh = () => bump((n) => n + 1)

  const snapshot = useCallback(() => {
    past.current = [...past.current.slice(-(limit - 1)), getCurrent()]
    future.current = []
    refresh()
  }, [getCurrent, limit])

  const undo = useCallback(() => {
    const prev = past.current.pop()
    if (prev === undefined) return
    future.current.push(getCurrent())
    apply(prev)
    refresh()
  }, [getCurrent, apply])

  const redo = useCallback(() => {
    const next = future.current.pop()
    if (next === undefined) return
    past.current.push(getCurrent())
    apply(next)
    refresh()
  }, [getCurrent, apply])

  const clear = useCallback(() => {
    past.current = []
    future.current = []
    refresh()
  }, [])

  return { snapshot, undo, redo, clear, canUndo: past.current.length > 0, canRedo: future.current.length > 0 }
}
