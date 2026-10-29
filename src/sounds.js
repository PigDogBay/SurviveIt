// Weapon sounds made with Web Audio, so there are no sound files to load.
// The audio starts on the first shot, because browsers only allow sound
// after the player has clicked.
export function createSounds() {
  let audio;
  let noise;

  function start() {
    if (audio) return audio.currentTime;
    audio = new AudioContext();
    noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return audio.currentTime;
  }

  function envelope(now, peak, length) {
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    gain.connect(audio.destination);
    return gain;
  }

  function noiseSource(now, length) {
    const source = audio.createBufferSource();
    source.buffer = noise;
    source.start(now);
    source.stop(now + length);
    return source;
  }

  // A deep boom: noise that gets more muffled as it fades.
  function bang() {
    const now = start();
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2500, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.6);
    noiseSource(now, 0.9).connect(filter).connect(envelope(now, 0.9, 0.8));
  }

  // A long, wobbly, spluttering raspberry.
  function fart() {
    const now = start();
    const length = 0.9;
    const tone = audio.createOscillator();
    tone.type = 'sawtooth';
    tone.frequency.setValueAtTime(95, now);
    tone.frequency.exponentialRampToValueAtTime(50, now + length);
    const wobble = audio.createOscillator();
    wobble.frequency.value = 22;
    const wobbleDepth = audio.createGain();
    wobbleDepth.gain.value = 30;
    wobble.connect(wobbleDepth).connect(tone.frequency);

    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const output = envelope(now, 0.6, length);
    tone.connect(filter).connect(output);

    const sputter = audio.createBiquadFilter();
    sputter.type = 'bandpass';
    sputter.frequency.value = 180;
    noiseSource(now, length).connect(sputter).connect(output);

    for (const oscillator of [tone, wobble]) {
      oscillator.start(now);
      oscillator.stop(now + length);
    }
  }

  // A falling, shimmering "pew".
  function zap() {
    const now = start();
    const length = 0.45;
    const tone = audio.createOscillator();
    tone.type = 'square';
    tone.frequency.setValueAtTime(1800, now);
    tone.frequency.exponentialRampToValueAtTime(260, now + length);
    const shimmer = audio.createOscillator();
    shimmer.frequency.value = 40;
    const shimmerDepth = audio.createGain();
    shimmerDepth.gain.value = 120;
    shimmer.connect(shimmerDepth).connect(tone.frequency);
    tone.connect(envelope(now, 0.25, length));
    for (const oscillator of [tone, shimmer]) {
      oscillator.start(now);
      oscillator.stop(now + length);
    }
  }

  return { bang, fart, zap };
}
