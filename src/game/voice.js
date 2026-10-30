// Character/announcer voice lines using the browser speech synthesizer.
// The original game ships recorded clips; this is a self-contained voice slot
// that works without bundling any third-party audio.

const PROFILES = {
  modi: { pitch: 0.72, rate: 0.9 },
  rahul: { pitch: 1.0, rate: 1.0 },
  didi: { pitch: 1.28, rate: 1.06 },
  trump: { pitch: 0.66, rate: 0.86 },
  yogi: { pitch: 0.8, rate: 0.94 },
  nitin: { pitch: 0.95, rate: 1.0 },
}

export function createVoice() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  let enabled = true
  let muted = false
  let voice = null
  let voices = []

  function refreshVoices() {
    if (!synth) return
    try {
      voices = synth.getVoices() || []
      voice = voices.find((v) => /en[-_]IN/i.test(v.lang)) ||
        voices.find((v) => /en[-_]GB/i.test(v.lang)) ||
        voices.find((v) => /^en/i.test(v.lang)) || null
    } catch {}
  }
  if (synth) {
    refreshVoices()
    try { synth.addEventListener('voiceschanged', refreshVoices) } catch {}
  }

  function speak(text, charId = null, opts = {}) {
    if (!enabled || muted || !synth || !text) return
    try {
      const u = new SpeechSynthesisUtterance(String(text))
      const profile = PROFILES[charId] || { pitch: 0.78, rate: 0.92 }
      u.pitch = opts.pitch ?? profile.pitch
      u.rate = opts.rate ?? profile.rate
      u.volume = opts.volume ?? 0.55
      u.lang = 'en-IN'
      if (voice) u.voice = voice
      synth.speak(u)
    } catch {}
  }

  function announce(text) {
    speak(text, null, { pitch: 0.68, rate: 0.9, volume: 0.6 })
  }

  function setMuted(value) {
    muted = !!value
    if (muted) { try { synth?.cancel() } catch {} }
  }
  function setEnabled(value) {
    enabled = !!value
    if (!enabled) { try { synth?.cancel() } catch {} }
  }
  function dispose() {
    try { synth?.cancel() } catch {}
    try { synth?.removeEventListener('voiceschanged', refreshVoices) } catch {}
  }

  return { speak, announce, setMuted, setEnabled, isEnabled: () => enabled && !muted, dispose }
}
