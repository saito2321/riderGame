export class RenderQuality {
  constructor(deviceDpr = 1) {
    this.max = Math.max(1, Math.min(Number.isFinite(deviceDpr) ? deviceDpr : 1, 2));
    this.min = Math.min(this.max, .75);
    this.ratio = Math.min(this.max, 1.5);
    this.fastSeconds = 0;
    this.slowSeconds = 0;
    this.cooldown = 0;
  }

  observe(frameDt) {
    if (!(frameDt > 0 && frameDt < .2)) return null;
    this.cooldown = Math.max(0, this.cooldown - frameDt);
    if (frameDt > 1 / 45) {
      this.slowSeconds += frameDt;
      this.fastSeconds = 0;
    } else if (frameDt <= 1 / 55) {
      this.fastSeconds += frameDt;
      this.slowSeconds = Math.max(0, this.slowSeconds - frameDt);
    } else {
      this.fastSeconds = 0;
      this.slowSeconds = Math.max(0, this.slowSeconds - frameDt);
    }
    if (this.slowSeconds >= 1.5 && this.ratio > this.min) {
      this.ratio = Math.max(this.min, this.ratio - .25);
      this.fastSeconds = this.slowSeconds = 0;
      this.cooldown = 4;
      return this.ratio;
    }
    if (this.fastSeconds >= 6 && !this.cooldown && this.ratio < this.max) {
      this.ratio = Math.min(this.max, this.ratio + .25);
      this.fastSeconds = this.slowSeconds = 0;
      this.cooldown = 4;
      return this.ratio;
    }
    return null;
  }
}
