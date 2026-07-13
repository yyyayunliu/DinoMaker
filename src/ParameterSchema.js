export const FALLBACK_PARAMETER_PAYLOAD = {
  generator: 'trex_rigged_generator.py',
  action: 'Dino_Walk_Cycle',
  frame_start: 1,
  frame_end: 48,
  parameters: {
    dinosaur_length: { label: 'Dinosaur length', min: 5.2, max: 9.0, default: 7.0, step: 0.1 },
    body_height: { label: 'Body height', min: 4.4, max: 8.8, default: 6.0, step: 0.05 },
    body_width: { label: 'Body width', min: 1.3, max: 3.1, default: 2.0, step: 0.02 },
    torso_length: { label: 'Torso length', min: 1.7, max: 3.0, default: 2.35, step: 0.05 },
    pelvis_size: { label: 'Pelvis size', min: 0.65, max: 1.35, default: 1.0, step: 0.02 },
    neck_length: { label: 'Neck length', min: 0.1, max: 10.0, default: 0.95, step: 0.02 },
    head_size: { label: 'Head size', min: 0.7, max: 1.45, default: 1.0, step: 0.02 },
    jaw_length: { label: 'Jaw length', min: 0.65, max: 1.45, default: 1.0, step: 0.02 },
    jaw_open_angle: { label: 'Jaw open angle', min: 0.0, max: 18.0, default: 3.0, step: 0.5 },
    tail_length: { label: 'Tail length', min: 0.75, max: 1.45, default: 1.0, step: 0.02 },
    tail_thickness: { label: 'Tail thickness', min: 0.65, max: 1.35, default: 1.0, step: 0.02 },
    leg_length: { label: 'Leg length', min: 0.75, max: 1.35, default: 1.0, step: 0.02 },
    thigh_thickness: { label: 'Thigh thickness', min: 0.7, max: 1.45, default: 1.0, step: 0.02 },
    foot_size: { label: 'Foot size', min: 0.7, max: 1.5, default: 1.0, step: 0.02 },
    arm_length: { label: 'Arm length', min: 0.55, max: 1.35, default: 0.9, step: 0.02 },
    arm_thickness: { label: 'Arm thickness', min: 0.6, max: 1.4, default: 0.9, step: 0.02 },
    claw_size: { label: 'Claw size', min: 0.55, max: 1.6, default: 1.0, step: 0.02 },
    tooth_size: { label: 'Tooth size', min: 0.45, max: 1.5, default: 1.0, step: 0.02 },
    eye_size: { label: 'Eye size', min: 0.6, max: 1.35, default: 1.0, step: 0.02 },
    skin_color: { label: 'Skin color', type: 'color', default: '#3a5c32' },
    belly_color: { label: 'Belly color', type: 'color', default: '#b9c96f' },
    scale_texture_strength: { label: 'Scale texture strength', min: 0.0, max: 1.0, default: 0.65, step: 0.01 },
    bump_strength: { label: 'Bump strength', min: 0.0, max: 0.22, default: 0.08, step: 0.005 },
    voxel_size: { label: 'Resolution', min: 0.01, max: 0.2, default: 0.095, step: 0.005 },
    walk_speed: { label: 'Walk speed', min: 0.45, max: 1.9, default: 1.0, step: 0.05 },
    walk_stride: { label: 'Walk stride', min: 0.18, max: 0.65, default: 0.38, step: 0.01 },
    walk_bob: { label: 'Walk bob', min: 0.02, max: 0.22, default: 0.08, step: 0.005 },
    tail_swing: { label: 'Tail swing', min: 0.05, max: 0.42, default: 0.22, step: 0.01 },
    head_bob: { label: 'Head bob', min: 0.02, max: 0.22, default: 0.08, step: 0.005 },
  },
};

