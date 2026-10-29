// Procedural WebAudio sound engine for Sansad Showdown.
// Every sound is synthesized at runtime. No audio files, no network requests, no imports.

export function createAudio() {
  const MASTER_VOLUME = 0.85;
  const MUSIC_VOLUME = 0.42;
  const LOOKAHEAD_MS = 25;
  const SCHEDULE_AHEAD = 0.1;
  const NOISE_SECONDS = 2;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const mtof = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  const SCALE_BHAIRAV = [0, 1, 4, 5, 7, 8, 11];
  const SCALE_BHAIRAVI = [0, 1, 3, 5, 7, 8, 10];
  const SCALE_DESI = [0, 2, 4, 5, 7, 9, 10];

  const SANSAD_LEAD = [
    4, 3, 2, 3, 4, null, 5, 4, 3, 2, 1, 2, 3, 2, 1, 0,
    5, 4, 3, 4, 5, 6, 5, 4, 3, 2, 3, 4, 5, 4, 3, 2,
  ];
  const JANTAR_LEAD = [
    0, null, 2, 3, 4, null, 3, 2,
    1, null, 0, 1, 2, 3, 2, null,
  ];
  const ROAD_HOOK = [
    0, 2, 4, 2, 5, 4, 2, 0, 7, 5, 4, 2, 4, 2, 0, null,
    0, 2, 4, 2, 5, 6, 5, 4, 2, 4, 5, 4, 2, 1, 0, null,
  ];
  const ROAD_BASS = [33, 33, 36, 38, 33, 33, 31, 40];

  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuffer = null;
  let muted = false;
  let musicEnabled = true;
  let pendingTrack = null;
  let session = null;
  let disposed = false;
  let sfxRate = 1;
  let resumePromise = null;

  function scaleNote(scale, degree, rootMidi) {
    const length = scale.length;
    const octave = Math.floor(degree / length);
    const index = ((degree % length) + length) % length;
    return mtof(rootMidi + scale[index] + octave * 12);
  }

  function buildNoiseBuffer() {
    if (!ctx) return;
    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      noiseBuffer = buffer;
    } catch (error) {
      noiseBuffer = null;
    }
  }

  function ensureContext() {
    if (disposed) return null;
    if (ctx) return ctx;

    const AudioCtor = typeof window !== 'undefined'
      ? (window.AudioContext || window.webkitAudioContext)
      : null;
    if (!AudioCtor) return null;

    let created = null;
    try {
      created = new AudioCtor({ latencyHint: 'interactive' });
    } catch (error) {
      try {
        created = new AudioCtor();
      } catch (error2) {
        return null;
      }
    }

    ctx = created;
    try {
      master = ctx.createGain();
      master.gain.value = muted ? 0.0001 : MASTER_VOLUME;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      master.connect(compressor);
      compressor.connect(ctx.destination);

      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);

      musicBus = ctx.createGain();
      musicBus.gain.value = musicEnabled ? MUSIC_VOLUME : 0.0001;
      musicBus.connect(master);

      buildNoiseBuffer();
    } catch (error) {
      try {
        if (ctx.close) ctx.close();
      } catch (error2) {
        // Ignore a failed close on a context that never finished initialising.
      }
      ctx = null;
      master = null;
      sfxBus = null;
      musicBus = null;
      noiseBuffer = null;
      return null;
    }

    return ctx;
  }

  function onRunning() {
    if (disposed || !ctx || ctx.state !== 'running') return;
    if (musicEnabled && pendingTrack && !session) beginTrack(pendingTrack);
  }

  function resumeContext() {
    if (!ctx || disposed) return;
    if (ctx.state === 'running') {
      onRunning();
      return;
    }
    if (ctx.state !== 'suspended' || !ctx.resume) return;
    if (resumePromise) return;

    try {
      const promise = ctx.resume();
      if (promise && typeof promise.then === 'function') {
        resumePromise = promise;
        promise.then(() => {
          resumePromise = null;
          onRunning();
        }).catch(() => {
          resumePromise = null;
        });
      } else {
        resumePromise = null;
        onRunning();
      }
    } catch (error) {
      resumePromise = null;
    }
  }

  function holdParam(param, time) {
    try {
      if (param.cancelAndHoldAtTime) {
        param.cancelAndHoldAtTime(time);
      } else {
        param.cancelScheduledValues(time);
      }
    } catch (error) {
      try {
        param.cancelScheduledValues(time);
      } catch (error2) {
        // Nothing more we can do for this parameter.
      }
    }
  }

  // ---------------------------------------------------------------------------
  // One-shot SFX synthesis helpers
  // ---------------------------------------------------------------------------

  function sTone(out, time, frequency, duration, type, gain, options) {
    if (!ctx || !out) return null;
    const opts = options || {};
    const rate = sfxRate;
    const freq = Math.max(20, frequency * rate);
    const dur = Math.max(0.02, duration / rate);
    const attack = Math.max(0.001, (opts.attack == null ? 0.004 : opts.attack) / rate);
    const end = time + Math.max(attack + 0.01, dur);

    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, time);
    if (opts.to != null) {
      const glide = opts.glide != null ? opts.glide / rate : dur;
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, opts.to * rate),
        time + clamp(glide, 0.01, dur),
      );
    }
    if (opts.detune) osc.detune.value = opts.detune;

    const envelope = ctx.createGain();
    const peak = Math.max(0.0002, gain == null ? 0.2 : gain);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(peak, time + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    let node = osc;
    if (opts.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = opts.filter;
      filter.frequency.setValueAtTime(Math.max(30, (opts.cutoff || 1200) * rate), time);
      if (opts.cutoffTo != null) {
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(30, opts.cutoffTo * rate),
          time + dur,
        );
      }
      filter.Q.value = opts.q == null ? 1 : opts.q;
      node.connect(filter);
      node = filter;
    }

    node.connect(envelope);
    envelope.connect(out);
    osc.start(time);
    osc.stop(end + 0.05);
    return osc;
  }

  function sNoise(out, time, duration, options) {
    if (!ctx || !noiseBuffer || !out) return null;
    const opts = options || {};
    const rate = sfxRate;
    const dur = Math.max(0.02, duration / rate);
    const attack = Math.max(0.001, (opts.attack == null ? 0.003 : opts.attack) / rate);
    const end = time + Math.max(attack + 0.01, dur);

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    source.playbackRate.value = clamp((opts.rate || 1) * rate, 0.25, 4);

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter || 'bandpass';
    filter.frequency.setValueAtTime(Math.max(30, (opts.freq || 1000) * rate), time);
    if (opts.to != null) {
      const sweep = clamp(opts.sweep == null ? 1 : opts.sweep, 0.05, 1);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(30, opts.to * rate),
        time + Math.max(0.02, dur * sweep),
      );
    }
    filter.Q.value = opts.q == null ? 1 : opts.q;

    const envelope = ctx.createGain();
    const peak = Math.max(0.0002, opts.gain == null ? 0.2 : opts.gain);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(peak, time + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(out);
    source.start(time, Math.random() * 0.9);
    source.stop(end + 0.02);
    return source;
  }

  function sBell(out, time, frequency, duration, gain) {
    if (!ctx || !out) return;
    const rate = sfxRate;
    const freq = Math.max(20, frequency * rate);
    const dur = Math.max(0.1, duration / rate);
    const peak = Math.max(0.0002, gain == null ? 0.25 : gain);

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, time);

    const modulator = ctx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(freq * 2.76, time);

    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(freq * 1.2, time);
    modGain.gain.exponentialRampToValueAtTime(Math.max(0.001, freq * 0.03), time + dur * 0.85);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(peak, time + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    carrier.connect(envelope);
    envelope.connect(out);

    modulator.start(time);
    carrier.start(time);
    modulator.stop(time + dur + 0.05);
    carrier.stop(time + dur + 0.05);

    sTone(out, time, frequency * 2.01, duration * 0.65, 'sine', peak * 0.28, { attack: 0.004 });
  }

  function mooSound(time, out, pitch) {
    const p = pitch || 1;
    sTone(out, time, 140 * p, 0.85, 'sawtooth', 0.16, {
      to: 95 * p, glide: 0.7, filter: 'lowpass', cutoff: 620, cutoffTo: 300, attack: 0.08,
    });
    sTone(out, time + 0.02, 70 * p, 0.85, 'triangle', 0.12, { to: 55 * p, attack: 0.08 });
    sTone(out, time, 280 * p, 0.6, 'sine', 0.04, { to: 210 * p, attack: 0.1 });
    sNoise(out, time + 0.1, 0.5, { filter: 'bandpass', freq: 500 * p, q: 2, gain: 0.04, attack: 0.15 });
  }

  const SFX = {
    punch(time, out) {
      sNoise(out, time, 0.075, { filter: 'highpass', freq: 850, gain: 0.34, attack: 0.001 });
      sTone(out, time, 155, 0.17, 'sine', 0.55, { to: 48, attack: 0.002 });
      sTone(out, time, 92, 0.12, 'triangle', 0.28, { to: 40 });
    },

    kick(time, out) {
      sNoise(out, time, 0.05, { filter: 'highpass', freq: 1400, gain: 0.25, attack: 0.001 });
      sTone(out, time, 120, 0.32, 'sine', 0.75, { to: 38, glide: 0.26, attack: 0.002 });
      sTone(out, time, 70, 0.2, 'triangle', 0.3, { to: 30 });
    },

    block(time, out) {
      sNoise(out, time, 0.07, { filter: 'bandpass', freq: 2200, q: 1.5, gain: 0.25, attack: 0.001 });
      sTone(out, time, 620, 0.12, 'square', 0.1, {
        to: 520, filter: 'bandpass', cutoff: 1600, q: 3,
      });
      sTone(out, time, 410, 0.16, 'triangle', 0.18, { to: 380 });
      sTone(out, time + 0.02, 840, 0.09, 'sine', 0.08);
    },

    hit(time, out) {
      sNoise(out, time, 0.1, { filter: 'bandpass', freq: 700, to: 180, q: 1.2, gain: 0.4 });
      sTone(out, time, 180, 0.22, 'sine', 0.5, { to: 55 });
      sTone(out, time, 300, 0.09, 'square', 0.08, { to: 120 });
    },

    heavy(time, out) {
      sNoise(out, time, 0.22, {
        filter: 'lowpass', freq: 900, to: 150, q: 0.8, gain: 0.55, attack: 0.002,
      });
      sTone(out, time, 95, 0.5, 'sine', 0.85, { to: 28, glide: 0.42, attack: 0.003 });
      sTone(out, time, 55, 0.35, 'sawtooth', 0.2, { to: 24, filter: 'lowpass', cutoff: 220 });
      sTone(out, time + 0.01, 220, 0.12, 'triangle', 0.2, { to: 70 });
    },

    whoosh(time, out) {
      sNoise(out, time, 0.24, {
        filter: 'bandpass', freq: 350, to: 2400, q: 1.6, gain: 0.3, attack: 0.06, sweep: 0.55,
      });
      sNoise(out, time + 0.1, 0.18, {
        filter: 'bandpass', freq: 2400, to: 500, q: 2, gain: 0.2, attack: 0.02,
      });
    },

    jump(time, out) {
      sTone(out, time, 220, 0.18, 'sine', 0.28, { to: 560, glide: 0.16, attack: 0.004 });
      sNoise(out, time, 0.1, {
        filter: 'highpass', freq: 1000, to: 3000, gain: 0.1, attack: 0.02,
      });
    },

    land(time, out) {
      sTone(out, time, 125, 0.22, 'sine', 0.5, { to: 42, glide: 0.18 });
      sNoise(out, time, 0.16, { filter: 'lowpass', freq: 700, to: 200, gain: 0.3 });
      sTone(out, time, 70, 0.16, 'triangle', 0.2, { to: 35 });
    },

    grab(time, out) {
      sNoise(out, time, 0.1, { filter: 'bandpass', freq: 420, q: 0.9, gain: 0.25 });
      sTone(out, time, 110, 0.15, 'sine', 0.4, { to: 55 });
    },

    grabBreak(time, out) {
      sNoise(out, time, 0.1, { filter: 'highpass', freq: 1800, gain: 0.4 });
      sTone(out, time, 520, 0.14, 'square', 0.14, { to: 160 });
      sTone(out, time + 0.03, 180, 0.18, 'triangle', 0.3, { to: 60 });
      sNoise(out, time + 0.05, 0.08, { filter: 'bandpass', freq: 3000, q: 2, gain: 0.2 });
    },

    ko(time, out) {
      sNoise(out, time, 0.35, {
        filter: 'lowpass', freq: 1200, to: 120, gain: 0.6, attack: 0.002,
      });
      sTone(out, time, 110, 0.9, 'sine', 0.9, { to: 26, glide: 0.8 });
      sTone(out, time, 320, 0.7, 'sawtooth', 0.16, {
        to: 50, filter: 'lowpass', cutoff: 900, cutoffTo: 100,
      });
      sTone(out, time + 0.12, 70, 0.7, 'triangle', 0.35, { to: 28 });
      sNoise(out, time + 0.1, 0.8, {
        filter: 'bandpass', freq: 900, to: 300, q: 0.6, gain: 0.15, attack: 0.2,
      });
    },

    bell(time, out) {
      sBell(out, time, 880, 1.4, 0.32);
      sBell(out, time + 0.02, 1320, 1.0, 0.12);
    },

    fight(time, out) {
      [392, 523, 659].forEach((freq, index) => {
        sTone(out, time + index * 0.1, freq, 0.22, 'sawtooth', 0.18, {
          filter: 'lowpass', cutoff: 2200, attack: 0.01,
        });
      });
      sNoise(out, time, 0.12, { filter: 'highpass', freq: 1200, gain: 0.18 });
      sTone(out, time + 0.32, 784, 0.35, 'sawtooth', 0.22, {
        filter: 'lowpass', cutoff: 2600, attack: 0.01,
      });
    },

    round(time, out) {
      sBell(out, time, 440, 1.2, 0.35);
      sBell(out, time + 0.3, 440, 1.0, 0.22);
      sNoise(out, time, 0.08, { filter: 'highpass', freq: 2000, gain: 0.1 });
    },

    'super'(time, out) {
      sTone(out, time, 110, 0.9, 'sawtooth', 0.18, {
        to: 880, glide: 0.85, filter: 'lowpass', cutoff: 500, cutoffTo: 4000, attack: 0.05,
      });
      sTone(out, time, 165, 0.9, 'square', 0.08, {
        to: 1320, glide: 0.85, filter: 'lowpass', cutoff: 800, cutoffTo: 5000, attack: 0.05,
      });
      sNoise(out, time, 0.9, {
        filter: 'bandpass', freq: 300, to: 5000, q: 1.2, gain: 0.22, attack: 0.3, sweep: 0.9,
      });
      sTone(out, time + 0.9, 90, 0.6, 'sine', 0.8, { to: 30, attack: 0.002 });
      sNoise(out, time + 0.9, 0.3, {
        filter: 'lowpass', freq: 1500, to: 200, gain: 0.4,
      });
    },

    charge(time, out) {
      sTone(out, time, 80, 0.8, 'sawtooth', 0.15, {
        to: 640, glide: 0.75, filter: 'lowpass', cutoff: 400, cutoffTo: 3200, attack: 0.08,
      });
      sNoise(out, time, 0.8, {
        filter: 'bandpass', freq: 400, to: 3000, q: 2, gain: 0.12, attack: 0.3,
      });
      sTone(out, time, 240, 0.7, 'sine', 0.1, { to: 480, attack: 0.1 });
    },

    chakra(time, out) {
      sNoise(out, time, 0.42, {
        filter: 'bandpass', freq: 500, to: 4500, q: 1.8, gain: 0.28, attack: 0.04, sweep: 0.6,
      });
      sNoise(out, time + 0.12, 0.3, {
        filter: 'bandpass', freq: 4000, to: 700, q: 2.5, gain: 0.16, attack: 0.02,
      });
      [1240, 1860, 2480].forEach((freq, index) => {
        sTone(out, time + 0.05 + index * 0.015, freq, 0.35, 'sine', 0.07, { to: freq * 0.92 });
      });
      sTone(out, time, 180, 0.3, 'square', 0.06, {
        to: 420, filter: 'bandpass', cutoff: 1800, q: 4,
      });
    },

    boom(time, out) {
      sNoise(out, time, 0.7, {
        filter: 'lowpass', freq: 1000, to: 80, gain: 0.7, attack: 0.003,
      });
      sTone(out, time, 75, 0.8, 'sine', 0.9, { to: 24, glide: 0.7 });
      sTone(out, time, 45, 0.6, 'sawtooth', 0.25, { to: 20, filter: 'lowpass', cutoff: 180 });
      sNoise(out, time + 0.05, 0.5, {
        filter: 'bandpass', freq: 600, to: 150, q: 0.7, gain: 0.2,
      });
    },

    stamp(time, out) {
      sNoise(out, time, 0.05, { filter: 'highpass', freq: 2500, gain: 0.3, attack: 0.001 });
      sTone(out, time, 110, 0.2, 'sine', 0.55, { to: 45 });
      sNoise(out, time, 0.12, { filter: 'bandpass', freq: 1500, q: 0.8, gain: 0.22 });
      sTone(out, time + 0.01, 180, 0.08, 'square', 0.08, { to: 90 });
    },

    bulldozer(time, out) {
      const dur = 0.9 / sfxRate;
      const engine = ctx.createGain();
      engine.gain.setValueAtTime(0.0001, time);
      engine.gain.exponentialRampToValueAtTime(0.26, time + 0.08);
      engine.gain.setValueAtTime(0.26, time + dur * 0.75);
      engine.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 380;
      lowpass.Q.value = 1.8;
      engine.connect(lowpass);
      lowpass.connect(out);

      [52, 54.5, 78].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq * sfxRate;
        const gain = ctx.createGain();
        gain.gain.value = index === 2 ? 0.22 : 0.5;
        osc.connect(gain);
        gain.connect(engine);
        osc.start(time);
        osc.stop(time + dur + 0.03);
      });

      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 9 * sfxRate;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.07;
      lfo.connect(lfoGain);
      lfoGain.connect(engine.gain);
      lfo.start(time);
      lfo.stop(time + dur + 0.03);

      sNoise(out, time, dur * 0.9, {
        filter: 'lowpass', freq: 480, to: 160, gain: 0.11, attack: 0.1,
      });
      sTone(out, time + 0.08, 220, 0.28, 'square', 0.05, {
        to: 196, filter: 'lowpass', cutoff: 900,
      });
    },

    poof(time, out) {
      sNoise(out, time, 0.18, { filter: 'lowpass', freq: 1200, to: 300, gain: 0.25 });
      sTone(out, time, 280, 0.12, 'sine', 0.22, { to: 760 });
      sTone(out, time + 0.05, 600, 0.12, 'sine', 0.12, { to: 220 });
    },

    coins(time, out) {
      for (let i = 0; i < 6; i += 1) {
        const at = time + i * 0.045;
        sTone(out, at, 1500 + i * 180, 0.12, 'sine', 0.1, { to: 1800 + i * 200 });
        sTone(out, at, 2400 + i * 120, 0.08, 'triangle', 0.05);
      }
    },

    kaching(time, out) {
      sBell(out, time, 1760, 0.5, 0.22);
      sBell(out, time + 0.09, 2340, 0.45, 0.16);
      sNoise(out, time, 0.12, { filter: 'highpass', freq: 3000, gain: 0.16 });
      sTone(out, time + 0.02, 300, 0.1, 'square', 0.08, { to: 180 });
      sTone(out, time + 0.18, 120, 0.15, 'sine', 0.2, { to: 60 });
    },

    crowd(time, out) {
      sNoise(out, time, 1.6, {
        filter: 'bandpass', freq: 700, q: 0.6, gain: 0.18, attack: 0.35,
      });
      sNoise(out, time + 0.1, 1.4, {
        filter: 'bandpass', freq: 1200, q: 0.9, gain: 0.12, attack: 0.3,
      });
      sNoise(out, time + 0.2, 1.2, {
        filter: 'bandpass', freq: 2200, q: 1.2, gain: 0.06, attack: 0.25,
      });
    },

    crowdCheer(time, out) {
      sNoise(out, time, 2.2, {
        filter: 'bandpass', freq: 900, q: 0.5, gain: 0.22, attack: 0.25,
      });
      for (let i = 0; i < 10; i += 1) {
        const at = time + 0.1 + Math.random() * 1.6;
        sNoise(out, at, 0.15, {
          filter: 'bandpass', freq: 900 + Math.random() * 1800, q: 3, gain: 0.05, attack: 0.01,
        });
      }
      sTone(out, time + 0.1, 600, 1.8, 'sawtooth', 0.03, {
        to: 900, filter: 'bandpass', cutoff: 1200, q: 2, attack: 0.3,
      });
    },

    chai(time, out) {
      sNoise(out, time, 0.7, {
        filter: 'bandpass', freq: 1800, to: 2600, q: 1.2, gain: 0.12, attack: 0.1,
      });
      for (let i = 0; i < 5; i += 1) {
        const at = time + 0.08 + i * 0.11;
        sTone(out, at, 300 + Math.random() * 250, 0.08, 'sine', 0.06, {
          to: 180 + Math.random() * 120,
        });
      }
      sTone(out, time + 0.02, 220, 0.5, 'triangle', 0.03, { to: 260 });
    },

    cupBreak(time, out) {
      sNoise(out, time, 0.12, { filter: 'highpass', freq: 2500, gain: 0.4, attack: 0.001 });
      sNoise(out, time + 0.04, 0.18, {
        filter: 'highpass', freq: 1800, gain: 0.28, attack: 0.001,
      });
      [1800, 2400, 3100, 4200].forEach((freq, index) => {
        sTone(out, time + 0.02 + index * 0.02, freq, 0.16, 'triangle', 0.06, { to: freq * 0.9 });
      });
      sTone(out, time, 180, 0.12, 'sine', 0.2, { to: 60 });
    },

    cow(time, out) {
      mooSound(time, out, 1);
    },

    moo(time, out) {
      mooSound(time, out, 0.85);
    },

    camera(time, out) {
      sNoise(out, time, 0.04, { filter: 'highpass', freq: 3000, gain: 0.35, attack: 0.001 });
      sNoise(out, time + 0.07, 0.05, {
        filter: 'highpass', freq: 2200, gain: 0.25, attack: 0.001,
      });
      sTone(out, time, 1800, 0.06, 'square', 0.06, { to: 1200 });
      sTone(out, time + 0.02, 320, 0.08, 'triangle', 0.08, { to: 180 });
    },

    news(time, out) {
      [523, 659, 784].forEach((freq, index) => {
        sTone(out, time + index * 0.12, freq, 0.18, 'sawtooth', 0.14, {
          filter: 'lowpass', cutoff: 2200, attack: 0.008,
        });
      });
      sTone(out, time + 0.36, 1046, 0.4, 'sawtooth', 0.16, {
        filter: 'lowpass', cutoff: 2600, attack: 0.01,
      });
      sNoise(out, time, 0.08, { filter: 'highpass', freq: 1800, gain: 0.08 });
    },

    drumroll(time, out) {
      let at = time;
      for (let i = 0; i < 20; i += 1) {
        sNoise(out, at, 0.04, {
          filter: 'bandpass', freq: 1800, q: 0.8, gain: 0.08 + i * 0.004, attack: 0.001,
        });
        sTone(out, at, 180, 0.04, 'triangle', 0.05, { to: 150 });
        at += Math.max(0.022, 0.055 - i * 0.0015);
      }
      sNoise(out, at, 0.12, { filter: 'bandpass', freq: 1400, gain: 0.3 });
      sTone(out, at, 150, 0.15, 'sine', 0.3, { to: 70 });
    },

    win(time, out) {
      [523, 659, 784, 1046, 1318].forEach((freq, index) => {
        sTone(out, time + index * 0.14, freq, 0.3, 'sawtooth', 0.16, {
          filter: 'lowpass', cutoff: 2600, attack: 0.01,
        });
      });
      sBell(out, time + 0.7, 1046, 1.0, 0.2);
      sTone(out, time + 0.7, 1568, 0.7, 'sine', 0.12, { attack: 0.01 });
      sNoise(out, time, 0.08, { filter: 'highpass', freq: 2000, gain: 0.08 });
    },

    lose(time, out) {
      [392, 349, 311, 262].forEach((freq, index) => {
        sTone(out, time + index * 0.22, freq, 0.45, 'sawtooth', 0.13, {
          filter: 'lowpass', cutoff: 1200, attack: 0.02,
        });
      });
      sTone(out, time + 0.9, 196, 0.8, 'triangle', 0.15, { to: 130 });
      sNoise(out, time + 0.9, 0.4, { filter: 'lowpass', freq: 400, gain: 0.1 });
    },

    perfect(time, out) {
      [1046, 1318, 1568, 2093, 1568, 2093].forEach((freq, index) => {
        sBell(out, time + index * 0.09, freq, 0.5, 0.09);
      });
      sNoise(out, time, 0.5, { filter: 'highpass', freq: 5000, gain: 0.05, attack: 0.1 });
      sTone(out, time, 523, 0.5, 'triangle', 0.08, { to: 1046 });
    },

    select(time, out) {
      sTone(out, time, 660, 0.07, 'square', 0.08, { to: 990 });
    },

    move(time, out) {
      sTone(out, time, 880, 0.04, 'sine', 0.05, { to: 980 });
    },

    confirm(time, out) {
      sTone(out, time, 660, 0.09, 'square', 0.08);
      sTone(out, time + 0.07, 990, 0.12, 'square', 0.08);
    },

    back(time, out) {
      sTone(out, time, 500, 0.1, 'square', 0.07, { to: 300 });
    },

    tick(time, out) {
      sNoise(out, time, 0.02, { filter: 'highpass', freq: 4000, gain: 0.1 });
      sTone(out, time, 1600, 0.03, 'square', 0.05, { to: 1400 });
    },

    timeup(time, out) {
      [0, 0.28, 0.56].forEach((offset) => {
        sBell(out, time + offset, 880, 0.5, 0.24);
      });
      sTone(out, time + 0.9, 440, 0.6, 'sawtooth', 0.08, {
        to: 220, filter: 'lowpass', cutoff: 1000,
      });
    },

    click(time, out) {
      sNoise(out, time, 0.03, { filter: 'highpass', freq: 2500, gain: 0.12, attack: 0.001 });
      sTone(out, time, 900, 0.04, 'sine', 0.06, { to: 700 });
    },
  };

  // ---------------------------------------------------------------------------
  // Music synthesis helpers
  // ---------------------------------------------------------------------------

  function mTone(dest, time, frequency, duration, options) {
    if (!ctx || !dest) return;
    const opts = options || {};
    const freq = Math.max(20, frequency);
    const dur = Math.max(0.03, duration);
    const attack = Math.max(0.003, opts.attack == null ? 0.01 : opts.attack);
    const end = time + Math.max(attack + 0.02, dur);

    const osc = ctx.createOscillator();
    osc.type = opts.type || 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    if (opts.to != null) {
      const glide = opts.glide == null ? dur : opts.glide;
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, opts.to),
        time + clamp(glide, 0.02, dur),
      );
    }
    if (opts.detune) osc.detune.value = opts.detune;

    if (opts.vibrato) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(opts.vibratoRate || 5.2, time);
      lfoGain.gain.setValueAtTime(0, time);
      lfoGain.gain.linearRampToValueAtTime(opts.vibrato, time + Math.min(0.4, dur * 0.5));
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      lfo.start(time);
      lfo.stop(end + 0.05);
    }

    let node = osc;
    if (opts.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = opts.filter;
      filter.frequency.setValueAtTime(Math.max(30, opts.cutoff || 1200), time);
      if (opts.cutoffTo != null) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(30, opts.cutoffTo), time + dur);
      }
      filter.Q.value = opts.q == null ? 1 : opts.q;
      node.connect(filter);
      node = filter;
    }

    const envelope = ctx.createGain();
    const peak = Math.max(0.0002, opts.gain == null ? 0.06 : opts.gain);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(peak, time + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    node.connect(envelope);
    let output = envelope;
    if (opts.pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(clamp(opts.pan, -1, 1), time);
      envelope.connect(panner);
      output = panner;
    }
    output.connect(dest);

    osc.start(time);
    osc.stop(end + 0.05);
  }

  function mNoise(dest, time, duration, options) {
    if (!ctx || !noiseBuffer || !dest) return;
    const opts = options || {};
    const dur = Math.max(0.02, duration);
    const attack = Math.max(0.001, opts.attack == null ? 0.003 : opts.attack);
    const end = time + Math.max(attack + 0.01, dur);

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    source.playbackRate.value = clamp(opts.rate || 1, 0.25, 4);

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter || 'bandpass';
    filter.frequency.setValueAtTime(Math.max(30, opts.freq || 1200), time);
    if (opts.to != null) {
      const sweep = clamp(opts.sweep == null ? 1 : opts.sweep, 0.05, 1);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(30, opts.to),
        time + Math.max(0.02, dur * sweep),
      );
    }
    filter.Q.value = opts.q == null ? 1 : opts.q;

    const envelope = ctx.createGain();
    const peak = Math.max(0.0002, opts.gain == null ? 0.05 : opts.gain);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(peak, time + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);

    source.connect(filter);
    filter.connect(envelope);
    let output = envelope;
    if (opts.pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(clamp(opts.pan, -1, 1), time);
      envelope.connect(panner);
      output = panner;
    }
    output.connect(dest);

    source.start(time, Math.random() * 0.9);
    source.stop(end + 0.02);
  }

  function mDrum(dest, time, options) {
    const opts = options || {};
    const freq = opts.freq || 90;
    const dur = opts.dur || 0.18;
    const gain = opts.gain == null ? 0.18 : opts.gain;
    const pan = opts.pan || 0;

    mTone(dest, time, freq, dur, {
      type: 'sine',
      gain,
      to: opts.to == null ? freq * 0.55 : opts.to,
      glide: dur * 0.8,
      attack: 0.002,
      pan,
    });
    mNoise(dest, time, Math.min(0.08, dur * 0.5), {
      filter: 'lowpass',
      freq: opts.noiseFreq || 700,
      gain: gain * 0.4,
      attack: 0.001,
      pan,
    });
  }

  // ---------------------------------------------------------------------------
  // Procedural tracks
  // ---------------------------------------------------------------------------

  const TRACKS = {
    sansad: {
      bpm: 98,
      length: 64,
      step(step, time, current, stepDur) {
        const dest = current.gain;
        const s16 = step % 16;

        if (s16 === 0 || s16 === 8) {
          mDrum(dest, time, {
            freq: 86, to: 44, gain: 0.24, dur: 0.24, noiseFreq: 500, pan: -0.1,
          });
        }
        if (s16 === 6 || s16 === 14) {
          mDrum(dest, time, {
            freq: 102, to: 56, gain: 0.15, dur: 0.16, noiseFreq: 700, pan: -0.16,
          });
        }
        if (s16 === 3 || s16 === 11) {
          mDrum(dest, time, {
            freq: 250, to: 170, gain: 0.075, dur: 0.08, noiseFreq: 2600, pan: 0.22,
          });
        }
        if (s16 === 10 || s16 === 15) {
          mTone(dest, time, 640, 0.05, {
            type: 'square', gain: 0.022, filter: 'highpass', cutoff: 1800, pan: 0.3,
          });
        }
        if (step % 2 === 1) {
          mNoise(dest, time, 0.03, {
            filter: 'highpass', freq: 6000, gain: 0.016, pan: 0.28,
          });
        }

        if (s16 === 0) {
          mTone(dest, time, mtof(38), stepDur * 2.6, {
            type: 'sawtooth', gain: 0.085, filter: 'lowpass', cutoff: 320, attack: 0.01,
          });
        }
        if (s16 === 4) {
          mTone(dest, time, mtof(38), stepDur * 1.5, {
            type: 'sawtooth', gain: 0.065, filter: 'lowpass', cutoff: 300,
          });
        }
        if (s16 === 8) {
          mTone(dest, time, mtof(45), stepDur * 2.2, {
            type: 'sawtooth', gain: 0.08, filter: 'lowpass', cutoff: 340,
          });
        }
        if (s16 === 12) {
          mTone(dest, time, mtof(41), stepDur * 1.7, {
            type: 'sawtooth', gain: 0.065, filter: 'lowpass', cutoff: 300,
          });
        }

        if (step === 0 || step === 32) {
          [0, 4, 7].forEach((degree, index) => {
            mTone(dest, time, scaleNote(SCALE_BHAIRAV, degree, 50), stepDur * 3, {
              type: 'sawtooth',
              gain: 0.026,
              filter: 'lowpass',
              cutoff: 1000,
              attack: 0.06,
              pan: (index - 1) * 0.22,
            });
          });
        }

        if (step % 2 === 0) {
          const degree = SANSAD_LEAD[(step / 2) % SANSAD_LEAD.length];
          if (degree != null) {
            mTone(dest, time, scaleNote(SCALE_BHAIRAV, degree, 62), stepDur * 1.75, {
              type: 'sawtooth',
              gain: 0.05,
              filter: 'lowpass',
              cutoff: 1600,
              cutoffTo: 900,
              q: 2,
              attack: 0.025,
              vibrato: 4,
              vibratoRate: 5.4,
              pan: 0.12,
            });
            mTone(dest, time, scaleNote(SCALE_BHAIRAV, degree + 7, 62), stepDur * 1.15, {
              type: 'triangle',
              gain: 0.014,
              attack: 0.02,
              pan: -0.12,
            });
          }
        }
      },
    },

    jantar: {
      bpm: 78,
      length: 64,
      step(step, time, current, stepDur) {
        const dest = current.gain;
        const s16 = step % 16;

        if (s16 === 0 || s16 === 8) {
          mTone(dest, time, 96, 0.34, {
            type: 'sine', gain: 0.14, to: 68, glide: 0.28, attack: 0.002, pan: -0.08,
          });
          mNoise(dest, time, 0.06, {
            filter: 'lowpass', freq: 600, gain: 0.05, attack: 0.001, pan: -0.08,
          });
        }
        if (s16 === 3 || s16 === 11) {
          mTone(dest, time, 520, 0.22, {
            type: 'triangle', gain: 0.055, to: 500, attack: 0.003, pan: 0.2,
          });
          mTone(dest, time, 1040, 0.12, {
            type: 'sine', gain: 0.018, attack: 0.002, pan: 0.2,
          });
        }
        if (s16 === 4 || s16 === 12) {
          mTone(dest, time, 300, 0.1, {
            type: 'triangle', gain: 0.04, to: 250, attack: 0.002, pan: 0.12,
          });
        }
        if (s16 === 6 || s16 === 14) {
          mTone(dest, time, 100, 0.2, {
            type: 'sine', gain: 0.1, to: 76, attack: 0.002, pan: -0.1,
          });
        }
        if (s16 === 2 || s16 === 6 || s16 === 10 || s16 === 14) {
          mNoise(dest, time, 0.04, {
            filter: 'highpass', freq: 5200, gain: 0.012, pan: 0.3,
          });
        }

        if (s16 === 0) {
          mTone(dest, time, mtof(43), stepDur * 3.2, {
            type: 'sawtooth', gain: 0.06, filter: 'lowpass', cutoff: 260, attack: 0.03,
          });
        }
        if (s16 === 8) {
          mTone(dest, time, mtof(50), stepDur * 2.6, {
            type: 'sawtooth', gain: 0.055, filter: 'lowpass', cutoff: 280,
          });
        }
        if (s16 === 12) {
          mTone(dest, time, mtof(53), stepDur * 2, {
            type: 'sawtooth', gain: 0.045, filter: 'lowpass', cutoff: 260,
          });
        }

        if (step % 4 === 0) {
          const degree = JANTAR_LEAD[(step / 4) % JANTAR_LEAD.length];
          if (degree != null) {
            mTone(dest, time, scaleNote(SCALE_BHAIRAVI, degree, 67), stepDur * 3.4, {
              type: 'triangle',
              gain: 0.055,
              filter: 'lowpass',
              cutoff: 2600,
              attack: 0.08,
              vibrato: 12,
              vibratoRate: 5.6,
              pan: -0.15,
            });
            mTone(dest, time, scaleNote(SCALE_BHAIRAVI, degree + 7, 67), stepDur * 2.4, {
              type: 'sine', gain: 0.012, attack: 0.08, pan: 0.15,
            });
          }
        }
      },
    },

    road: {
      bpm: 124,
      length: 64,
      step(step, time, current, stepDur) {
        const dest = current.gain;
        const s16 = step % 16;

        if (s16 === 0 || s16 === 8) {
          mDrum(dest, time, {
            freq: 94, to: 48, gain: 0.22, dur: 0.17, noiseFreq: 800, pan: -0.12,
          });
        }
        if (s16 === 4 || s16 === 12) {
          mDrum(dest, time, {
            freq: 84, to: 44, gain: 0.18, dur: 0.15, noiseFreq: 700, pan: -0.16,
          });
          for (let i = 0; i < 3; i += 1) {
            mNoise(dest, time + i * 0.012, 0.05, {
              filter: 'bandpass', freq: 1600, q: 0.8, gain: 0.05, attack: 0.001, pan: 0.18,
            });
          }
        }
        if (s16 === 2 || s16 === 6 || s16 === 10 || s16 === 14) {
          mDrum(dest, time, {
            freq: 280, to: 190, gain: 0.065, dur: 0.07, noiseFreq: 3200, pan: 0.2,
          });
        }
        if (step % 2 === 0) {
          mNoise(dest, time, 0.025, {
            filter: 'highpass', freq: 7000, gain: 0.014, pan: 0.3,
          });
        }
        if (s16 === 15) {
          mNoise(dest, time, 0.12, {
            filter: 'highpass', freq: 5000, gain: 0.02, attack: 0.01, pan: 0.25,
          });
        }

        if (step % 2 === 0) {
          const bass = ROAD_BASS[(step / 2) % ROAD_BASS.length];
          mTone(dest, time, mtof(bass), stepDur * 1.45, {
            type: 'sawtooth',
            gain: 0.07,
            filter: 'lowpass',
            cutoff: 460,
            cutoffTo: 260,
            attack: 0.006,
          });
        }

        if (step % 2 === 0) {
          const degree = ROAD_HOOK[(step / 2) % ROAD_HOOK.length];
          if (degree != null) {
            mTone(dest, time, scaleNote(SCALE_DESI, degree, 69), stepDur * 1.5, {
              type: 'square',
              gain: 0.038,
              filter: 'lowpass',
              cutoff: 2000,
              cutoffTo: 1300,
              q: 1.5,
              attack: 0.008,
              pan: 0.14,
            });
            mTone(dest, time, scaleNote(SCALE_DESI, degree + 7, 69), stepDur * 1.2, {
              type: 'sawtooth',
              gain: 0.016,
              filter: 'lowpass',
              cutoff: 2600,
              attack: 0.01,
              pan: -0.14,
            });
          }
        }
      },
    },
  };

  const DRONES = {
    sansad: {
      freqs: [mtof(38), mtof(45), mtof(50)],
      type: 'sawtooth',
      gain: 0.035,
      cutoff: 420,
      q: 0.8,
      detune: 5,
    },
    jantar: {
      freqs: [mtof(43), mtof(50), mtof(55)],
      type: 'sawtooth',
      gain: 0.028,
      cutoff: 760,
      q: 0.6,
      detune: 7,
    },
    road: {
      freqs: [mtof(33), mtof(40)],
      type: 'sawtooth',
      gain: 0.024,
      cutoff: 300,
      q: 0.9,
      detune: 3,
    },
  };

  function startDrone(trackId, dest, time) {
    if (!ctx || !dest) return null;
    const config = Object.prototype.hasOwnProperty.call(DRONES, trackId)
      ? DRONES[trackId]
      : DRONES.sansad;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(config.gain, time + 0.5);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = config.cutoff;
    filter.Q.value = config.q;
    gain.connect(filter);
    filter.connect(dest);

    const oscs = [];
    for (let i = 0; i < config.freqs.length; i += 1) {
      const osc = ctx.createOscillator();
      osc.type = config.type;
      osc.frequency.value = config.freqs[i];
      osc.detune.value = (i % 2 === 0 ? -1 : 1) * config.detune + (i === 2 ? config.detune * 0.5 : 0);
      const oscGain = ctx.createGain();
      oscGain.gain.value = 1 / config.freqs.length;
      osc.connect(oscGain);
      oscGain.connect(gain);
      osc.start(time);
      oscs.push(osc);
    }

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = config.gain * 0.18;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start(time);
    oscs.push(lfo);

    return { gain, filter, oscs };
  }

  function stopDrone(drone, time) {
    if (!drone) return;
    holdParam(drone.gain.gain, time);
    try {
      drone.gain.gain.setTargetAtTime(0.0001, time, 0.06);
    } catch (error) {
      drone.gain.gain.value = 0.0001;
    }
    drone.oscs.forEach((osc) => {
      try {
        osc.stop(time + 0.45);
      } catch (error) {
        // Oscillator may already have been stopped.
      }
    });
    setTimeout(() => {
      try {
        drone.gain.disconnect();
      } catch (error) {
        // Already disconnected.
      }
      try {
        drone.filter.disconnect();
      } catch (error) {
        // Already disconnected.
      }
    }, 700);
  }

  function stopSession(current, fade) {
    if (!current || current.stopped) return;
    current.stopped = true;
    if (current.timer) {
      clearInterval(current.timer);
      current.timer = null;
    }
    if (!ctx) return;

    const time = ctx.currentTime;
    const fadeSeconds = fade == null ? 0.18 : fade;
    holdParam(current.gain.gain, time);
    try {
      current.gain.gain.setTargetAtTime(0.0001, time, Math.max(0.01, fadeSeconds / 3));
    } catch (error) {
      current.gain.gain.value = 0.0001;
    }
    if (current.drone) stopDrone(current.drone, time);

    setTimeout(() => {
      try {
        current.gain.disconnect();
      } catch (error) {
        // Already disconnected.
      }
    }, (fadeSeconds + 0.8) * 1000);
  }

  function tickSession(current) {
    if (!ctx || disposed || current.stopped || session !== current) return;
    const track = Object.prototype.hasOwnProperty.call(TRACKS, current.id)
      ? TRACKS[current.id]
      : TRACKS.sansad;
    const stepDur = 60 / track.bpm / 4;
    const horizon = ctx.currentTime + SCHEDULE_AHEAD;

    if (current.nextTime < ctx.currentTime - 0.15) {
      current.nextTime = ctx.currentTime + 0.03;
    }

    let guard = 0;
    while (current.nextTime < horizon && guard < 64) {
      const step = current.step % track.length;
      try {
        track.step(step, current.nextTime, current, stepDur);
      } catch (error) {
        // A single bad step must never kill the music scheduler.
      }
      current.nextTime += stepDur;
      current.step += 1;
      guard += 1;
    }
  }

  function beginTrack(trackId) {
    if (!ctx || !musicBus || disposed) return;
    const id = Object.prototype.hasOwnProperty.call(TRACKS, trackId) ? trackId : 'sansad';

    if (session) {
      stopSession(session, 0.08);
      session = null;
    }

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(1, now + 0.18);
    gain.connect(musicBus);

    const current = {
      id,
      gain,
      step: 0,
      nextTime: now + 0.12,
      timer: null,
      stopped: false,
      drone: null,
    };
    current.drone = startDrone(id, gain, now);
    session = current;
    current.timer = setInterval(() => tickSession(current), LOOKAHEAD_MS);
    tickSession(current);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  function unlock() {
    if (disposed) return;
    const context = ensureContext();
    if (!context) return;
    resumeContext();
  }

  function play(name, options) {
    if (disposed || muted) return false;
    const context = ensureContext();
    if (!context) return false;
    if (context.state === 'suspended') resumeContext();
    if (context.state === 'closed') return false;

    const opts = options || {};
    const volumeRaw = opts.volume == null ? 1 : Number(opts.volume);
    const volume = clamp(Number.isFinite(volumeRaw) ? volumeRaw : 1, 0, 3);
    if (volume <= 0) return false;

    const panRaw = Number(opts.pan);
    const pan = clamp(Number.isFinite(panRaw) ? panRaw : 0, -1, 1);
    const rateRaw = Number(opts.rate);
    const rate = clamp(Number.isFinite(rateRaw) ? rateRaw : 1, 0.5, 2);

    const out = context.createGain();
    out.gain.value = volume * 0.9;

    let tail = out;
    if (Math.abs(pan) > 0.001 && context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = pan;
      out.connect(panner);
      tail = panner;
    }
    tail.connect(sfxBus);

    const sound = Object.prototype.hasOwnProperty.call(SFX, name) ? SFX[name] : SFX.click;
    sfxRate = rate;
    try {
      sound(context.currentTime + 0.005, out);
    } catch (error) {
      try {
        out.disconnect();
      } catch (error2) {
        // Already disconnected.
      }
      try {
        tail.disconnect();
      } catch (error2) {
        // Already disconnected.
      }
    } finally {
      sfxRate = 1;
    }
    return true;
  }

  function startMusic(stageId) {
    if (disposed) return;
    pendingTrack = Object.prototype.hasOwnProperty.call(TRACKS, stageId) ? stageId : 'sansad';
    if (!musicEnabled) return;

    if (!ctx) return;
    if (ctx.state === 'running') {
      if (session && session.id === pendingTrack && !session.stopped) return;
      beginTrack(pendingTrack);
      return;
    }

    if (session) {
      stopSession(session, 0.1);
      session = null;
    }
    if (ctx.state === 'suspended') resumeContext();
  }

  function stopMusic() {
    pendingTrack = null;
    if (session) {
      stopSession(session, 0.18);
      session = null;
    }
  }

  function setMuted(value) {
    muted = !!value;
    if (disposed || !ctx || !master) return;
    const time = ctx.currentTime;
    holdParam(master.gain, time);
    try {
      master.gain.setTargetAtTime(muted ? 0.0001 : MASTER_VOLUME, time, 0.03);
    } catch (error) {
      master.gain.value = muted ? 0.0001 : MASTER_VOLUME;
    }
  }

  function isMuted() {
    return muted;
  }

  function setMusicEnabled(enabled) {
    musicEnabled = !!enabled;
    if (disposed) return;

    if (ctx && musicBus) {
      const time = ctx.currentTime;
      holdParam(musicBus.gain, time);
      try {
        musicBus.gain.setTargetAtTime(
          musicEnabled ? MUSIC_VOLUME : 0.0001,
          time,
          0.06,
        );
      } catch (error) {
        musicBus.gain.value = musicEnabled ? MUSIC_VOLUME : 0.0001;
      }
    }

    if (!musicEnabled) {
      if (session) {
        stopSession(session, 0.12);
        session = null;
      }
      return;
    }

    if (pendingTrack && !session) {
      if (!ctx) return;
      if (ctx.state === 'running') {
        beginTrack(pendingTrack);
      } else if (ctx.state === 'suspended') {
        resumeContext();
      }
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    pendingTrack = null;
    if (session) {
      stopSession(session, 0.05);
      session = null;
    }
    const context = ctx;
    ctx = null;
    if (context) {
      try {
        if (context.close) context.close();
      } catch (error) {
        // Context may already be closed or unavailable.
      }
    }
    master = null;
    sfxBus = null;
    musicBus = null;
    noiseBuffer = null;
  }

  return {
    unlock,
    play,
    startMusic,
    stopMusic,
    setMuted,
    isMuted,
    setMusicEnabled,
    dispose,
  };
}
