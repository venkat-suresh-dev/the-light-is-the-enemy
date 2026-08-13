const SAVE_KEY = 'tlite_save';
const SAVE_VERSION = 1;

const DEFAULT_SAVE = {
  version: SAVE_VERSION,
  bestRoom: 0,
  bestTime: 0,
  settings: {
    masterVolume: 80,
    sfxVolume: 90,
    ambienceVolume: 70,
    screenShake: true,
    visualEffects: true,
  },
};

export class SaveSystem {
  constructor() {
    this.data = { ...DEFAULT_SAVE, settings: { ...DEFAULT_SAVE.settings } };
    this.available = true;
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.version === SAVE_VERSION) {
          this.data = { ...DEFAULT_SAVE, ...parsed, settings: { ...DEFAULT_SAVE.settings, ...parsed.settings } };
        }
      }
    } catch (e) {
      this.available = false;
      console.warn('localStorage unavailable');
    }
  }

  save() {
    if (!this.available) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      this.available = false;
    }
  }

  updateBest(room, time) {
    if (room > this.data.bestRoom) this.data.bestRoom = room;
    if (time > this.data.bestTime) this.data.bestTime = time;
    this.save();
  }

  getSettings() {
    return this.data.settings;
  }

  setSettings(settings) {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
  }
}
