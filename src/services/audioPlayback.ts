/** One active voice note at a time, independent from the component that owns it. */
let active: { id: string; pause: () => void } | undefined;
export const voicePlayback = { activate(id: string, pause: () => void) { if (active?.id !== id) active?.pause(); active = { id, pause }; }, clear(id: string) { if (active?.id === id) active = undefined; } };
