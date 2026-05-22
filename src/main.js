import './style.css';
import { Starfield } from './starfield.js';
import { ScrollEngine } from './scroll-engine.js';

// Initialize the cosmic cockpit when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize full screen dynamic starfield canvas
  const starfield = new Starfield('starfield-canvas');

  // Initialize Scroll Trigger engine and map content timelines
  const scrollEngine = new ScrollEngine(starfield);

  // Expose to window for debugging or manual traversal controls
  window.starfield = starfield;
  window.scrollEngine = scrollEngine;

  console.log('🌌 Cosmic Traversal HUD initialized. Enjoy your journey through space.');
});
