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

  // A dry click: pulling the trigger with no ammo left.
  function click() {
    const now = start();
    const filter = audio.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    noiseSource(now, 0.03).connect(filter).connect(envelope(now, 0.4, 0.03));
  }

  // Two metal clacks, for loading up from an ammo box.
  function reload() {
    const now = start();
    for (const [delay, frequency] of [
      [0, 1800],
      [0.14, 2600],
    ]) {
      const filter = audio.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = frequency;
      filter.Q.value = 3;
      noiseSource(now + delay, 0.06).connect(filter).connect(envelope(now + delay, 0.8, 0.06));
    }
  }

  // A deep, rough roar that rises then falls, for a monster spotting the
  // minion. `volume` is 0 to 1, quieter for monsters further away.
  function roar(volume) {
    if (volume < 0.02) return;
    const now = start();
    const length = 1.3;
    const output = envelope(now, 0.8 * volume, length);
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.linearRampToValueAtTime(1100, now + 0.3);
    filter.frequency.exponentialRampToValueAtTime(250, now + length);
    filter.connect(output);
    // Two slightly out-of-tune voices make it sound bigger and nastier.
    const voices = [95, 101].map((pitch) => {
      const voice = audio.createOscillator();
      voice.type = 'sawtooth';
      voice.frequency.setValueAtTime(pitch * 0.8, now);
      voice.frequency.linearRampToValueAtTime(pitch * 1.25, now + 0.3);
      voice.frequency.exponentialRampToValueAtTime(pitch * 0.6, now + length);
      voice.connect(filter);
      return voice;
    });
    const rasp = audio.createOscillator();
    rasp.frequency.value = 28;
    const raspDepth = audio.createGain();
    raspDepth.gain.value = 25;
    rasp.connect(raspDepth);
    for (const voice of voices) raspDepth.connect(voice.frequency);
    const breath = audio.createBiquadFilter();
    breath.type = 'bandpass';
    breath.frequency.value = 700;
    noiseSource(now, length).connect(breath).connect(filter);
    for (const oscillator of [...voices, rasp]) {
      oscillator.start(now);
      oscillator.stop(now + length);
    }
  }

  // A low, rumbling growl that throbs, for a monster close by.
  function growl(volume) {
    if (volume < 0.02) return;
    const now = start();
    const length = 1.1;
    const tone = audio.createOscillator();
    tone.type = 'sawtooth';
    tone.frequency.setValueAtTime(62, now);
    tone.frequency.linearRampToValueAtTime(75, now + 0.4);
    tone.frequency.linearRampToValueAtTime(55, now + length);
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    // Throb the volume up and down quickly, like a rattling throat.
    const throb = audio.createGain();
    throb.gain.value = 0.6;
    const pulse = audio.createOscillator();
    pulse.frequency.value = 13;
    const pulseDepth = audio.createGain();
    pulseDepth.gain.value = 0.4;
    pulse.connect(pulseDepth).connect(throb.gain);
    const output = envelope(now, 0.9 * volume, length);
    tone.connect(filter).connect(throb).connect(output);
    const breath = audio.createBiquadFilter();
    breath.type = 'lowpass';
    breath.frequency.value = 300;
    noiseSource(now, length).connect(breath).connect(throb);
    for (const oscillator of [tone, pulse]) {
      oscillator.start(now);
      oscillator.stop(now + length);
    }
  }

  // A ripping, tearing noise for claws slashing the minion: crackly noise
  // that keeps cutting in and out, sweeping up in pitch.
  function rip() {
    const now = start();
    const length = 0.4;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.5;
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(3500, now + length);
    const tear = audio.createGain();
    tear.gain.setValueAtTime(0, now);
    for (let t = 0; t < length; t += 0.012 + Math.random() * 0.02) {
      tear.gain.setValueAtTime(0.3 + Math.random() * 0.7, now + t);
      tear.gain.setValueAtTime(0.05, now + t + 0.006);
    }
    noiseSource(now, length).connect(filter).connect(tear).connect(envelope(now, 1, length));
    // A thump under the tear, so the hit feels heavy.
    const thump = audio.createOscillator();
    thump.frequency.setValueAtTime(140, now);
    thump.frequency.exponentialRampToValueAtTime(45, now + 0.2);
    thump.connect(envelope(now, 0.7, 0.25));
    thump.start(now);
    thump.stop(now + 0.25);
  }

  return { bang, fart, zap, chime, rumble, screech, flame, swish, thwack, click, reload, roar, growl, rip };
}
