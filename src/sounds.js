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

  // Breaking glass: a sharp crash, then bits of ice tinkling down.
  function shatter() {
    const now = start();
    const crash = audio.createBiquadFilter();
    crash.type = 'highpass';
    crash.frequency.value = 2500;
    noiseSource(now, 0.35).connect(crash).connect(envelope(now, 0.8, 0.35));
    const crunch = audio.createBiquadFilter();
    crunch.type = 'bandpass';
    crunch.frequency.value = 900;
    noiseSource(now, 0.15).connect(crunch).connect(envelope(now, 0.6, 0.15));
    for (let i = 0; i < 10; i++) {
      const delay = 0.05 + Math.random() * 0.6;
      const tinkle = audio.createOscillator();
      tinkle.type = 'sine';
      tinkle.frequency.value = 2500 + Math.random() * 3500;
      tinkle.connect(envelope(now + delay, 0.12, 0.12));
      tinkle.start(now + delay);
      tinkle.stop(now + delay + 0.15);
    }
  }

  // A soft "thoop" as a Taki is launched.
  function pop() {
    const now = start();
    const tone = audio.createOscillator();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(220, now);
    tone.frequency.exponentialRampToValueAtTime(700, now + 0.08);
    tone.connect(envelope(now, 0.4, 0.12));
    tone.start(now);
    tone.stop(now + 0.13);
    const puff = audio.createBiquadFilter();
    puff.type = 'bandpass';
    puff.frequency.value = 1200;
    noiseSource(now, 0.08).connect(puff).connect(envelope(now, 0.3, 0.08));
  }

  // A crunchy snack hitting its target.
  function crunch() {
    const now = start();
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2200;
    filter.Q.value = 1.2;
    const crackle = audio.createGain();
    crackle.gain.setValueAtTime(0, now);
    for (let t = 0; t < 0.15; t += 0.015 + Math.random() * 0.015) {
      crackle.gain.setValueAtTime(0.4 + Math.random() * 0.6, now + t);
      crackle.gain.setValueAtTime(0.05, now + t + 0.006);
    }
    noiseSource(now, 0.15).connect(filter).connect(crackle).connect(envelope(now, 0.8, 0.15));
  }

  // A monster's howl of pain, rising then falling, when Takis get in its eyes.
  function yelp(volume) {
    if (volume < 0.02) return;
    const now = start();
    const length = 0.7;
    const tone = audio.createOscillator();
    tone.type = 'sawtooth';
    tone.frequency.setValueAtTime(260, now);
    tone.frequency.linearRampToValueAtTime(620, now + 0.15);
    tone.frequency.exponentialRampToValueAtTime(180, now + length);
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    tone.connect(filter).connect(envelope(now, 0.35 * volume, length));
    tone.start(now);
    tone.stop(now + length);
  }

  // Roro's harsh squawk, from three throats at once. Longer for a death cry.
  function caw(volume, length = 0.5) {
    const now = start();
    const output = envelope(now, 0.5 * volume, length);
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1300;
    filter.Q.value = 0.9;
    filter.connect(output);
    const voices = [480, 520, 610].map((pitch) => {
      const voice = audio.createOscillator();
      voice.type = 'sawtooth';
      voice.frequency.setValueAtTime(pitch, now);
      voice.frequency.linearRampToValueAtTime(pitch * 1.15, now + 0.08);
      voice.frequency.exponentialRampToValueAtTime(pitch * 0.55, now + length);
      voice.connect(filter);
      return voice;
    });
    const rasp = audio.createOscillator();
    rasp.frequency.value = 55;
    const raspDepth = audio.createGain();
    raspDepth.gain.value = 90;
    rasp.connect(raspDepth);
    for (const voice of voices) raspDepth.connect(voice.frequency);
    for (const oscillator of [...voices, rasp]) {
      oscillator.start(now);
      oscillator.stop(now + length);
    }
  }

  // A big whoosh of wings.
  function flap() {
    const now = start();
    for (const delay of [0, 0.22]) {
      const filter = audio.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now + delay);
      filter.frequency.linearRampToValueAtTime(900, now + delay + 0.1);
      filter.frequency.linearRampToValueAtTime(200, now + delay + 0.2);
      noiseSource(now + delay, 0.2).connect(filter).connect(envelope(now + delay, 0.7, 0.2));
    }
  }

  // Something huge hitting the ground.
  function slam() {
    const now = start();
    const thump = audio.createOscillator();
    thump.frequency.setValueAtTime(90, now);
    thump.frequency.exponentialRampToValueAtTime(30, now + 0.4);
    thump.connect(envelope(now, 1, 0.45));
    thump.start(now);
    thump.stop(now + 0.45);
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    noiseSource(now, 0.4).connect(filter).connect(envelope(now, 0.8, 0.4));
  }

  // A slow, rumbling snore.
  function snore() {
    const now = start();
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 250;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.9);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
    gain.connect(audio.destination);
    const source = audio.createBufferSource();
    source.buffer = noise;
    source.connect(filter).connect(gain);
    source.start(now);
    source.stop(now + 1.6);
  }

  // A rising, triumphant tune for winning.
  function fanfare() {
    const now = start();
    for (const [frequency, delay, length] of [
      [523, 0, 0.18],
      [659, 0.18, 0.18],
      [784, 0.36, 0.18],
      [1047, 0.54, 0.8],
      [784, 0.54, 0.8],
      [659, 0.54, 0.8],
    ]) {
      const tone = audio.createOscillator();
      tone.type = 'triangle';
      tone.frequency.value = frequency;
      tone.connect(envelope(now + delay, 0.25, length));
      tone.start(now + delay);
      tone.stop(now + delay + length + 0.05);
    }
  }

  return { bang, fart, zap, chime, rumble, screech, flame, swish, thwack, click, reload, roar, growl, rip, fanfare, shatter, pop, crunch, yelp, caw, flap, slam, snore };
}
