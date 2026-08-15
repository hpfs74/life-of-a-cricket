/**
 * All sound is synthesized — there are no audio files in this project.
 *
 * Three layers:
 *   - a continuous ambient bed (wind moving through leaves),
 *   - occasional night calls (an owl, a distant wolf),
 *   - one-shot game sounds (the cricket's song, predators, eating, hits).
 *
 * Every call is guarded: if the browser has no AudioContext, or refuses to
 * create one, audio silently becomes a no-op rather than breaking the game.
 */

const AMBIENCE = {
  windGain: 0.09,
  gustGain: 0.05,
  rustleEverySeconds: [5, 13],
  owlEverySeconds: [11, 24],
  wolfEverySeconds: [28, 62],
};

/** Seconds until the next event in a [min, max] range. */
function nextDelay([min, max]) {
  return min + Math.random() * (max - min);
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  let chirp = null;
  let ambience = null;

  const timers = {
    rustle: nextDelay(AMBIENCE.rustleEverySeconds),
    owl: nextDelay(AMBIENCE.owlEverySeconds),
    wolf: nextDelay(AMBIENCE.wolfEverySeconds),
  };

  function ensureContext() {
    if (ctx) return ctx;
    try {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      master = null;
    }
    return ctx;
  }

  /** Brown noise: softer and less hissy than white, which is what makes it restful. */
  function noiseBuffer(context, seconds = 3) {
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;

    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  /** A shaped tone. Returns silently if audio is unavailable. */
  function tone({
    frequency, duration, type = 'sine', gain = 0.2,
    sweepTo = null, delay = 0, attack = 0.01, detuneHz = 0,
  }) {
    const context = ensureContext();
    if (!context) return;

    try {
      const start = context.currentTime + delay;
      const osc = context.createOscillator();
      const amp = context.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      if (sweepTo !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), start + duration);
      }
      if (detuneHz) {
        const vibrato = context.createOscillator();
        const depth = context.createGain();
        vibrato.frequency.value = 5.5;
        depth.gain.value = detuneHz;
        vibrato.connect(depth).connect(osc.frequency);
        vibrato.start(start);
        vibrato.stop(start + duration + 0.05);
      }

      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(amp).connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    } catch {
      // Ignore: audio is never load-bearing.
    }
  }

  /** A short breath of filtered noise — leaves stirring, or a wing beat. */
  function noiseBurst({ duration = 0.9, peak = 0.05, centre = 1400, delay = 0 }) {
    const context = ensureContext();
    if (!context) return;

    try {
      const start = context.currentTime + delay;
      const source = context.createBufferSource();
      const band = context.createBiquadFilter();
      const amp = context.createGain();

      source.buffer = noiseBuffer(context, Math.max(0.6, duration));
      band.type = 'bandpass';
      band.frequency.value = centre;
      band.Q.value = 0.8;

      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.linearRampToValueAtTime(peak, start + duration * 0.35);
      amp.gain.linearRampToValueAtTime(0.0001, start + duration);

      source.connect(band).connect(amp).connect(master);
      source.start(start);
      source.stop(start + duration + 0.05);
    } catch {
      // Ignore.
    }
  }

  /** The steady bed: wind through the grass, always there, never in the way. */
  function startAmbience() {
    const context = ensureContext();
    if (!context || ambience) return;

    try {
      const source = context.createBufferSource();
      source.buffer = noiseBuffer(context, 4);
      source.loop = true;

      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      filter.Q.value = 0.4;

      const gain = context.createGain();
      gain.gain.value = AMBIENCE.windGain;

      // Two slow LFOs: one opens the filter, one swells the level. Together
      // they read as gusts rather than a static hiss.
      const sweep = context.createOscillator();
      const sweepDepth = context.createGain();
      sweep.frequency.value = 0.07;
      sweepDepth.gain.value = 320;
      sweep.connect(sweepDepth).connect(filter.frequency);

      const gust = context.createOscillator();
      const gustDepth = context.createGain();
      gust.frequency.value = 0.045;
      gustDepth.gain.value = AMBIENCE.gustGain;
      gust.connect(gustDepth).connect(gain.gain);

      source.connect(filter).connect(gain).connect(master);
      source.start();
      sweep.start();
      gust.start();

      ambience = { source, filter, gain, sweep, gust };
    } catch {
      ambience = null;
    }
  }

  /** Two low hoots, a beat apart. */
  function owlCall() {
    tone({ frequency: 372, duration: 0.42, type: 'sine', gain: 0.075, detuneHz: 4, attack: 0.08 });
    tone({ frequency: 352, duration: 0.5, type: 'sine', gain: 0.065, detuneHz: 4, attack: 0.09, delay: 0.62 });
  }

  /** A far-off howl: up, held, then falling away. */
  function wolfCall() {
    tone({ frequency: 262, sweepTo: 470, duration: 0.85, type: 'sine', gain: 0.055, attack: 0.3 });
    tone({ frequency: 470, sweepTo: 250, duration: 1.5, type: 'sine', gain: 0.05, attack: 0.15, delay: 0.85 });
  }

  /** Daytime predator: bright chirping as it arrives. */
  function birdChirps() {
    for (let i = 0; i < 3; i += 1) {
      tone({
        frequency: 2100 + i * 240,
        sweepTo: 3300 + i * 200,
        duration: 0.07,
        type: 'triangle',
        gain: 0.1,
        attack: 0.005,
        delay: i * 0.11,
      });
    }
  }

  /** Night predator: thin echolocation clicks, kept quiet because they are piercing. */
  function batClicks() {
    for (let i = 0; i < 4; i += 1) {
      tone({
        frequency: 6800,
        sweepTo: 4200,
        duration: 0.025,
        type: 'square',
        gain: 0.035,
        attack: 0.003,
        delay: i * 0.07,
      });
    }
  }

  /**
   * A cricket stridulates rather than sings: a high carrier chopped by a fast
   * tremolo. Amplitude-modulating a square wave gets close with two oscillators.
   */
  function startChirp() {
    const context = ensureContext();
    if (!context || chirp) return;

    try {
      const carrier = context.createOscillator();
      const tremolo = context.createOscillator();
      const tremoloDepth = context.createGain();
      const amp = context.createGain();

      carrier.type = 'square';
      carrier.frequency.value = 3400;

      tremolo.type = 'sine';
      tremolo.frequency.value = 26;
      tremoloDepth.gain.value = 0.05;

      amp.gain.value = 0.0001;

      tremolo.connect(tremoloDepth).connect(amp.gain);
      carrier.connect(amp).connect(master);

      carrier.start();
      tremolo.start();

      chirp = { carrier, tremolo, amp, context };
    } catch {
      chirp = null;
    }
  }

  function stopChirp() {
    if (!chirp) return;
    try {
      chirp.amp.gain.setTargetAtTime(0.0001, chirp.context.currentTime, 0.02);
      chirp.carrier.stop(chirp.context.currentTime + 0.15);
      chirp.tremolo.stop(chirp.context.currentTime + 0.15);
    } catch {
      // Ignore.
    }
    chirp = null;
  }

  return {
    unlock() {
      const context = ensureContext();
      if (!context) return;
      if (context.state === 'suspended') context.resume().catch(() => {});
      startAmbience();
    },

    isMuted() {
      return muted;
    },

    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
      return muted;
    },

    /**
     * Advances the ambient layer. Owls and wolves only call after dark, so the
     * soundscape tells the player what time it is even with their eyes on the
     * cricket.
     */
    update(dt, { night = false } = {}) {
      if (!ctx || muted) return;

      timers.rustle -= dt;
      if (timers.rustle <= 0) {
        timers.rustle = nextDelay(AMBIENCE.rustleEverySeconds);
        noiseBurst({ duration: 1.1 + Math.random(), peak: 0.03 + Math.random() * 0.025, centre: 1100 + Math.random() * 1200 });
      }

      timers.owl -= dt;
      if (timers.owl <= 0) {
        timers.owl = nextDelay(AMBIENCE.owlEverySeconds);
        if (night) owlCall();
      }

      timers.wolf -= dt;
      if (timers.wolf <= 0) {
        timers.wolf = nextDelay(AMBIENCE.wolfEverySeconds);
        if (night) wolfCall();
      }
    },

    /** Keeps the chirp running while singing; pitch rises with the multiplier. */
    setSinging(active, multiplier = 1) {
      if (!active) {
        stopChirp();
        return;
      }

      startChirp();
      if (!chirp) return;

      try {
        chirp.carrier.frequency.setTargetAtTime(2900 + multiplier * 220, chirp.context.currentTime, 0.08);
        chirp.tremolo.frequency.setTargetAtTime(22 + multiplier * 4, chirp.context.currentTime, 0.08);
        chirp.amp.gain.setTargetAtTime(0.06, chirp.context.currentTime, 0.05);
      } catch {
        // Ignore.
      }
    },

    play(eventType, detail = {}) {
      const bat = detail.kind === 'bat';

      switch (eventType) {
        case 'bird-spawn':
          // The arrival call is the player's first warning that something is here.
          if (bat) batClicks();
          else birdChirps();
          break;
        case 'bird-cry':
          if (bat) {
            batClicks();
            tone({ frequency: 5200, sweepTo: 1400, duration: 0.3, type: 'sawtooth', gain: 0.07 });
          } else {
            tone({ frequency: 1500, sweepTo: 420, duration: 0.45, type: 'sawtooth', gain: 0.12 });
          }
          break;
        case 'spider-wake':
          // A dry tick from the grass: the only warning before the lunge.
          tone({ frequency: 900, sweepTo: 640, duration: 0.05, type: 'square', gain: 0.05 });
          break;
        case 'spider-lunge':
          noiseBurst({ duration: 0.16, peak: 0.09, centre: 2600 });
          tone({ frequency: 480, sweepTo: 180, duration: 0.18, type: 'sawtooth', gain: 0.08 });
          break;
        case 'rival-ate':
          // Someone else's meal: quieter, and lower than the cricket's own.
          tone({ frequency: 340, sweepTo: 250, duration: 0.09, type: 'triangle', gain: 0.05 });
          break;
        case 'ate':
          tone({ frequency: 620, sweepTo: 980, duration: 0.12, type: 'triangle', gain: 0.16 });
          break;
        case 'jump':
          tone({ frequency: 300, sweepTo: 760, duration: 0.16, type: 'triangle', gain: 0.09 });
          break;
        case 'land':
          noiseBurst({ duration: 0.14, peak: 0.05, centre: 420 });
          break;
        case 'hit':
          tone({ frequency: 260, sweepTo: 70, duration: 0.5, type: 'square', gain: 0.2 });
          break;
        case 'game-over':
          tone({ frequency: 420, sweepTo: 90, duration: 1.1, type: 'sine', gain: 0.22 });
          break;
        default:
          break;
      }
    },
  };
}
