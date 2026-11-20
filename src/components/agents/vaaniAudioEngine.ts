/**
 * Real Web Audio & Web Speech API Engine for Vaani Voice Agent
 * Handles:
 *  1. Live microphone stream with AnalyserNode for real-time waveform & decibels.
 *  2. Browser SpeechSynthesis for synchronized speech output.
 *  3. Seamless error handling & graceful permission fallbacks.
 */

export interface AudioTelemetry {
  isMicActive: boolean
  isSpeaking: boolean
  decibels: number
  peakFrequency: number
  waveform: number[]
}

export type SpeechState = 'idle' | 'listening' | 'speaking' | 'thinking'

export class VaaniAudioEngine {
  private audioCtx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private micStream: MediaStream | null = null
  private dataArray: Uint8Array<ArrayBuffer> | null = null
  private onStateChange?: (state: SpeechState) => void
  private currentSpeechUtterance: SpeechSynthesisUtterance | null = null

  public state: SpeechState = 'idle'
  public decibels: number = 0
  public peakFrequency: number = 0

  constructor(onStateChange?: (state: SpeechState) => void) {
    this.onStateChange = onStateChange
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Warm up voice list immediately
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices()
      }
    }
  }

  /**
   * Request microphone access and attach real Web Audio Analyser
   */
  async startListening(): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        this.setState('listening')
        return false
      }

      this.stopListening()

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.audioCtx = new AudioContextClass()
      this.analyser = this.audioCtx.createAnalyser()
      this.analyser.fftSize = 64
      this.analyser.smoothingTimeConstant = 0.8

      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const source = this.audioCtx.createMediaStreamSource(this.micStream)
      source.connect(this.analyser)

      const bufferLength = this.analyser.frequencyBinCount
      this.dataArray = new Uint8Array(bufferLength)

      this.setState('listening')
      return true
    } catch (err) {
      console.warn('[Vaani Audio] Mic access not granted or unavailable:', err)
      // Fallback: still transition to listening animation state gracefully
      this.setState('listening')
      return false
    }
  }

  /**
   * Stop microphone analysis
   */
  stopListening() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop())
      this.micStream = null
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {})
      this.audioCtx = null
    }
    this.analyser = null
    this.dataArray = null
    if (this.state === 'listening') {
      this.setState('idle')
    }
  }

  /**
   * Speak a phrase using the browser's native SpeechSynthesis
   */
  speak(text: string, lang = 'en-IN'): boolean {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.setState('speaking')
      setTimeout(() => this.setState('idle'), 4000)
      return false
    }

    try {
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.98
      utterance.pitch = 1.05

      // Choose preferred Indian English or natural female voice if available
      const voices = window.speechSynthesis.getVoices()
      const preferredVoice =
        voices.find(
          (v) =>
            (v.lang.toLowerCase().includes('in') || v.lang.toLowerCase().includes('hi')) &&
            (v.name.toLowerCase().includes('female') ||
              v.name.toLowerCase().includes('natural') ||
              v.name.toLowerCase().includes('heera') ||
              v.name.toLowerCase().includes('neerja') ||
              v.name.toLowerCase().includes('google'))
        ) ||
        voices.find((v) => v.lang.toLowerCase().includes('in') || v.lang.toLowerCase().includes('hi')) ||
        voices.find(
          (v) =>
            v.name.toLowerCase().includes('zira') ||
            v.name.toLowerCase().includes('eva') ||
            v.name.toLowerCase().includes('female')
        ) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en'))

      if (preferredVoice) {
        utterance.voice = preferredVoice
        utterance.lang = preferredVoice.lang
      } else {
        utterance.lang = lang
      }

      this.currentSpeechUtterance = utterance

      let safetyTimer: ReturnType<typeof setTimeout> | null = null

      utterance.onstart = () => {
        this.setState('speaking')
        // Safety timeout in case browser speech synthesis hangs
        safetyTimer = setTimeout(() => {
          if (this.state === 'speaking') {
            this.setState('idle')
          }
        }, 8500)
      }

      utterance.onend = () => {
        if (safetyTimer) clearTimeout(safetyTimer)
        this.currentSpeechUtterance = null
        this.setState('idle')
      }

      utterance.onerror = () => {
        if (safetyTimer) clearTimeout(safetyTimer)
        this.currentSpeechUtterance = null
        this.setState('idle')
      }

      // Small delay prevents Chromium speech synthesis race condition when cancelling
      setTimeout(() => {
        window.speechSynthesis.speak(utterance)
      }, 30)

      return true
    } catch (err) {
      console.warn('[Vaani Audio] Speech synthesis error:', err)
      this.setState('speaking')
      setTimeout(() => this.setState('idle'), 4000)
      return false
    }
  }

  /**
   * Cancel ongoing speech
   */
  stopSpeaking() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    this.currentSpeechUtterance = null
    if (this.state === 'speaking') {
      this.setState('idle')
    }
  }

  /**
   * Manually transition state
   */
  setState(newState: SpeechState) {
    this.state = newState
    this.onStateChange?.(newState)
  }

  /**
   * Read real-time audio amplitude and telemetry (called per animation frame)
   */
  getTelemetry(): AudioTelemetry {
    let decibels = 0
    let peakFrequency = 0
    const waveform: number[] = [0.2, 0.4, 0.6, 0.3, 0.5, 0.7, 0.4, 0.2]

    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray)
      let sum = 0
      let maxVal = 0
      let maxIdx = 0

      for (let i = 0; i < this.dataArray.length; i++) {
        const val = this.dataArray[i]
        sum += val
        if (val > maxVal) {
          maxVal = val
          maxIdx = i
        }
        if (i < waveform.length) {
          waveform[i] = val / 255
        }
      }

      const avg = sum / this.dataArray.length
      decibels = Math.round((avg / 255) * 85)
      peakFrequency = Math.round((maxIdx * (this.audioCtx?.sampleRate || 44100)) / (this.analyser.fftSize * 2))
    } else if (this.state === 'speaking') {
      // Synthetic vocal modulation during speech synthesis playback
      const time = performance.now() * 0.005
      decibels = Math.round(45 + Math.sin(time * 3) * 20)
      peakFrequency = Math.round(280 + Math.sin(time * 2) * 80)
      for (let i = 0; i < waveform.length; i++) {
        waveform[i] = Math.max(0.1, Math.min(1.0, 0.4 + Math.sin(time * 4 + i) * 0.4))
      }
    } else if (this.state === 'listening') {
      decibels = 28
      peakFrequency = 120
    }

    this.decibels = decibels
    this.peakFrequency = peakFrequency

    return {
      isMicActive: !!this.micStream,
      isSpeaking: !!this.currentSpeechUtterance,
      decibels,
      peakFrequency,
      waveform,
    }
  }

  dispose() {
    this.stopListening()
    this.stopSpeaking()
  }
}
