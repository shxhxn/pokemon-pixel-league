let context: AudioContext | undefined;
let muted = false;
export const setMuted = (v: boolean) => {
  muted = v;
};
export function sound(
  kind: "jump" | "coin" | "hit" | "end" | "attack" | "special",
  voice = 0,
) {
  if (muted) return;
  try {
    context ??= new AudioContext();
    void context.resume();
    const o = context.createOscillator(),
      g = context.createGain();
    o.connect(g);
    g.connect(context.destination);
    o.type = "square";
    const hz =
      { jump: 350, coin: 880, hit: 130, end: 420, attack: 220, special: 530 }[
        kind
      ] +
      (voice % 7) * 22;
    o.frequency.setValueAtTime(hz, context.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      kind === "hit" ? 50 : hz * 1.8,
      context.currentTime + 0.1,
    );
    g.gain.setValueAtTime(0.025, context.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
    o.start();
    o.stop(context.currentTime + 0.16);
  } catch {
    /* Audio support is optional. */
  }
}
