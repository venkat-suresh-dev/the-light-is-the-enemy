/**
 * Web Audio bus mixing — MASTER → AMBIENCE / ATMOSPHERE / PLAYER / ENEMY / HEARTBEAT / UI
 */
export class AudioMixer {
  constructor(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);

    this.buses = {
      ambience: this._createBus(0.72),
      music: this._createBus(0.68),
      atmosphere: this._createBus(0),
      player: this._createBus(0.82),
      enemy: this._createBus(0.82),
      heartbeat: this._createBus(1.42),
      breathing: this._createBus(0.78),
      sfx: this._createBus(1.0),
      ui: this._createBus(0.78),
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

  setBusTarget(name, vol, timeConstant = 0.6) {
    if (!this.buses[name]) return;
    const floors = {
      ambience: 0.06,
      player: 0.18,
      enemy: 0.14,
      heartbeat: 0.72,
      breathing: 0.08,
      atmosphere: 0.04,
      sfx: 0.45,
      ui: 0.1,
    };
    const floor = floors[name] ?? 0;
    const next = Math.max(floor, vol);
    this.buses[name].gain.setTargetAtTime(next, this.ctx.currentTime, timeConstant);
  }

  getBusGain(name) {
    const node = this.buses[name] || this.master;
    return node.gain.value;
  }

  getDebugSnapshot() {
    const snap = { master: this.master.gain.value };
    for (const name of ['ambience', 'music', 'atmosphere', 'player', 'enemy', 'heartbeat', 'breathing', 'sfx', 'ui']) {
      snap[name] = this.buses[name] ? this.buses[name].gain.value : 0;
    }
    return snap;
  }

  getBus(name) {
    return this.buses[name] || this.master;
  }
}
