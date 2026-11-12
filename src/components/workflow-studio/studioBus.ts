import type { Workflow } from './engine/types'

/** A request to load something onto the Studio canvas from elsewhere on the page. */
export type StudioRequest = { kind: 'template'; id: string } | { kind: 'workflow'; workflow: Workflow }

type Listener = (r: StudioRequest) => void
const listeners = new Set<Listener>()
/** Held until a Studio mounts (it is lazy-loaded), then delivered once. */
let pending: StudioRequest | null = null

export const studioBus = {
  emit(r: StudioRequest) {
    if (listeners.size) listeners.forEach((l) => l(r))
    else pending = r
  },
  subscribe(l: Listener) {
    listeners.add(l)
    if (pending) {
      const p = pending
      pending = null
      queueMicrotask(() => l(p))
    }
    return () => void listeners.delete(l)
  },
}
