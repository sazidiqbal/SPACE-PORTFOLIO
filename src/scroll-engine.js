import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

export class ScrollEngine {
  constructor(starfield) {
    this.starfield = starfield;
    this.sectionsCount = 12; // Launch + Sun + 9 Planets + Milky Way
    this.currentActiveIndex = 0;

    // Z-depth configuration for each stage in our 3D space
    this.celestialConfigs = [
      { id: 'sec-launch', body: null, z: 0, x: 0, y: 0, baseScale: 1.0 },
      { id: 'sec-sun', body: '#body-sun', z: 800, x: -280, y: 60, baseScale: 0.85 },
      { id: 'sec-mercury', body: '#body-mercury', z: 1600, x: 240, y: -100, baseScale: 0.75 },
      { id: 'sec-venus', body: '#body-venus', z: 2400, x: -360, y: -140, baseScale: 0.8 },
      { id: 'sec-earth', body: '#body-earth', z: 3200, x: 420, y: 120, baseScale: 0.82 },
      { id: 'sec-mars', body: '#body-mars', z: 4000, x: -480, y: 160, baseScale: 0.75 },
      { id: 'sec-jupiter', body: '#body-jupiter', z: 4800, x: 600, y: -220, baseScale: 0.95 },
      { id: 'sec-saturn', body: '#body-saturn', z: 5600, x: -720, y: -100, baseScale: 1.05 },
      { id: 'sec-uranus', body: '#body-uranus', z: 6400, x: 800, y: 180, baseScale: 0.85 },
      { id: 'sec-neptune', body: '#body-neptune', z: 7200, x: -920, y: 120, baseScale: 0.88 },
      { id: 'sec-pluto', body: '#body-pluto', z: 8000, x: 880, y: -150, baseScale: 0.7 },
      { id: 'sec-milkyway', body: '#body-milkyway', z: 8800, x: 0, y: 0, baseScale: 1.15 }
    ];

    this.totalZDepth = this.celestialConfigs[this.celestialConfigs.length - 1].z;
    this.perspective = 400; // Camera focal depth representation

    // Coordinate distances for the bottom HUD
    this.auDistances = [
      "0.000",   // Launch
      "0.000",   // Sun
      "0.387",   // Mercury
      "0.723",   // Venus
      "1.000",   // Earth
      "1.524",   // Mars
      "5.203",   // Jupiter
      "9.582",   // Saturn
      "19.18",   // Uranus
      "30.07",   // Neptune
      "39.48",   // Pluto (savage underdog)
      "9.46T"    // Milky Way (in Light Years)
    ];

    this.init();
  }

  init() {
    if (this.starfield && typeof this.starfield.setOrbits === 'function') {
      this.starfield.setOrbits(this.celestialConfigs, this.perspective);
    }
    this.setup3DScrollTrigger();
    this.setupHUDNavigation();
    this.setupScrollVelocityTracker();
    this.setupContactForm();
  }

