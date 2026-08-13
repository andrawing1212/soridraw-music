export type SplitPointerPredictionState = {
  x: number | null;
  timeStamp: number | null;
};

type PredictivePointerEvent = PointerEvent & {
  getCoalescedEvents?: () => PointerEvent[];
  getPredictedEvents?: () => PointerEvent[];
};

const FAST_MOUSE_SPEED_PX_PER_MS = 0.55;
const PREDICTION_LOOKAHEAD_MS = 10;
const MAX_PREDICTED_LEAD_PX = 18;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Keep confirmed pointer data authoritative, but use the browser's earliest
 * near-future mouse prediction only when movement is already fast and the
 * predicted direction agrees with the confirmed trajectory.
 *
 * This is deliberately mouse-only. Touch/pen keep their existing verified path.
 */
export const resolveLowLatencySplitClientX = (
  nativeEvent: PointerEvent,
  state: SplitPointerPredictionState,
): number => {
  const event = nativeEvent as PredictivePointerEvent;
  let confirmedEvent: PointerEvent = event;

  if (event.pointerType === 'mouse') {
    try {
      const coalesced = event.getCoalescedEvents?.() || [];
      if (coalesced.length > 0) confirmedEvent = coalesced[coalesced.length - 1];
    } catch {
      // Browser support is optional. Confirmed parent event remains authoritative.
    }
  }

  const confirmedX = confirmedEvent.clientX;
  const confirmedTime = Number.isFinite(confirmedEvent.timeStamp)
    ? confirmedEvent.timeStamp
    : performance.now();
  const previousX = state.x;
  const previousTime = state.timeStamp;
  state.x = confirmedX;
  state.timeStamp = confirmedTime;

  if (event.pointerType !== 'mouse' || previousX === null || previousTime === null) {
    return confirmedX;
  }

  const dt = Math.max(1, confirmedTime - previousTime);
  const dx = confirmedX - previousX;
  const speed = Math.abs(dx) / dt;
  if (Math.abs(dx) < 1 || speed < FAST_MOUSE_SPEED_PX_PER_MS) return confirmedX;

  let predicted: PointerEvent[] = [];
  try {
    predicted = event.getPredictedEvents?.() || [];
  } catch {
    predicted = [];
  }
  if (predicted.length === 0) return confirmedX;

  const desiredTime = confirmedTime + PREDICTION_LOOKAHEAD_MS;
  let candidate = predicted[0];
  let candidateDistance = Math.abs(candidate.timeStamp - desiredTime);
  for (let index = 1; index < predicted.length; index += 1) {
    const next = predicted[index];
    const distance = Math.abs(next.timeStamp - desiredTime);
    if (distance < candidateDistance) {
      candidate = next;
      candidateDistance = distance;
    }
  }

  const predictedDelta = candidate.clientX - confirmedX;
  if (!Number.isFinite(predictedDelta) || predictedDelta === 0) return confirmedX;
  if (Math.sign(predictedDelta) !== Math.sign(dx)) return confirmedX;

  const boundedLead = clamp(predictedDelta, -MAX_PREDICTED_LEAD_PX, MAX_PREDICTED_LEAD_PX);
  return confirmedX + boundedLead;
};

export const resetSplitPointerPrediction = (state: SplitPointerPredictionState) => {
  state.x = null;
  state.timeStamp = null;
};
