/**
 * Web Audio bus mixing — MASTER → AMBIENCE / PLAYER / ENEMY / UI / MUSIC
 */
export class AudioMixer {
  constructor(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);

    this.buses = {
      ambience: this._createBus(0.7),
      player: this._createBus(0.9),
      enemy: this._createBus(0.85),
      ui: this._createBus(0.9),
      music: this._createBus(0.5),
    };
  }

  _createBus(volume) {
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    gain.connect(this.master);
    return gain;
  }

  setMaster(vol) {
    this.master.gain.value = vol;
  }

  setBus(name, vol) {
    if (this.buses[name]) this.buses[name].gain.value = vol;
  }

  getBus(name) {
    return this.buses[name] || this.master;
  }
}
