import { clampParams, defaultsFromSchema, randomizeParams } from './ParameterSchema.js';

export class DinoUI {
  constructor(schema, params, handlers) {
    this.schema = schema;
    this.params = { ...params };
    this.handlers = handlers;
    this.inputs = new Map();
    this.values = new Map();
    this.panel = document.querySelector('#control-list');
    this.randomizeButton = document.querySelector('#randomize-btn');
    this.resetButton = document.querySelector('#reset-btn');
    this.playButton = document.querySelector('#play-btn');
    this.roarButton = document.querySelector('#roar-btn');
    this.modeButton = document.querySelector('#mesh-mode-btn');
    this.autoRotateButton = document.querySelector('#auto-rotate-btn');
    this.downloadButton = document.querySelector('#download-obj-btn');
    this.downloadGlbLink = document.querySelector('#download-glb-link');
    this.status = document.querySelector('#status-line');
    this.meshMode = 'smooth';
    this.build();
  }

  build() {
    this.panel.innerHTML = '';
    const parameterEntries = Object.entries(this.schema.parameters).sort(([keyA], [keyB]) => {
      if (keyA === 'voxel_size') return -1;
      if (keyB === 'voxel_size') return 1;
      return 0;
    });
    parameterEntries.forEach(([key, spec]) => {
      const row = document.createElement('label');
      row.className = spec.type === 'color' ? 'control-row color-row' : 'control-row';
      row.innerHTML = `
        <span class="control-copy">
          <span>${spec.label}</span>
          <strong data-value="${key}"></strong>
        </span>
      `;

      const input = document.createElement('input');
      input.name = key;
      if (spec.type === 'color') {
        input.type = 'color';
        input.value = this.params[key];
      } else {
        input.type = 'range';
        input.min = spec.min;
        input.max = spec.max;
        input.step = 'any';
        input.value = this.params[key];
      }

      input.addEventListener('input', () => {
        this.params[key] = spec.type === 'color' ? input.value : Number(input.value);
        this.updateReadout(key);
        this.handlers.onChange?.(clampParams(this.schema, this.params));
      });

      row.appendChild(input);
      this.panel.appendChild(row);
      this.inputs.set(key, input);
      this.values.set(key, row.querySelector('[data-value]'));
      this.updateReadout(key);
    });

    this.randomizeButton.addEventListener('click', () => {
      this.setParams(randomizeParams(this.schema));
      if (this.status) this.status.textContent = 'Randomized a plausible T-Rex variant.';
    });

    this.resetButton.addEventListener('click', () => {
      this.setParams(defaultsFromSchema(this.schema));
      if (this.status) this.status.textContent = 'Reset to the Blender generator defaults.';
    });

    this.playButton.addEventListener('click', () => {
      const active = this.playButton.getAttribute('aria-pressed') !== 'true';
      this.setMotionButtons(active ? 'walk' : 'rest');
      this.handlers.onRoarToggle?.(false);
      this.handlers.onPlayToggle?.(active);
    });

    this.roarButton?.addEventListener('click', () => {
      const active = this.roarButton.getAttribute('aria-pressed') !== 'true';
      this.setMotionButtons(active ? 'roar' : 'rest');
      this.handlers.onPlayToggle?.(false);
      this.handlers.onRoarToggle?.(active);
    });

    this.modeButton?.addEventListener('click', () => {
      this.meshMode = this.meshMode === 'smooth' ? 'voxel' : 'smooth';
      this.modeButton.setAttribute('aria-pressed', String(this.meshMode === 'voxel'));
      this.modeButton.querySelector('span').textContent = this.meshMode === 'voxel' ? 'Smooth Dino' : 'Voxel Dino';
      this.handlers.onModeToggle?.(this.meshMode);
    });

    this.autoRotateButton?.addEventListener('click', () => {
      const active = this.autoRotateButton.getAttribute('aria-pressed') !== 'true';
      this.autoRotateButton.setAttribute('aria-pressed', String(active));
      this.autoRotateButton.querySelector('span').textContent = `Auto Rotate: ${active ? 'On' : 'Off'}`;
      this.handlers.onAutoRotateToggle?.(active);
    });

    this.downloadButton.addEventListener('click', () => this.handlers.onDownloadObj?.());
    if (this.downloadGlbLink) this.downloadGlbLink.href = '/models/trex_rigged_walk.glb';
  }

  setParams(params) {
    this.params = clampParams(this.schema, params);
    this.inputs.forEach((input, key) => {
      input.value = this.params[key];
      this.updateReadout(key);
    });
    this.handlers.onChange?.(this.params);
  }

  setMotionButtons(motion) {
    const walking = motion === 'walk';
    const roaring = motion === 'roar';
    this.playButton.setAttribute('aria-pressed', String(walking));
    this.playButton.querySelector('span').textContent = walking ? 'Pause walk' : 'Play walk';
    if (this.roarButton) {
      this.roarButton.setAttribute('aria-pressed', String(roaring));
      this.roarButton.querySelector('span').textContent = roaring ? 'Stop roar' : 'Roar';
    }
  }

  updateReadout(key) {
    const spec = this.schema.parameters[key];
    const output = this.values.get(key);
    if (!output) return;
    if (spec.type === 'color') {
      output.textContent = this.params[key];
    } else {
      output.textContent = Number(this.params[key]).toFixed(spec.step && spec.step < 0.01 ? 3 : 2);
    }
  }
}
