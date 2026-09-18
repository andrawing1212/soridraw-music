export type SplitPointerPredictionState = {
  x: number | null;
  timeStamp: number | null;
};

type PredictivePointerEvent = PointerEvent & {
  getCoalescedEvents?: () => PointerEvent[];
  getPredictedEvents?: () => PointerEvent[];
};

const FAST_MOUSE_SPEED_PX_PER_MS = 0.55;
const PREDICTION_LOOKAHEAD_MS = 6;
const MAX_PREDICTED_LEAD_PX = 10;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Keep confirmed pointer data authoritative, but use the browser's earliest
 * near-future mouse prediction only when movement is already fast and the
 * predicted direction agrees with the confirmed trajectory.
 *
 * This is deliberately mouse-only. Touch/pen keep their existing verified path.
 */
export const resolveConfirmedSplitClientX = (nativeEvent: PointerEvent): number => {
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

  return confirmedEvent.clientX;
};

export const resolveLowLatencySplitClientX = (
  nativeEvent: PointerEvent,
  state: SplitPointerPredictionState,
  allowPrediction = true,
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

  if (!allowPrediction || event.pointerType !== 'mouse' || previousX === null || previousTime === null) {
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


export type SplitMotionFastState = {
  value: number | null;
  timeStamp: number | null;
  fast: boolean;
  slowSince: number | null;
};

// 708 — velocity hysteresis for hybrid drag ownership. The old 668/683 path
// looked more even during genuinely fast motion, while the 705~707 close-gap
// path feels better at normal/slow speeds. Keep a wide neutral band so the
// engine does not flap between the two paths on every small speed change.
const FAST_MODE_ENTER_PX_PER_MS = 0.85;
const FAST_MODE_EXIT_PX_PER_MS = 0.38;
const FAST_MODE_EXIT_HOLD_MS = 90;

export const updateSplitMotionFastMode = (
  value: number,
  timeStamp: number,
  state: SplitMotionFastState,
): boolean => {
  const now = Number.isFinite(timeStamp) ? timeStamp : performance.now();
  const previousValue = state.value;
  const previousTime = state.timeStamp;
  state.value = value;
  state.timeStamp = now;

  if (previousValue === null || previousTime === null) return state.fast;

  const dt = Math.max(1, now - previousTime);
  const speed = Math.abs(value - previousValue) / dt;

  if (!state.fast) {
    if (speed >= FAST_MODE_ENTER_PX_PER_MS) {
      state.fast = true;
      state.slowSince = null;
    }
    return state.fast;
  }

  if (speed <= FAST_MODE_EXIT_PX_PER_MS) {
    if (state.slowSince === null) state.slowSince = now;
    if (now - state.slowSince >= FAST_MODE_EXIT_HOLD_MS) {
      state.fast = false;
      state.slowSince = null;
    }
  } else {
    state.slowSince = null;
  }

  return state.fast;
};

export const resetSplitMotionFastMode = (state: SplitMotionFastState) => {
  state.value = null;
  state.timeStamp = null;
  state.fast = false;
  state.slowSince = null;
};


// 709 — large-jump guard. Slow/normal motion should remain exact, but a sparse
// fast pointer/resize burst must not be rendered as one 100~300px visual jump.
// Cap only abnormally large single-frame corrections and keep ticking toward
// the latest target. The frame delta is capped so a stalled frame cannot turn
// into an even larger catch-up jump on the next paint.
const JUMP_GUARD_THRESHOLD_PX = 72;
const JUMP_GUARD_RATE_PX_PER_MS = 3.0; // ~= 3000px/s
const JUMP_GUARD_MIN_STEP_PX = 18;
const JUMP_GUARD_MAX_STEP_PX = 56;
const JUMP_GUARD_MAX_FRAME_MS = 16.667;
const JUMP_GUARD_TARGET_BAND_PX = 18;

export const followSplitTargetWithJumpGuard = (
  current: number,
  target: number,
  previousFrameTime: number | null,
  frameTime: number,
): number => {
  const delta = target - current;
  const distance = Math.abs(delta);
  if (distance <= JUMP_GUARD_THRESHOLD_PX) return target;

  const dt = previousFrameTime === null
    ? JUMP_GUARD_MAX_FRAME_MS
    : clamp(frameTime - previousFrameTime, 1, JUMP_GUARD_MAX_FRAME_MS);
  const cadenceStep = clamp(
    JUMP_GUARD_RATE_PX_PER_MS * dt,
    JUMP_GUARD_MIN_STEP_PX,
    JUMP_GUARD_MAX_STEP_PX,
  );
  const bandStep = Math.max(0, distance - JUMP_GUARD_TARGET_BAND_PX);
  const step = Math.min(distance, Math.max(cadenceStep, Math.min(bandStep, JUMP_GUARD_MAX_STEP_PX)));
  return current + Math.sign(delta) * step;
};
