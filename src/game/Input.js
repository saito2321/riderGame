import { CONFIG as C, clamp } from './config.js';
export class Input {
  constructor(canvas, position) {
    this.canvas = canvas; this.position = position; this.enabled = false; this.target = 0; this.axis = 0; this.keys = new Set(); this.pointer = null;
    canvas.addEventListener('pointerdown', e => {
      if (!this.enabled || this.pointer !== null || e.button !== 0) return;
      this.pointer = e.pointerId; this.lastX = e.clientX; this.target = position();
      canvas.setPointerCapture(e.pointerId); e.preventDefault();
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.enabled || e.pointerId !== this.pointer) return;
      this.target = clamp(this.target + (e.clientX - this.lastX) / canvas.clientWidth * C.roadWidth * C.sensitivity, -C.edge, C.edge);
      this.lastX = e.clientX;
    });
    const release = e => { if (e.pointerId === this.pointer) this.pointer = null; };
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', () => this.clear()); canvas.addEventListener('lostpointercapture', release);
    window.addEventListener('keydown', e => {
      if (!this.enabled || !['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)) return;
      e.preventDefault(); this.keys.add(e.code); this.updateAxis();
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); this.updateAxis(); });
    window.addEventListener('resize', () => this.clear()); window.addEventListener('blur', () => this.clear());
  }
  updateAxis() { this.axis = Number(this.keys.has('ArrowRight') || this.keys.has('KeyD')) - Number(this.keys.has('ArrowLeft') || this.keys.has('KeyA')); }
  clear() { if (this.pointer !== null && this.canvas.hasPointerCapture(this.pointer)) this.canvas.releasePointerCapture(this.pointer); this.pointer = null; this.keys.clear(); this.axis = 0; this.target = this.position(); }
  setEnabled(enabled) { this.enabled = enabled; this.clear(); }
}
