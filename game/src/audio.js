// SOLMAR BAY — sound: everything synthesized with WebAudio, no audio files.
// One job: engine hum, sirens, gunshots, pickups and mission fanfares.

export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenOn: false,
  };
  return audio;
}

function ensureCtx(audio) {
  if (audio.ctx) return audio.ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio.ctx = new AC();
    return audio.ctx;
  } catch {
    return null;
  }
}

export function unlockAudio(audio) {
  const ctx = ensureCtx(audio);
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (!ctx || audio.engineOsc) return;
  try {
    audio.engineOsc = ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    audio.engineOsc.connect(filter).connect(audio.engineGain).connect(ctx.destination);
    audio.engineOsc.start();
  } catch {
    // sound is garnish: never break the game
  }
}

export function setEngine(audio, speedFrac, driving) {
  if (!audio.ctx || !audio.engineOsc || audio.muted) return;
  try {
    audio.engineOsc.frequency.setTargetAtTime(50 + speedFrac * 140, audio.ctx.currentTime, 0.08);
    audio.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedFrac * 0.05 : 0, audio.ctx.currentTime, 0.1);
  } catch {
    // ignore
  }
}

export function setSiren(audio, on) {
  if (!audio.ctx || audio.muted) return;
  if (on === audio.sirenOn) return;
  audio.sirenOn = on;
  try {
    if (on && !audio.sirenOsc) {
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'sine';
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0.035;
      audio.sirenOsc.connect(audio.sirenGain).connect(audio.ctx.destination);
      audio.sirenOsc.start();
      const lfo = audio.ctx.createOscillator();
      lfo.frequency.value = 0.9;
      const lfoGain = audio.ctx.createGain();
      lfoGain.gain.value = 320;
      lfo.connect(lfoGain).connect(audio.sirenOsc.frequency);
      audio.sirenOsc.frequency.value = 880;
      lfo.start();
      audio.sirenLfo = lfo;
    } else if (!on && audio.sirenOsc) {
      audio.sirenOsc.stop();
      if (audio.sirenLfo) audio.sirenLfo.stop();
      audio.sirenOsc = null;
      audio.sirenLfo = null;
    }
  } catch {
    // ignore
  }
}

function blip(audio, freq, dur, type = 'sine', vol = 0.12) {
  const ctx = ensureCtx(audio);
  if (!ctx || audio.muted) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch {
    // ignore
  }
}

function noise(audio, dur, vol = 0.2) {
  const ctx = ensureCtx(audio);
  if (!ctx || audio.muted) return;
  try {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(ctx.destination);
    src.start();
  } catch {
    // ignore
  }
}

export function gunshot(audio, distant = false) {
  noise(audio, 0.14, distant ? 0.06 : 0.22);
}

export function thud(audio) {
  blip(audio, 90, 0.12, 'triangle', 0.2);
}

export function pickup(audio) {
  blip(audio, 660, 0.1);
  setTimeout(() => blip(audio, 990, 0.14), 90);
}

export function alarm(audio) {
  blip(audio, 520, 0.18, 'square', 0.08);
  setTimeout(() => blip(audio, 390, 0.18, 'square', 0.08), 160);
}

export function fanfare(audio) {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => setTimeout(() => blip(audio, f, 0.22, 'triangle', 0.12), i * 110));
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.engineGain) audio.engineGain.gain.value = 0;
  if (!audio.muted && audio.sirenOn) {
    const was = audio.sirenOn;
    audio.sirenOn = false;
    setSiren(audio, was);
  } else if (audio.muted && audio.sirenOsc) {
    try {
      audio.sirenOsc.stop();
      if (audio.sirenLfo) audio.sirenLfo.stop();
    } catch {
      // ignore
    }
    audio.sirenOsc = null;
    audio.sirenLfo = null;
  }
  return audio.muted;
}
