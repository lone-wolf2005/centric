type FeedbackTone = "match" | "mismatch" | "warning";

let sharedContext: AudioContext | null = null;
let unlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioContextClass();
  }

  return sharedContext;
}

async function ensureUnlocked(): Promise<AudioContext | null> {
  const context = getAudioContext();
  if (!context) {
    return null;
  }

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return null;
    }
  }

  unlocked = context.state === "running";
  return unlocked ? context : null;
}

/** Call once from a click/touch so beeps work on phones and laptops. */
export async function unlockAudio(): Promise<void> {
  const context = await ensureUnlocked();
  if (!context) {
    return;
  }

  // Play a near-silent blip to fully unlock hardware audio on mobile.
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0.0001;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.01);
}

function toneConfig(type: FeedbackTone) {
  if (type === "match") {
    return {
      frequencies: [880, 1174],
      durations: [0.12, 0.16],
      volume: 0.28,
      type: "square" as OscillatorType,
    };
  }

  if (type === "warning") {
    // Distinct triple pulse — used when quantity reaches/exceeds target
    return {
      frequencies: [740, 520, 740, 520],
      durations: [0.1, 0.1, 0.1, 0.22],
      volume: 0.34,
      type: "square" as OscillatorType,
    };
  }

  return {
    frequencies: [220, 165],
    durations: [0.18, 0.28],
    volume: 0.32,
    type: "sawtooth" as OscillatorType,
  };
}

export function playFeedbackTone(type: FeedbackTone): void {
  if (typeof window === "undefined") {
    return;
  }

  void (async () => {
    const context = await ensureUnlocked();
    if (!context) {
      return;
    }

    const config = toneConfig(type);
    let startAt = context.currentTime;

    config.frequencies.forEach((frequency, index) => {
      const duration = config.durations[index] ?? 0.15;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = config.type;
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(config.volume, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        startAt + duration - 0.02,
      );

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration);

      startAt += duration + 0.04;
    });
  })();
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}
