// FrontY & FrontX can share these types
export type Anchor = { serverTimeEpochMs: number; mediaTimeSec: number };
export type StatePayload = {
  scene: number; cueIndex: number; playbackRate: number;
  isPaused: boolean; anchor: Anchor;
};

export type OutEvent =
  | { type: 'CUE'; scene: number; cueIndex: number; playbackRate: number; anchor: Anchor }
  | { type: 'PAUSE'; anchor: Anchor }
  | { type: 'RESUME'; anchor: Anchor }
  | { type: 'SEEK'; anchor: Anchor }
  | { type: 'RATE'; playbackRate: number; anchor: Anchor }
  | { type: 'PING'; t0: number };

export type InEvent =
  | { type: 'STATE'; state: StatePayload }
  | { type: 'ACK' }
  | { type: 'PING'; serverTimeEpochMs: number }
  | { type: 'HELLO' | 'SCENE_LOAD' }
  | { type: 'ERROR'; message: string };

export function connectWS(url: string, onMessage: (ev: InEvent) => void) {
  const ws = new WebSocket(url);
  ws.onmessage = (m) => onMessage(JSON.parse(m.data));
  return ws;
}

export const nowMs = () => Date.now();

// Create an anchor a little in the future to give clients time to schedule precisely
export function makeAnchor(mediaTimeSec: number, leadMs = 250): Anchor {
  return { serverTimeEpochMs: nowMs() + leadMs, mediaTimeSec };
}
