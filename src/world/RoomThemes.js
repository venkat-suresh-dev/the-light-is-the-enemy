export const ROOM_THEME = {
  MAINTENANCE: 'MAINTENANCE',
  STORAGE: 'STORAGE',
  OFFICE: 'OFFICE',
  INDUSTRIAL: 'INDUSTRIAL',
  TUNNEL: 'TUNNEL',
  GENERATOR: 'GENERATOR',
  LAB: 'LAB',
};

export const THEME_ORDER = [
  ROOM_THEME.TUNNEL,
  ROOM_THEME.STORAGE,
  ROOM_THEME.MAINTENANCE,
  ROOM_THEME.OFFICE,
  ROOM_THEME.INDUSTRIAL,
  ROOM_THEME.GENERATOR,
  ROOM_THEME.LAB,
];

export const THEME_META = {
  [ROOM_THEME.MAINTENANCE]: {
    label: 'MAINTENANCE LEVEL',
    decorTypes: ['pipe', 'vent', 'generator', 'fusebox', 'cable', 'wire', 'warning_stripe', 'crate', 'maintenance_panel', 'damaged_floor'],
    decorDensity: 0.07,
    floorMaterial: 'concrete',
    accentColor: '#C94B4B',
  },
  [ROOM_THEME.STORAGE]: {
    label: 'STORAGE AREA',
    decorTypes: ['crate', 'shelf', 'box', 'barrel', 'table', 'stain', 'debris', 'broken'],
    decorDensity: 0.09,
    floorMaterial: 'concrete',
    accentColor: '#8B9199',
  },
  [ROOM_THEME.OFFICE]: {
    label: 'OFFICE BLOCK',
    decorTypes: ['desk', 'chair', 'cabinet', 'monitor', 'paper', 'crate', 'stain', 'broken'],
    decorDensity: 0.06,
    floorMaterial: 'tile',
    accentColor: '#6A8FBF',
  },
  [ROOM_THEME.INDUSTRIAL]: {
    label: 'INDUSTRIAL ZONE',
    decorTypes: ['machinery', 'pipe', 'generator', 'cable', 'wire', 'warning_stripe', 'barrel', 'maintenance_panel', 'debris'],
    decorDensity: 0.07,
    floorMaterial: 'metal',
    accentColor: '#D9A441',
  },
  [ROOM_THEME.TUNNEL]: {
    label: 'SERVICE TUNNEL',
    decorTypes: ['pipe', 'vent', 'cable', 'wire', 'warning_stripe', 'barrel', 'stain', 'damaged_floor'],
    decorDensity: 0.05,
    floorMaterial: 'concrete',
    accentColor: '#8B9199',
  },
  [ROOM_THEME.GENERATOR]: {
    label: 'GENERATOR ROOM',
    decorTypes: ['generator', 'fusebox', 'pipe', 'machinery', 'warning_stripe', 'cable', 'wire', 'maintenance_panel', 'toolbox'],
    decorDensity: 0.08,
    floorMaterial: 'metal',
    accentColor: '#D9A441',
  },
  [ROOM_THEME.LAB]: {
    label: 'RESEARCH LAB',
    decorTypes: ['cabinet', 'monitor', 'desk', 'crate', 'vent', 'paper', 'wire', 'stain'],
    decorDensity: 0.06,
    floorMaterial: 'tile',
    accentColor: '#6A9FBF',
  },
};

export const LANDMARK_TYPES = [
  'red_pipe',
  'emergency_light',
  'large_generator',
  'pillar',
  'shelf_wall',
  'warning_sign',
  'electrical_panel',
  'damaged_wall',
  'conduit_run',
];
