import { Game } from './core/Game.js';

const canvas = document.getElementById('game-canvas');
if (!canvas) {
  console.error('Missing #game-canvas — game cannot start');
} else {
  const game = new Game(canvas);
  window.__game = game;
  game.init().catch((err) => {
    console.error('Failed to initialize game:', err);
    game.menu?.setReady(false);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = '<div style="color:#DADADA;text-align:center;padding:2rem;font-family:sans-serif;">Failed to load The Light Is the Enemy. Try refreshing or use a local server.</div>';
    }
  });
}
