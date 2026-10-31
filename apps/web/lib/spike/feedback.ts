'use client';

// Capture feedback. iPhone Safari has no Vibration API, so: Web Audio click
// (must be unlocked inside a user tap; muted by the silent switch) plus an
// experimental haptic via the iOS 18 `<input type=checkbox switch>` control.

let ctx: AudioContext | null = null;
let hapticLabel: HTMLLabelElement | null = null;

export function unlockAudio(): void {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  // Play a silent buffer so iOS fully unlocks output.
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, 22050);
  src.connect(ctx.destination);
  src.start();
}

/** Soft wooden "pop" for the front; a gentle rising two-note chime when the pair completes. */
export function playShutter(kind: 'front' | 'pair' = 'front'): void {
  if (!ctx) return;
  if (kind === 'front') pop(ctx, ctx.currentTime);
  else {
    pop(ctx, ctx.currentTime);
    chime(ctx, ctx.currentTime + 0.06, 659.25); // E5
    chime(ctx, ctx.currentTime + 0.16, 987.77); // B5
  }
}

function pop(ac: AudioContext, t: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.07);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

function chime(ac: AudioContext, t: number, freq: number) {
  // Sine fundamental plus a quiet octave partial, with a soft attack and long decay.
  for (const [mult, level] of [
    [1, 0.18],
    [2, 0.05],
  ] as const) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * mult, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  }
}

export function tryHaptic(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(30);
    return;
  }
  if (!hapticLabel) {
    hapticLabel = document.createElement('label');
    hapticLabel.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;overflow:hidden';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    hapticLabel.appendChild(input);
    document.body.appendChild(hapticLabel);
  }
  hapticLabel.click();
}
