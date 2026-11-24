/**
 * Shared types for the AI Educator (AI Tutor Agent) stage.
 * Kept free of three.js imports so React components can use them without
 * pulling the 3D chunk into the initial bundle.
 */

/** Character animation states. Each is driven by a real interaction event — never by a fake AI response. */
export type TutorState = 'idle' | 'greeting' | 'thinking' | 'explaining' | 'listening' | 'success'

/** Teaching capabilities shown in the dossier; each maps to a group of educational glyphs in the scene. */
export type CapabilityId = 'concept' | 'steps' | 'socratic' | 'curriculum'

export type AssetKind = 'gltf' | 'placeholder'

export interface SceneStatus {
  phase: 'loading' | 'ready' | 'error'
  asset: AssetKind | null
  message?: string
}

/** Where the production character model is expected. See docs in tutor/README.md. */
export const EDUCATOR_MODEL_URL = '/models/tutor/educator.glb'

export const STATE_LABEL: Record<TutorState, string> = {
  idle: 'At ease',
  greeting: 'Greeting',
  thinking: 'Thinking',
  explaining: 'Explaining',
  listening: 'Listening',
  success: 'Encouraging',
}