  // Pure 3D camera translation & projection calculation
  update3DUniverse(progress) {
    const cameraZ = progress * this.totalZDepth;
    
    // Interpolate camera X & Y coordinates along the path to keep active planet centered
    let cameraX = 0;
    let cameraY = 0;

    // Find the two celestial bodies the camera is currently traveling between
    let activeSegmentIndex = 0;
    for (let i = 0; i < this.celestialConfigs.length - 1; i++) {
      if (cameraZ >= this.celestialConfigs[i].z && cameraZ <= this.celestialConfigs[i + 1].z) {
        activeSegmentIndex = i;
        break;
      }
    }

    const startNode = this.celestialConfigs[activeSegmentIndex];
    const endNode = this.celestialConfigs[activeSegmentIndex + 1];
    
    // Calculate LERP factor t (0 to 1) between these two celestial nodes
    const segmentZDiff = endNode.z - startNode.z;
    const t = segmentZDiff > 0 ? (cameraZ - startNode.z) / segmentZDiff : 0;

    // Interpolate camera X/Y to smoothly transition focal centers
    cameraX = startNode.x + (endNode.x - startNode.x) * t;
    cameraY = startNode.y + (endNode.y - startNode.y) * t;

    // Feed coordinates to the starfield canvas for 3D orbit calculations
    if (this.starfield && typeof this.starfield.updateCamera === 'function') {
      this.starfield.updateCamera(cameraX, cameraY, cameraZ);
    }

    // Project and render all celestial bodies relative to camera coordinates
    this.celestialConfigs.forEach((config, idx) => {
      if (!config.body) return; // Skip Launch dummy

      const bodyEl = document.querySelector(config.body);
      if (!bodyEl) return;

      const dz = config.z - cameraZ;
      const dx = config.x - cameraX;
      const dy = config.y - cameraY;

      if (dz > 0) {
        // Celestial body is ahead of the camera
        const depthFactor = this.perspective / (this.perspective + dz);
        const projectedX = dx * depthFactor;
        const projectedY = dy * depthFactor;
        const scale = config.baseScale * depthFactor;
        
        // Keep all planets fully visible ahead, but fade them out slightly only at the extreme edge of space
        let opacity = 1.0;
        if (dz > 8000) {
          opacity = Math.max(0, 1 - (dz - 8000) / 1000);
        }

        gsap.set(bodyEl, {
          x: projectedX,
          y: projectedY,
          scale: scale,
          opacity: opacity,
          visibility: opacity > 0 ? 'visible' : 'hidden',
          zIndex: Math.floor(500 - (dz * 0.05)) // Order rendering correctly in Z space (closer = higher)
        });

      } else {
        // Celestial body has passed behind the camera
        // Rapidly scale up and fade out to simulate flying through/past
        const passScale = config.baseScale * (1 + (-dz / 100) * 1.5);
        const opacity = Math.max(0, 1 + (dz / 250)); // Fade completely inside 250px depth
        
        const projectedX = dx * (1 - dz / 120);
        const projectedY = dy * (1 - dz / 120);

        gsap.set(bodyEl, {
          x: projectedX,
          y: projectedY,
          scale: passScale,
          opacity: opacity,
          visibility: opacity > 0 ? 'visible' : 'hidden',
          zIndex: 600 // Ensure passed bodies stay on top during exit transitions
        });
      }
    });

    // Update active HUD coordinates and progress items
    const rawIndex = progress * (this.sectionsCount - 1);
    const activeIndex = Math.round(rawIndex);

    // Dock text cards by matching the closest active planet's coordinate
    this.celestialConfigs.forEach((config, idx) => {
      const cardSec = document.getElementById(config.id);
      if (!cardSec) return;

      const card = cardSec.querySelector('.glass-card, .intro-card');
      if (!card) return;

      // Distance from camera Z to planet Z
      const distZ = Math.abs(cameraZ - config.z);

      if (distZ < 450) {
        // Card is active and docks in
        cardSec.classList.add('active');
        
        // Map card entry transitions smoothly as we slide close to its planet Z
        const cardProgress = 1 - (distZ / 450); // 0 (far) to 1 (perfectly centered)
        const offsetX = (1 - cardProgress) * 60;
        const opacity = cardProgress;

        gsap.set(card, {
          opacity: opacity,
          x: config.id === 'sec-launch' ? 0 : offsetX,
          y: config.id === 'sec-launch' ? (1 - cardProgress) * 40 : 0
        });
      } else {
        cardSec.classList.remove('active');
        gsap.set(card, { opacity: 0 });
      }
    });

    if (activeIndex !== this.currentActiveIndex) {
      this.updateActiveHUD(activeIndex);
      this.currentActiveIndex = activeIndex;
    }

    // Update bottom status coordinate readout
    const currentDist = this.auDistances[activeIndex];
    const displayDistLabel = activeIndex === 11 ? 'COORD: MILKY WAY | G-DIST: ' : 'COORD: HELIOCENTRIC | DIST: ';
    const unit = activeIndex === 11 ? ' LY' : ' AU';
    
    const lat = (Math.sin(progress * Math.PI * 2) * 8.5).toFixed(3);
    const speed = (this.starfield.currentSpeed * 0.15).toFixed(3);
    
    const coordHud = document.getElementById('coordinate-hud');
    if (coordHud) {
      coordHud.innerText = `LAT: ${lat}° | VEL: ${speed} AU/s | ${displayDistLabel}${currentDist}${unit}`;
    }
  }

  setup3DScrollTrigger() {
    ScrollTrigger.create({
      trigger: '.scroll-spacer-container',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.0, // Tighter scrubbing for immediate tactile feedback
      onUpdate: (self) => {
        this.update3DUniverse(self.progress);
      }
    });

    // Run once at load to project the initial lineup
    this.update3DUniverse(0);
  }

  updateActiveHUD(index) {
    const hudItems = document.querySelectorAll('.hud-item');
    hudItems.forEach(item => item.classList.remove('active'));
    
    const targetItem = document.querySelector(`.hud-item[data-index="${index}"]`);
    if (targetItem) {
      targetItem.classList.add('active');
    }
  }

  setupHUDNavigation() {
    const hudItems = document.querySelectorAll('.hud-item');
    const startBtn = document.getElementById('start-journey-btn');

    // Make HUD dots clickable
    hudItems.forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.getAttribute('data-index'));
        this.scrollToIndex(index);
      });
    });

    // Intro screen button jump
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.scrollToIndex(1); // Jump to The Sun
      });
    }
  }

  scrollToIndex(index) {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    const targetScroll = (index / (this.sectionsCount - 1)) * totalHeight;
    
    gsap.to(window, {
      scrollTo: targetScroll,
      duration: 2.2, // Slightly slower scroll travel for smooth cinematic LERP alignment
      ease: 'power3.inOut'
    });
  }

  setupScrollVelocityTracker() {
    let lastScrollTop = window.scrollY || document.documentElement.scrollTop;
    let lastTime = performance.now();

    window.addEventListener('scroll', () => {
      const currentScrollTop = window.scrollY || document.documentElement.scrollTop;
      const currentTime = performance.now();
      
      const scrollDelta = Math.abs(currentScrollTop - lastScrollTop);
      const timeDelta = currentTime - lastTime;

      if (scrollDelta > 0 && timeDelta > 0) {
        // Feed scroll speed into canvas particles velocity
        const velocity = (scrollDelta / timeDelta) * 55;
        this.starfield.boostSpeed(velocity);
      }

      lastScrollTop = currentScrollTop;
      lastTime = currentTime;
    });
  }

  setupContactForm() {
    const form = document.getElementById('space-contact-form');
    const statusMsg = document.getElementById('form-status');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('form-name').value;
        
        statusMsg.style.color = '#00ff66';
        statusMsg.innerText = 'TRANSMITTING ENCRYPTED CONTENT TO SAZID.SPACE...';
        
        setTimeout(() => {
          statusMsg.innerText = `TRANSMISSION SUCCESSFUL. WELCOME ABOARD, ${name.toUpperCase()}!`;
          form.reset();
        }, 1500);
      });
    }
  }
}
