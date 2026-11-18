// Same note sequences, beats and timing as the supplied use-music.ts. No React or audio downloads.
const melodies = {
  birthday: {
    notes: [
      261.63, 261.63, 293.66, 261.63, 349.23, 329.63, 261.63, 261.63, 293.66, 261.63, 392, 349.23,
      261.63, 261.63, 523.25, 440, 349.23, 329.63, 293.66, 466.16, 466.16, 440, 349.23, 392, 349.23,
    ],
    beats: [
      0.75, 0.25, 1, 1, 1, 2, 0.75, 0.25, 1, 1, 1, 2, 0.75, 0.25, 1, 1, 1, 1, 2, 0.75, 0.25, 1, 1,
      1, 2,
    ],
    speed: 0.45,
  },
  dreamy: {
    notes: [
      261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66, 261.63, 349.23, 440, 523.25, 587.33,
      523.25, 440, 349.23,
    ],
    beats: [1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2],
    speed: 0.65,
  },
  celebrate: {
    notes: [
      392, 523.25, 659.25, 783.99, 659.25, 523.25, 440, 587.33, 698.46, 880, 698.46, 587.33, 392,
      493.88, 587.33, 783.99,
    ],
    beats: [1, 0.5, 0.5, 1, 1, 2, 1, 0.5, 0.5, 1, 1, 2, 1, 1, 1, 3],
    speed: 0.38,
  },
};

let current = null;
export function stopSound() {
  const session = current;
  current = null;
  if (!session) return;
  clearTimeout(session.timer);
  session.context.close().catch(() => {});
  session.changed(false);
}
export async function toggleSound(track, changed) {
  if (current) {
    stopSound();
    return;
  }
  const melody = melodies[track];
  if (!melody) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw Error('Sound is not available in this browser. The letter still works.');
  const ctx = new Audio(),
    session = { context: ctx, changed };
  current = session;
  try {
    await ctx.resume();
    if (current !== session) return;
    let time = ctx.currentTime + 0.05;
    melody.notes.forEach((frequency, i) => {
      const duration = melody.beats[i] * melody.speed,
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.12, time + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, time + Math.max(0.1, duration * 0.95));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + duration);
      time += duration;
    });
    changed(true);
    session.timer = setTimeout(stopSound, (time - ctx.currentTime) * 1000 + 150);
  } catch (e) {
    if (current === session) stopSound();
    throw e;
  }
}
