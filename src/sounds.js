// Game sounds made with Web Audio, so there are no sound files to load.
// The audio starts on the first sound, because browsers only allow sound
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

  // Two bright notes, for finding something special.
  function chime() {
    const now = start();
    for (const [frequency, delay] of [
      [880, 0],
      [1320, 0.12],
    ]) {
      const tone = audio.createOscillator();
      tone.type = 'sine';
      tone.frequency.value = frequency;
      tone.connect(envelope(now + delay, 0.3, 0.9));
      tone.start(now + delay);
      tone.stop(now + delay + 1);
    }
  }

  // Heavy stone grinding, for the temple door.
  function rumble(length) {
    const now = start();
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 140;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(1.2, now + 0.3);
    gain.gain.setValueAtTime(1.2, now + length - 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    gain.connect(audio.destination);
    // The noise buffer is 1 s long, so loop it for longer sounds.
    const source = audio.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    source.connect(filter).connect(gain);
    source.start(now);
    source.stop(now + length);
  }

  // A sudden shriek with a deep thud under it, for jump scares.
  function screech() {
    const now = start();
    const length = 1;
    const shriek = audio.createOscillator();
    shriek.type = 'sawtooth';
    shriek.frequency.setValueAtTime(700, now);
    shriek.frequency.exponentialRampToValueAtTime(1700, now + 0.15);
    shriek.frequency.exponentialRampToValueAtTime(380, now + length);
    const warble = audio.createOscillator();
    warble.frequency.value = 33;
    const warbleDepth = audio.createGain();
    warbleDepth.gain.value = 180;
    warble.connect(warbleDepth).connect(shriek.frequency);
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.8;
    const output = envelope(now, 0.7, length);
    shriek.connect(filter).connect(output);

    const hiss = audio.createBiquadFilter();
    hiss.type = 'highpass';
    hiss.frequency.value = 2500;
    noiseSource(now, 0.5).connect(hiss).connect(envelope(now, 0.35, 0.45));

    const thud = audio.createOscillator();
    thud.frequency.setValueAtTime(110, now);
    thud.frequency.exponentialRampToValueAtTime(35, now + 0.4);
    thud.connect(envelope(now, 1, 0.5));

    for (const [oscillator, stop] of [
      [shriek, length],
      [warble, length],
      [thud, 0.5],
    ]) {
      oscillator.start(now);
      oscillator.stop(now + stop);
    }
  }

  // A roaring whoosh. Played again and again while the flamethrower is held,
  // the bursts overlap into one long roar.
  function flame() {
    const now = start();
    const length = 0.45;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.linearRampToValueAtTime(900, now + length);
    filter.Q.value = 0.6;
    noiseSource(now, length).connect(filter).connect(envelope(now, 0.35, length));
    const crackle = audio.createBiquadFilter();
    crackle.type = 'highpass';
    crackle.frequency.value = 3000;
    noiseSource(now, length).connect(crackle).connect(envelope(now, 0.08, length));
  }

  // A quick swish of air as the sword swings.
  function swish() {
    const now = start();
    const length = 0.25;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(3500, now + length);
    filter.Q.value = 2;
    noiseSource(now, length).connect(filter).connect(envelope(now, 0.5, length));
  }

  // A meaty thwack when the sword hits a monster.
  function thwack() {
    const now = start();
    const thud = audio.createOscillator();
    thud.frequency.setValueAtTime(180, now);
    thud.frequency.exponentialRampToValueAtTime(60, now + 0.15);
    thud.connect(envelope(now, 0.7, 0.2));
    thud.start(now);
    thud.stop(now + 0.2);
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1500;
    noiseSource(now, 0.1).connect(filter).connect(envelope(now, 0.5, 0.1));
  }

  return { bang, fart, zap, chime, rumble, screech, flame, swish, thwack };
}
