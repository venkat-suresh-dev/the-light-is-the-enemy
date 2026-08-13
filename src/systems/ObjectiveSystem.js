import { OBJECTIVE_TYPE, OBJECTIVE_HINTS } from '../utils/Constants.js';

const OBJECTIVE_TEXT = {
  [OBJECTIVE_TYPE.FIND_FUSE]: 'Find the fuse',
  [OBJECTIVE_TYPE.ACTIVATE_GENERATOR]: 'Activate the generator',
  [OBJECTIVE_TYPE.COLLECT_KEY]: 'Find the key',
  [OBJECTIVE_TYPE.FIND_EXIT_CODE]: 'Find the exit code',
};

const PHASE_HINTS = {
  activate: 'Return to the generator near your entry point.',
  escape: 'The exit door should be marked with green light.',
};

export class ObjectiveSystem {
  constructor(events) {
    this.events = events;
    this.type = OBJECTIVE_TYPE.FIND_FUSE;
    this.completed = false;
    this.phase = 'find';
    this.room = null;
  }

  setup(room, roomNumber) {
    this.room = room;
    this.completed = false;
    const types = Object.values(OBJECTIVE_TYPE);
    this.type = types[Math.min(roomNumber - 1, types.length - 1)];
    this.phase = 'find';

    this.events.emit('objectiveUpdated', {
      text: this.getObjectiveText(),
      hint: this.getObjectiveHint(),
      phase: this.phase,
      updated: false,
    });
  }

  getObjectiveText() {
    switch (this.phase) {
      case 'find':
        return OBJECTIVE_TEXT[this.type] || 'Find the fuse';
      case 'activate':
        return 'Restore power';
      case 'escape':
        return 'Reach the exit';
      default:
        return OBJECTIVE_TEXT[this.type];
    }
  }

  getObjectiveHint() {
    if (this.phase === 'find') {
      return OBJECTIVE_HINTS[this.type] || 'Search the room carefully.';
    }
    return PHASE_HINTS[this.phase] || '';
  }

  update(player) {
    if (!this.room || this.completed) return;

    if (this.phase === 'find' && this.room.isAtObjective(player.x, player.y, player.radius)) {
      this.phase = 'activate';
      this._emitUpdate(true);
      this.events.emit('objectiveItemFound', { type: this.type });
      return;
    }

    if (this.phase === 'activate') {
      const spawnDist = Math.sqrt(
        (player.x - this.room.spawn.x) ** 2 + (player.y - this.room.spawn.y) ** 2
      );
      if (spawnDist < 70) {
        this.phase = 'escape';
        this.room.unlockExit();
        this._emitUpdate(true);
        this.events.emit('objectiveCompleted', { type: this.type });
        return;
      }
    }

    if (this.phase === 'escape' && this.room.isAtExit(player.x, player.y, player.radius)) {
      this.completed = true;
      this.events.emit('roomCompleted', { room: this.room });
    }
  }

  _emitUpdate(updated) {
    this.events.emit('objectiveUpdated', {
      text: this.getObjectiveText(),
      hint: this.getObjectiveHint(),
      phase: this.phase,
      updated,
    });
  }
}
