// Solmar Bay — synthesized sound: no audio files, everything is WebAudio.
// Engine hum, two-tone siren, gunshots, a thud, and a payoff fanfare.
// Everything is guarded: no context, no crash, and M mutes it all.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenHigh: false,
    sirenTimer: 0,
  };

  function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.5;
      audio.master.connect(audio.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
    if (!ensure()) return;
    try {
      const t0 = audio.ctx.currentTime + when;
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* sound is garnish, never a crash */ }
  }

  function noiseBurst(dur, vol = 0.3) {
    if (!ensure()) return;
    try {
      const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const gain = audio.ctx.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(audio.master);
      src.start();
    } catch { /* sound is garnish, never a crash */ }
  }

  function setEngine(running, speedFrac) {
    if (!ensure()) return;
    try {
      if (running && !audio.engineOsc) {
        audio.engineOsc = audio.ctx.createOscillator();
        audio.engineOsc.type = 'sawtooth';
        audio.engineGain = audio.ctx.createGain();
        audio.engineGain.gain.value = 0.04;
        audio.engineOsc.connect(audio.engineGain);
        audio.engineGain.connect(audio.master);
        audio.engineOsc.start();
      }
      if (audio.engineOsc) {
        audio.engineOsc.frequency.value = 55 + speedFrac * 130;
        audio.engineGain.gain.value = running ? 0.03 + speedFrac * 0.05 : 0;
      }
    } catch { /* sound is garnish, never a crash */ }
  }

  function setSiren(on) {
    if (!ensure()) return;
    try {
      if (on && !audio.sirenOsc) {
        audio.sirenOsc = audio.ctx.createOscillator();
        audio.sirenOsc.type = 'square';
        audio.sirenOsc.frequency.value = 720;
        audio.sirenGain = audio.ctx.createGain();
        audio.sirenGain.gain.value = 0.035;
        audio.sirenOsc.connect(audio.sirenGain);
        audio.sirenGain.connect(audio.master);
        audio.sirenOsc.start();
      } else if (!on && audio.sirenOsc) {
        audio.sirenOsc.stop();
        audio.sirenOsc = null;
        audio.sirenGain = null;
      }
    } catch { /* sound is garnish, never a crash */ }
  }

  function update(dt, wanted) {
    setSiren(wanted > 0);
    if (audio.sirenOsc) {
      audio.sirenTimer += dt;
      if (audio.sirenTimer > 0.45) {
        audio.sirenTimer = 0;
        audio.sirenHigh = !audio.sirenHigh;
        try { audio.sirenOsc.frequency.value = audio.sirenHigh ? 720 : 540; } catch { /* ignore */ }
      }
    }
  }

  function shot() {
    noiseBurst(0.12, 0.4);
    tone(160, 0.08, 'square', 0.15);
  }

  function punch() {
    noiseBurst(0.09, 0.25);
    tone(90, 0.12, 'sine', 0.3);
  }

  function fanfare() {
    tone(523, 0.16, 'triangle', 0.25, 0);
    tone(659, 0.16, 'triangle', 0.25, 0.14);
    tone(784, 0.3, 'triangle', 0.28, 0.28);
  }

  function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.master) {
      try { audio.master.gain.value = audio.muted ? 0 : 0.5; } catch { /* ignore */ }
    }
    return audio.muted;
  }

  return { audio, ensure, setEngine, update, shot, punch, fanfare, toggleMute };
}
