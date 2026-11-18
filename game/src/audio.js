// Procedural sound: everything is synthesized with WebAudio — engine hum,
// police sirens, pickup chimes, gunshots and a low-key bass loop. No files.
export function createAudio() {
  return {
    ctx: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    musicTimer: 0,
    musicStep: 0,
  };
}

export function ensureAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    return true;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new Ctx();
    const engineGain = audio.ctx.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(audio.ctx.destination);
    const engineOsc = audio.ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    const engineFilter = audio.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineOsc.start();
    audio.engineOsc = engineOsc;
    audio.engineGain = engineGain;
    const sirenGain = audio.ctx.createGain();
    sirenGain.gain.value = 0;
    sirenGain.connect(audio.ctx.destination);
    const sirenOsc = audio.ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 700;
    sirenOsc.connect(sirenGain);
    sirenOsc.start();
    audio.sirenOsc = sirenOsc;
    audio.sirenGain = sirenGain;
    return true;
  } catch {
    return false;
  }
}

function blip(audio, freq, dur, type = 'sine', vol = 0.15) {
  if (!audio.ctx || audio.muted) return;
  try {
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audio.ctx.destination);
    osc.start();
    osc.stop(audio.ctx.currentTime + dur);
  } catch {
    // Audio is decoration: never let it break the game.
  }
}

export function playPickup(audio) {
  blip(audio, 660, 0.12);
  setTimeout(() => blip(audio, 990, 0.18), 90);
}

export function playShot(audio) {
  if (!audio.ctx || audio.muted) return;
  try {
    const len = audio.ctx.sampleRate * 0.12;
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    const gain = audio.ctx.createGain();
    gain.gain.value = 0.25;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.ctx.destination);
    src.start();
  } catch {
    // Ignore audio failures.
  }
}

export function playBusted(audio) {
  blip(audio, 220, 0.3, 'square', 0.12);
  setTimeout(() => blip(audio, 165, 0.5, 'square', 0.12), 200);
}

// Called every frame: engine follows speed, siren wails with the wanted
// level, and a quiet bass line walks under everything.
export function updateAudio(audio, game, dt) {
  if (!audio.ctx || audio.muted) return;
  const driving = !game.player.onFoot && game.player.car;
  const speed = driving ? Math.abs(game.player.car.speed) : 0;
  if (audio.engineGain) {
    audio.engineGain.gain.value = driving ? 0.05 + Math.min(0.06, speed * 0.0015) : 0;
    audio.engineOsc.frequency.value = 55 + speed * 4;
  }
  if (audio.sirenGain) {
    const wanted = game.wanted.stars;
    audio.sirenGain.gain.value = wanted > 0 && game.police.length > 0 ? 0.035 : 0;
    audio.sirenOsc.frequency.value = Math.sin(game.time * 5) > 0 ? 720 : 540;
  }
  audio.musicTimer -= dt;
  if (audio.musicTimer <= 0) {
    audio.musicTimer = 0.42;
    const bass = [55, 0, 65.4, 0, 49, 0, 58.3, 0];
    const note = bass[audio.musicStep % bass.length];
    audio.musicStep += 1;
    if (note > 0) blip(audio, note, 0.38, 'triangle', 0.06);
  }
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.ctx) {
    if (audio.engineGain) audio.engineGain.gain.value = 0;
    if (audio.sirenGain) audio.sirenGain.gain.value = 0;
  }
  return audio.muted;
}
