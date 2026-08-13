export const CONFIG = {
  world: {
    tileSize: 32,
    roomWidth: 40,
    roomHeight: 30,
    viewWidth: 1280,
    viewHeight: 720,
  },

  player: {
    radius: 10,
    collisionMargin: 0.5,
    speed: 145,
    sprintSpeed: 225,
    stamina: 100,
    staminaDrain: 32,
    staminaRegen: 22,
    acceleration: 1300,
    friction: 920,
    rotationSpeed: 16,
  },

  lighting: {
    ambientStrength: 0.09,
    ambientPlayerRadius: 70,
    darknessOpacity: 0.9,
    darknessColor: '3, 5, 8',
    deepShadowOpacity: 0.95,
    mobileBrightnessBoost: 1.08,
  },

  flashlight: {
    range: 400,
    broadRange: 500,
    spillRange: 600,
    fov: Math.PI / 2.2,
    broadFov: Math.PI / 1.55,
    spillFov: Math.PI / 1.25,
    focusedFov: Math.PI / 5,
    intensity: 1,
    battery: 100,
    drainRate: 3.2,
    rechargeRate: 10,
    flickerAmount: 0.04,
    angleSmoothing: 16,
    innerAngle: Math.PI / 5,
    warmColor: '#FFF4D6',
    warmCore: '#FFFBE8',
    bloomStrength: 0.42,
  },

  enemy: {
    radius: 14,
    walkSpeed: 45,
    chaseSpeed: 85,
    huntSpeed: 70,
    detectionTime: 0.8,
    alertTime: 0.5,
    searchTime: 6,
    lostTime: 3,
    attackRange: 18,
    attackTime: 0.3,
  },

  audio: {
    masterVolume: 0.8,
    sfxVolume: 0.9,
    ambienceVolume: 0.7,
  },

  effects: {
    screenShake: true,
    visualEffects: true,
    grainIntensity: 0.035,
    vignetteIntensity: 0.4,
    cameraSmoothing: 10,
  },

  difficulty: {
    baseEnemyCount: 1,
    maxEnemyCount: 3,
    speedScalePerRoom: 0.04,
    batteryDrainScale: 0.015,
    earlyRoomBatteryMultiplier: 0.55,
    earlyRoomCount: 3,
  },

  timing: {
    maxDeltaTime: 0.05,
    introDelay: 1.5,
    deathDelay: 2.5,
    roomTransition: 1.8,
  },

  colors: {
    background: '#050607',
    wall: '#1B2026',
    wallInner: '#151A20',
    wallEdge: '#2A3038',
    wallHighlight: '#343A42',
    floor: '#11151A',
    floorAlt: '#0E1217',
    floorLine: '#1A2028',
    metal: '#343A42',
    object: '#252B32',
    objectHighlight: '#2F363F',
    shadow: '#000000',
    flashlight: '#FFF4D6',
    flashlightCore: '#FFFBE8',
    danger: '#C94B4B',
    emergency: '#C94B4B',
    ui: '#E6E6E6',
    uiSecondary: '#8B9199',
    enemy: '#060606',
    enemyEyes: '#B8A080',
    playerCoat: '#30363D',
    playerSecondary: '#20252A',
    playerSkin: '#4A4F55',
    objective: '#D9D2B0',
    exit: '#7FBF8A',
    exitGlow: '#5A9A64',
    decor: '#252B32',
    power: '#D9A441',
    lab: '#6A9FBF',
  },
};

export const TILE = {
  EMPTY: 0,
  WALL: 1,
  FLOOR: 2,
  EXIT: 3,
  OBJECTIVE: 4,
  DECOR: 5,
};

export const GAME_STATE = {
  BOOT: 'BOOT',
  MENU: 'MENU',
  INTRO: 'INTRO',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  DEAD: 'DEAD',
  TRANSITIONING: 'TRANSITIONING',
};

export const ENEMY_STATE = {
  DORMANT: 'DORMANT',
  ILLUMINATED: 'ILLUMINATED',
  ALERT: 'ALERT',
  HUNTING: 'HUNTING',
  SEARCHING: 'SEARCHING',
  LOST: 'LOST',
};

export const OBJECTIVE_TYPE = {
  FIND_FUSE: 'FIND_FUSE',
  ACTIVATE_GENERATOR: 'ACTIVATE_GENERATOR',
  COLLECT_KEY: 'COLLECT_KEY',
  FIND_EXIT_CODE: 'FIND_EXIT_CODE',
};

export const OBJECTIVE_HINTS = {
  [OBJECTIVE_TYPE.FIND_FUSE]: 'Maintenance equipment may contain one.',
  [OBJECTIVE_TYPE.ACTIVATE_GENERATOR]: 'Look near the starting area.',
  [OBJECTIVE_TYPE.COLLECT_KEY]: 'Check desks and cabinets.',
  [OBJECTIVE_TYPE.FIND_EXIT_CODE]: 'Office terminals may have it.',
};
