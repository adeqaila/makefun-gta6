// All sound in Solmar Bay is synthesised live with WebAudio — no audio
// files, no network. Every public method is safe to call before the audio
// context exists (it simply does nothing until ensure() has run from a
// user gesture), and every step is guarded so a browser without WebAudio
// never breaks the game.

export function createAudio() {
  const audio = {
    muted: false,
    ensure,
    engine,
    siren,
    gunshot,
    punch,
    pickup,
    missionDone,
    setMuted,
  };

  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineFilter = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenLfo = null;
  let sirenGain = null;
  let sirenOn = false;
  let noiseBuffer = null;

  /** Build the context and the always-on nodes. Call from a user gesture. */
  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = audio.muted ? 0 : 1;
      master.connect(ctx.destination);

      // Engine drone: one sawtooth through a lowpass, gain driven per frame.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      // A short reusable noise buffer for the gunshot burst.
      const length = Math.floor(ctx.sampleRate * 0.15);
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  /** Continuous engine hum. level 0..1 (speed / top speed); 0 on foot. */
  function engine(level) {
    if (!ctx || !engineOsc || !engineGain) return;
    try {
      const clamped = Math.max(0, Math.min(1, level || 0));
      const now = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(60 + clamped * 140, now, 0.08);
      engineGain.gain.setTargetAtTime(clamped < 0.02 ? 0 : clamped * 0.05, now, 0.08);
    } catch {
      // Audio is decoration; never let it interrupt the frame.
    }
  }

  /** Two-tone police siren. Idempotent: repeated calls with the same flag are free. */
  function siren(on) {
    if (!ctx) return;
    try {
      if (on && !sirenOn) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 825;
        sirenLfo = ctx.createOscillator();
        sirenLfo.type = 'sine';
        sirenLfo.frequency.value = 0.5;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 125;
        sirenLfo.connect(lfoGain);
        lfoGain.connect(sirenOsc.frequency);
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.04;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        sirenLfo.start();
        sirenOn = true;
      } else if (!on && sirenOn) {
        const osc = sirenOsc;
        const lfo = sirenLfo;
        const gain = sirenGain;
        sirenOsc = null;
        sirenLfo = null;
        sirenGain = null;
        sirenOn = false;
        if (gain) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        window.setTimeout(() => {
          try {
            osc?.stop();
            lfo?.stop();
            gain?.disconnect();
          } catch {
            // Already stopped; nothing to do.
          }
        }, 200);
      }
    } catch {
      sirenOn = false;
    }
  }

  /** Short filtered noise crack. */
  function gunshot() {
    if (!ctx || !noiseBuffer) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(now);
      src.stop(now + 0.13);
    } catch {
      // Ignore.
    }
  }

  /** Low thump for a punch. */
  function punch() {
    tone(90, 0.08, 0.3, 'sine');
  }

  /** Bright two-note pickup chime. */
  function pickup() {
    tone(660, 0.09, 0.18, 'sine', 0);
    tone(880, 0.12, 0.18, 'sine', 0.09);
  }

  /** Four-note rising arpeggio when a mission pays out. */
  function missionDone() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => tone(freq, 0.14, 0.2, 'triangle', i * 0.11));
  }

  /** One short enveloped oscillator note, optionally delayed. */
  function tone(freq, duration, volume, type, delay = 0) {
    if (!ctx) return;
    try {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Ignore.
    }
  }

  /** Mute or unmute everything through the master gain. */
  function setMuted(m) {
    audio.muted = !!m;
    if (ctx && master) {
      try {
        master.gain.setTargetAtTime(audio.muted ? 0 : 1, ctx.currentTime, 0.02);
      } catch {
        // Ignore.
      }
    }
  }

  return audio;
}
