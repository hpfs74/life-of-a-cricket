/**
 * All sound is synthesized — there are no audio files in this project.
 *
 * Every call is guarded: if the browser has no AudioContext, or refuses to
 * create one, audio silently becomes a no-op rather than breaking the game.
 */
export function createAudio() {
  let ctx = null;
  let chirp = null;

  function ensureContext() {
    if (ctx) return ctx;
    try {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function unlock() {
    const context = ensureContext();
    if (context && context.state === 'suspended') context.resume().catch(() => {});
  }

  function blip({ frequency, duration, type = 'sine', gain = 0.2, sweepTo = null }) {
    const context = ensureContext();
    if (!context) return;

    try {
      const osc = context.createOscillator();
      const amp = context.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, context.currentTime);
      if (sweepTo !== null) {
        osc.frequency.exponentialRampToValueAtTime(sweepTo, context.currentTime + duration);
      }

      amp.gain.setValueAtTime(gain, context.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

      osc.connect(amp).connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + duration);
    } catch {
      // Ignore: audio is never load-bearing.
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
      carrier.connect(amp).connect(context.destination);

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
    unlock,

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

    play(eventType) {
      switch (eventType) {
        case 'ate':
          blip({ frequency: 620, sweepTo: 980, duration: 0.12, type: 'triangle', gain: 0.16 });
          break;
        case 'bird-cry':
          blip({ frequency: 1500, sweepTo: 420, duration: 0.45, type: 'sawtooth', gain: 0.12 });
          break;
        case 'hit':
          blip({ frequency: 260, sweepTo: 70, duration: 0.5, type: 'square', gain: 0.2 });
          break;
        case 'game-over':
          blip({ frequency: 420, sweepTo: 90, duration: 1.1, type: 'sine', gain: 0.22 });
          break;
        default:
          break;
      }
    },
  };
}
