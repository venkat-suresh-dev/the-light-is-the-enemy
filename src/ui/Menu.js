export class Menu {
  constructor(saveSystem) {
    this.saveSystem = saveSystem;

    this.mainMenu = document.getElementById('main-menu');
    this.introScreen = document.getElementById('intro-screen');
    this.settingsMenu = document.getElementById('settings-menu');
    this.creditsMenu = document.getElementById('credits-menu');
    this.introText = document.getElementById('intro-text');
    this.pauseOverlay = document.getElementById('pause-overlay');

    this.btnPlay = document.getElementById('btn-play');
    this.btnSettings = document.getElementById('btn-settings');
    this.btnCredits = document.getElementById('btn-credits');
    this.btnSettingsBack = document.getElementById('btn-settings-back');
    this.btnCreditsBack = document.getElementById('btn-credits-back');
    this.btnResume = document.getElementById('btn-resume');
    this.btnPauseSettings = document.getElementById('btn-pause-settings');
    this.btnMainMenu = document.getElementById('btn-main-menu');

    this._callbacks = {};
    this._introActive = false;
    this._ready = false;
    this._bindSettings();
  }

  setReady(ready) {
    this._ready = ready;
    if (this.btnPlay) {
      this.btnPlay.disabled = !ready;
      this.btnPlay.style.opacity = ready ? '1' : '0.5';
    }
  }

  get introActive() {
    return this._introActive;
  }

  on(event, callback) {
    this._callbacks[event] = callback;
  }

  _bindSettings() {
    const settings = this.saveSystem.getSettings();

    const setMaster = document.getElementById('set-master');
    const setSfx = document.getElementById('set-sfx');
    const setAmbience = document.getElementById('set-ambience');
    const setShake = document.getElementById('set-shake');
    const setEffects = document.getElementById('set-effects');

    setMaster.value = settings.masterVolume;
    setSfx.value = settings.sfxVolume;
    setAmbience.value = settings.ambienceVolume;
    document.getElementById('val-master').textContent = settings.masterVolume;
    document.getElementById('val-sfx').textContent = settings.sfxVolume;
    document.getElementById('val-ambience').textContent = settings.ambienceVolume;

    setShake.dataset.on = settings.screenShake ? 'true' : 'false';
    setShake.textContent = settings.screenShake ? 'ON' : 'OFF';
    setEffects.dataset.on = settings.visualEffects ? 'true' : 'false';
    setEffects.textContent = settings.visualEffects ? 'ON' : 'OFF';

    const updateSetting = () => {
      const newSettings = {
        masterVolume: parseInt(setMaster.value),
        sfxVolume: parseInt(setSfx.value),
        ambienceVolume: parseInt(setAmbience.value),
        screenShake: setShake.dataset.on === 'true',
        visualEffects: setEffects.dataset.on === 'true',
      };
      this.saveSystem.setSettings(newSettings);
      if (this._callbacks.settingsChanged) {
        this._callbacks.settingsChanged(newSettings);
      }
    };

    setMaster.addEventListener('input', () => {
      document.getElementById('val-master').textContent = setMaster.value;
      updateSetting();
    });
    setSfx.addEventListener('input', () => {
      document.getElementById('val-sfx').textContent = setSfx.value;
      updateSetting();
    });
    setAmbience.addEventListener('input', () => {
      document.getElementById('val-ambience').textContent = setAmbience.value;
      updateSetting();
    });

    const toggle = (btn) => {
      const on = btn.dataset.on !== 'true';
      btn.dataset.on = on ? 'true' : 'false';
      btn.textContent = on ? 'ON' : 'OFF';
      updateSetting();
    };

    setShake.addEventListener('click', () => toggle(setShake));
    setEffects.addEventListener('click', () => toggle(setEffects));

    this.btnPlay.addEventListener('click', () => {
      this._handlePlayClick();
    });
    this.btnSettings.addEventListener('click', () => this.showSettings());
    this.btnCredits.addEventListener('click', () => this.showCredits());
    this.btnSettingsBack.addEventListener('click', () => this.showMain());
    this.btnCreditsBack.addEventListener('click', () => this.showMain());
    this.btnResume.addEventListener('click', () => this._callbacks.resume?.());
    this.btnPauseSettings.addEventListener('click', () => {
      this.hidePause();
      this.showSettings();
    });
    this.btnMainMenu.addEventListener('click', () => this._callbacks.mainMenu?.());
  }

  showMain() {
    this.hideAll();
    this.mainMenu.classList.remove('hidden');
  }

  showSettings() {
    this.hideAll();
    this.settingsMenu.classList.remove('hidden');
  }

  showCredits() {
    this.hideAll();
    this.creditsMenu.classList.remove('hidden');
  }

  showPause() {
    this.pauseOverlay.classList.remove('hidden');
  }

  hidePause() {
    this.pauseOverlay.classList.add('hidden');
  }

  hideAll() {
    this.mainMenu.classList.add('hidden');
    this.introScreen.classList.add('hidden');
    this.settingsMenu.classList.add('hidden');
    this.creditsMenu.classList.add('hidden');
    this.pauseOverlay.classList.add('hidden');
  }

  setPlayEnabled(enabled) {
    if (!this.btnPlay) return;
    this.btnPlay.disabled = !enabled;
    this.btnPlay.style.opacity = enabled ? '1' : '0.5';
  }

  async _handlePlayClick() {
    if (!this.btnPlay || this.btnPlay.disabled) return;
    if (!this._ready) {
      console.warn('[menu] PLAY ignored — game still initializing');
      return;
    }
    const play = this._callbacks.play;
    if (!play) {
      console.error('[menu] PLAY has no handler — was Game._bindMenu() called?');
      return;
    }

    this.setPlayEnabled(false);
    try {
      await play();
    } catch (err) {
      console.error('[menu] PLAY failed:', err);
    } finally {
      this.setPlayEnabled(true);
    }
  }

  async playIntro() {
    this._introActive = true;
    this.hideAll();
    this.introScreen.classList.remove('hidden');

    const lines = [
      { text: 'THE LIGHT IS THE ENEMY', delay: 2000 },
      { text: 'You can\'t see them.', delay: 2000 },
      { text: 'They can see you.', delay: 2000 },
      { text: 'Good luck.', delay: 1500 },
    ];

    let skipped = false;
    const skip = () => { skipped = true; };
    const onKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') skip();
    };
    this.introScreen.addEventListener('click', skip);
    window.addEventListener('keydown', onKey);

    try {
      for (const line of lines) {
        if (skipped) break;
        this.introText.textContent = line.text;
        this.introText.style.opacity = '0';
        await this._wait(300);
        if (skipped) break;
        this.introText.style.opacity = '1';
        await this._wait(line.delay);
        if (skipped) break;
        this.introText.style.opacity = '0';
        await this._wait(500);
      }
    } finally {
      this.introScreen.removeEventListener('click', skip);
      window.removeEventListener('keydown', onKey);
      this.introScreen.classList.add('hidden');
      this._introActive = false;
    }
  }

  _wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
