import { OBJECTIVE_TYPE } from '../utils/Constants.js';

const PHASE_HINTS = {
  findFuse: 'Look for an electrical panel or fuse housing.',
  findGenerator: 'Follow power equipment and cables toward backup power.',
  installFuse: 'Install the fuse in the generator control panel.',
  escape: 'The exit door should be marked with green light.',
};

export class ObjectiveSystem {
  constructor(events) {
    this.events = events;
    this.type = OBJECTIVE_TYPE.FIND_FUSE;
    this.completed = false;
    this.phase = 'findFuse';
    this.room = null;
    this.installTimer = 0;
    this.lastInteractionDebug = null;
    this.debugCounters = {
      ePresses: 0,
      interactionChecks: 0,
      pickupAttempts: 0,
      pickupSuccess: 0,
    };
  }

  setup(room, roomNumber) {
    this.room = room;
    this.completed = false;
    this.type = OBJECTIVE_TYPE.FIND_FUSE;
    this.phase = 'findFuse';
    this.installTimer = 0;
    this.lastInteractionDebug = null;
    this.debugCounters = {
      ePresses: 0,
      interactionChecks: 0,
      pickupAttempts: 0,
      pickupSuccess: 0,
    };

    this.events.emit('objectiveUpdated', {
      text: this.getObjectiveText(),
      hint: this.getObjectiveHint(),
      phase: this.phase,
      updated: false,
    });
  }

  getObjectiveText() {
    switch (this.phase) {
      case 'findFuse':
        return 'Find the fuse';
      case 'findGenerator':
        return 'Find the backup generator';
      case 'installFuse':
        return 'Install the fuse';
      case 'escape':
        return 'Escape';
      default:
        return 'Find the fuse';
    }
  }

  getObjectiveHint() {
    return PHASE_HINTS[this.phase] || '';
  }

  getInteractionPrompt(player) {
    if (!this.room || !player || this.completed) return '';
    if (this.phase === 'findFuse' && this.room.isAtFuse(player.x, player.y, player.radius)) {
      return 'PICK UP FUSE [E]';
    }
    if ((this.phase === 'findGenerator' || this.phase === 'installFuse') && this.room.isAtGenerator(player.x, player.y, player.radius)) {
      return 'INSTALL FUSE [E]';
    }
    return '';
  }

  update(deltaTime, player, interactPressed = false) {
    if (!player) {
      player = deltaTime;
      deltaTime = 0;
    }
    if (!this.room || this.completed) return;

    if (interactPressed) {
      this.debugCounters.ePresses++;
      this.debugCounters.pickupAttempts++;
    }
    this.debugCounters.interactionChecks++;

    if (this.phase === 'findFuse' && this.room.isAtFuse(player.x, player.y, player.radius) && interactPressed) {
      this.room.fuseCollected = true;
      this.phase = 'findGenerator';
      this._emitUpdate(true);
      this.events.emit('objectiveItemFound', { type: this.type });
      this.debugCounters.pickupSuccess++;
      this._recordInteractionAttempt(player, 'SUCCESS_FUSE_PICKUP');
      return;
    }

    if ((this.phase === 'findGenerator' || this.phase === 'installFuse') && this.room.isAtGenerator(player.x, player.y, player.radius) && interactPressed) {
      this.room.generatorActive = true;
      this.phase = 'escape';
      this.room.unlockExit();
      this._emitUpdate(true);
      this.events.emit('objectiveCompleted', { type: this.type });
      this.debugCounters.pickupSuccess++;
      this._recordInteractionAttempt(player, 'SUCCESS_GENERATOR_INSTALL');
      return;
    }

    if (interactPressed) {
      this._recordInteractionAttempt(player, 'NO_MATCH');
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

  getDebugInfo(player, interactPressed = false) {
    if (!this.room || !player) return null;
    const fuseDistance = this.room.fuse
      ? Math.hypot(player.x - this.room.fuse.x, player.y - this.room.fuse.y)
      : Infinity;
    const generatorDistance = this.room.generator
      ? Math.hypot(player.x - this.room.generator.x, player.y - this.room.generator.y)
      : Infinity;
    const pickupRadius = this.room.getFusePickupRadius(player.radius);
    const fuseInRange = this.room.isAtFuse(player.x, player.y, player.radius);
    const prompt = this.getInteractionPrompt(player);
    return {
      phase: this.phase,
      fuseExists: Boolean(this.room.fuse),
      fusePosition: this.room.fuse ? { x: this.room.fuse.x, y: this.room.fuse.y } : null,
      fuseDistance,
      pickupRadius,
      fuseAvailable: Boolean(this.room.fuse && !this.room.fuseCollected && this.phase === 'findFuse'),
      fuseInRange,
      fusePrompt: prompt.includes('FUSE'),
      fuseCollected: this.room.fuseCollected,
      generatorExists: Boolean(this.room.generator),
      generatorPosition: this.room.generator ? { x: this.room.generator.x, y: this.room.generator.y } : null,
      generatorDistance,
      generatorPickupRadius: this.room.getGeneratorPickupRadius(player.radius),
      generatorInRange: this.room.isAtGenerator(player.x, player.y, player.radius),
      generatorActive: this.room.generatorActive,
      prompt,
      interactPressed,
      counters: { ...this.debugCounters },
      lastInteraction: this.lastInteractionDebug,
    };
  }

  _recordInteractionAttempt(player, result = 'NO_MATCH') {
    if (!this.room || !player) return;
    this.lastInteractionDebug = {
      input: 'received',
      phase: this.phase,
      fuseDistance: this.room.fuse ? Math.hypot(player.x - this.room.fuse.x, player.y - this.room.fuse.y) : Infinity,
      generatorDistance: this.room.generator ? Math.hypot(player.x - this.room.generator.x, player.y - this.room.generator.y) : Infinity,
      fuseInRange: this.room.isAtFuse(player.x, player.y, player.radius),
      generatorInRange: this.room.isAtGenerator(player.x, player.y, player.radius),
      result,
    };
  }
}