const PARAMETER_RANGE_OVERRIDES = {
  dinosaur_length: { min: 5.0, max: 9.5, step: 0.1 },
  body_height: { min: 4.4, max: 8.8, default: 6.0, step: 0.05 },
  body_width: { min: 1.3, max: 3.1, step: 0.02 },
  torso_length: { min: 1.65, max: 3.25, step: 0.05 },
  pelvis_size: { min: 0.65, max: 1.4, step: 0.02 },
  neck_length: { min: 0.1, max: 10.0, step: 0.02 },
  head_size: { min: 0.7, max: 1.55, step: 0.02 },
  jaw_length: { min: 0.65, max: 1.65, step: 0.02 },
  jaw_open_angle: { min: 0, max: 60, step: 1 },
  tail_length: { min: 0.75, max: 1.55, step: 0.02 },
  tail_thickness: { min: 0.55, max: 1.45, step: 0.02 },
  leg_length: { min: 0.75, max: 1.45, step: 0.02 },
  thigh_thickness: { min: 0.7, max: 1.6, step: 0.02 },
  foot_size: { min: 0.7, max: 1.6, step: 0.02 },
  arm_length: { min: 0.45, max: 1.45, step: 0.02 },
  arm_thickness: { min: 0.5, max: 1.5, step: 0.02 },
  claw_size: { min: 0.4, max: 1.8, step: 0.02 },
  tooth_size: { min: 0.35, max: 1.7, step: 0.02 },
  eye_size: { min: 0.55, max: 1.45, step: 0.02 },
  scale_texture_strength: { min: 0, max: 1.25, step: 0.01 },
  bump_strength: { min: 0, max: 0.35, step: 0.005 },
  voxel_size: { label: 'Resolution', min: 0.01, max: 0.2, step: 0.005 },
  walk_speed: { min: 0.05, max: 1.0, default: 0.45, step: 0.05 },
  walk_stride: { min: 0.08, max: 0.7, step: 0.01 },
  walk_bob: { min: 0, max: 0.1, default: 0.02, step: 0.005 },
  tail_swing: { min: 0, max: 0.5, step: 0.01 },
  head_bob: { min: 0, max: 0.3, step: 0.01 },
};

export async function loadParameterPayload() {
  try {
    const response = await fetch('models/dino_parameters.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return normalizeParameterPayload(await response.json());
  } catch (error) {
    console.warn('Using bundled fallback DinoMaker parameter schema.', error);
    return normalizeParameterPayload(FALLBACK_PARAMETER_PAYLOAD);
  }
}

function normalizeParameterPayload(payload) {
  const next = JSON.parse(JSON.stringify(payload));
  Object.entries(PARAMETER_RANGE_OVERRIDES).forEach(([key, override]) => {
    if (!next.parameters[key]) return;
    next.parameters[key] = { ...next.parameters[key], ...override };
    if (override.default !== undefined) {
      next.parameters[key].default = override.default;
      if (next.defaults) next.defaults[key] = override.default;
    }
  });
  return next;
}

export function defaultsFromSchema(schema) {
  return Object.fromEntries(
    Object.entries(schema.parameters).map(([key, spec]) => [key, schema.defaults?.[key] ?? spec.default]),
  );
}

export function clampParams(schema, params) {
  const clamped = {};
  Object.entries(schema.parameters).forEach(([key, spec]) => {
    const value = params[key] ?? spec.default;
    if (spec.type === 'color') {
      clamped[key] = value;
      return;
    }
    clamped[key] = Math.min(spec.max, Math.max(spec.min, Number(value)));
  });
  return clamped;
}

export function randomizeParams(schema) {
  const next = {};
  Object.entries(schema.parameters).forEach(([key, spec]) => {
    if (spec.type === 'color') {
      next[key] = randomSkinColor(key);
      return;
    }
    const t = Math.random();
    const safeT = 0.18 + t * 0.64;
    next[key] = roundToStep(spec.min + (spec.max - spec.min) * safeT, spec.step || 0.01);
  });

  // Keep broad anatomy plausible after full randomization.
  next.leg_length = Math.max(next.leg_length, next.body_height > 3.5 ? 0.95 : 0.85);
  next.neck_length = Math.min(next.neck_length, next.dinosaur_length > 6.2 ? 4.0 : 3.0);
  next.tail_length = Math.max(next.tail_length, 0.9);
  next.foot_size = Math.max(next.foot_size, 0.86);
  return clampParams(schema, next);
}

function randomSkinColor(key) {
  const palettes = {
    skin_color: ['#345f33', '#59633b', '#6a6042', '#3d5a50', '#6f6b57'],
    belly_color: ['#b9c96f', '#c4d58a', '#d0d798', '#b7cd75', '#d7d9a0'],
  };
  const choices = palettes[key] || ['#3a5c32'];
  return choices[Math.floor(Math.random() * choices.length)];
}

function roundToStep(value, step) {
  return Number((Math.round(value / step) * step).toFixed(4));
}
