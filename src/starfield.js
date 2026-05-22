/**
 * Cosmic Starfield Animation Module
 * Renders an optimized 3D perspective star field on an HTML5 canvas.
 * Star velocity adapts dynamically to the user's scroll speed.
 */
export class Starfield {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    
    this.ctx = this.canvas.getContext('2d');
    
    // Starfield Configuration
    this.numStars = 400;
    this.stars = [];
    
    // Speed variables
    this.baseSpeed = 0.5;
    this.currentSpeed = this.baseSpeed;
    this.targetSpeed = this.baseSpeed;
    this.speedDecay = 0.95; // Decay rate when scroll ceases
    
    // Shooting star parameters
    this.shootingStarActive = false;
    this.shootingStar = { x: 0, y: 0, dx: 0, dy: 0, length: 0, speed: 0, opacity: 0 };
    
    this.init();
    this.setupListeners();
    this.animate();
  }
  
  init() {
    this.resize();
    this.stars = [];
    for (let i = 0; i < this.numStars; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * this.canvas.width * 2,
        y: (Math.random() - 0.5) * this.canvas.height * 2,
        z: Math.random() * this.canvas.width,
        color: this.getRandomStarColor(),
        size: Math.random() * 1.5 + 0.5
      });
    }
  }
  
  getRandomStarColor() {
    const r = Math.floor(Math.random() * 55) + 200; // 200-255
    const g = Math.floor(Math.random() * 55) + 200; // 200-255
    const b = 255; // Always rich blue/white
    const opacity = Math.random() * 0.4 + 0.6;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
  }
  
  setupListeners() {
    window.addEventListener('resize', () => this.init());
  }
  
  // Method to accelerate starfield speed when scrolling
  boostSpeed(amount) {
    this.targetSpeed = Math.min(amount * 0.25, 45); // Cap warp speed
  }

  // Register orbit configs from the scroll engine
  setOrbits(configs, perspective) {
    this.orbitConfigs = configs.filter(c => c.body && c.id !== 'sec-milkyway'); // Skip Milky Way
    this.perspective = perspective;
    
    // Find Sun coordinates as the center of the orbits
    const sunNode = configs.find(c => c.id === 'sec-sun');
    this.sunX = sunNode ? sunNode.x : -280;
    this.sunY = sunNode ? sunNode.y : 60;
    this.sunZ = sunNode ? sunNode.z : 800;
  }

  // Update camera coordinates from the scroll engine
  updateCamera(x, y, z) {
    this.cameraX = x;
    this.cameraY = y;
    this.cameraZ = z;
  }

  // Draw 3D projected orbits for each planet
  drawOrbits() {
    if (!this.orbitConfigs || this.cameraX === undefined) return;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Soft neon colors matching each planet's glow
    const orbitColors = {
      'sec-mercury': 'rgba(180, 180, 185, 0.15)',
      'sec-venus': 'rgba(223, 184, 108, 0.15)',
      'sec-earth': 'rgba(100, 160, 255, 0.22)',
      'sec-mars': 'rgba(255, 110, 110, 0.22)',
      'sec-jupiter': 'rgba(240, 180, 100, 0.22)',
      'sec-saturn': 'rgba(223, 184, 108, 0.25)',
      'sec-uranus': 'rgba(100, 220, 255, 0.22)',
      'sec-neptune': 'rgba(70, 120, 255, 0.22)',
      'sec-pluto': 'rgba(242, 201, 76, 0.25)'
    };

    this.orbitConfigs.forEach(c => {
      if (c.id === 'sec-sun') return; // Sun has no orbit around itself

      // Calculate radius in the X-Z plane
      const dx_planet = c.x - this.sunX;
      const dz_planet = c.z - this.sunZ;
      const R = Math.sqrt(dx_planet * dx_planet + dz_planet * dz_planet);

      this.ctx.beginPath();
      let first = true;
      
      // Sample points for a smooth ellipse projection
      const steps = 140;
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        
        // 3D coordinates on the orbital flat plane
        const px_3d = this.sunX + R * Math.cos(theta);
        const pz_3d = this.sunZ + R * Math.sin(theta);
        const py_3d = this.sunY; // Centered vertically around the Sun

        // Adjust coordinates relative to the camera
        const dx = px_3d - this.cameraX;
        const dy = py_3d - this.cameraY;
        const dz = pz_3d - this.cameraZ;

        // If the point is in front of the camera, project it
        if (dz > 0) {
          const depthFactor = this.perspective / (this.perspective + dz);
          const screenX = dx * depthFactor + centerX;
          const screenY = dy * depthFactor + centerY;

          if (first) {
            this.ctx.moveTo(screenX, screenY);
            first = false;
          } else {
            this.ctx.lineTo(screenX, screenY);
          }
        } else {
          // Break path if behind camera viewport
          first = true;
        }
      }

      this.ctx.strokeStyle = orbitColors[c.id] || 'rgba(255, 255, 255, 0.1)';
      this.ctx.lineWidth = 1.0;
      this.ctx.setLineDash([5, 8]); // Glowing dotted HUD style
      this.ctx.stroke();
      this.ctx.setLineDash([]); // Reset
    });
  }
  
  triggerShootingStar() {
    if (this.shootingStarActive) return;
    
    this.shootingStarActive = true;
    const side = Math.random() > 0.5;
    this.shootingStar = {
      x: side ? 0 : Math.random() * this.canvas.width,
      y: Math.random() * (this.canvas.height * 0.5),
      dx: Math.random() * 15 + 10,
      dy: Math.random() * 8 + 4,
      length: Math.random() * 80 + 50,
      speed: Math.random() * 10 + 15,
      opacity: 1
    };
  }
  
  drawShootingStar() {
    if (!this.shootingStarActive) return;
    
    const ss = this.shootingStar;
    ss.x += ss.dx;
    ss.y += ss.dy;
    
    this.ctx.beginPath();
    const grad = this.ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.dx * 3, ss.y - ss.dy * 3);
    grad.addColorStop(0, `rgba(255, 255, 255, ${ss.opacity})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    this.ctx.strokeStyle = grad;
    this.ctx.lineWidth = 1.5;
    this.ctx.moveTo(ss.x, ss.y);
    this.ctx.lineTo(ss.x - ss.dx * 2, ss.y - ss.dy * 2);
    this.ctx.stroke();
    
    // Decay shooting star
    if (ss.x > this.canvas.width || ss.y > this.canvas.height) {
      this.shootingStarActive = false;
    }
  }
  
  animate() {
    // Soft clear for star trails
    this.ctx.fillStyle = 'rgba(3, 3, 7, 0.25)'; // trail blending
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Speed interpolation (decay back to base cruising speed)
    this.currentSpeed += (this.targetSpeed - this.currentSpeed) * 0.1;
    this.targetSpeed = this.baseSpeed + (this.targetSpeed - this.baseSpeed) * this.speedDecay;
    
    // Draw and update stars
    for (let i = 0; i < this.numStars; i++) {
      const star = this.stars[i];
      
      // Move star closer in 3D
      star.z -= this.currentSpeed;
      
      // If star passes the viewport, reset to background
      if (star.z <= 0) {
        star.z = this.canvas.width;
        star.x = (Math.random() - 0.5) * this.canvas.width * 2;
        star.y = (Math.random() - 0.5) * this.canvas.height * 2;
      }
      
      // Map 3D coordinates to 2D screen coordinates (perspective division)
      const px = (star.x / star.z) * this.canvas.width + this.centerX;
      const py = (star.y / star.z) * this.canvas.height + this.centerY;
      
      // If star coordinates are offscreen, reset to center
      if (px < 0 || px > this.canvas.width || py < 0 || py > this.canvas.height) {
        star.z = this.canvas.width;
        star.x = (Math.random() - 0.5) * this.canvas.width * 2;
        star.y = (Math.random() - 0.5) * this.canvas.height * 2;
        continue;
      }
      
      // Draw star trail / dot based on velocity
      const sizeFactor = (1 - star.z / this.canvas.width) * star.size + 0.1;
      const trailLength = Math.max(1, this.currentSpeed * 0.4);
      
      this.ctx.beginPath();
      this.ctx.fillStyle = star.color;
      
      // Star becomes a line under warp speed
      if (this.currentSpeed > 5) {
        // Calculate angle from center of screen
        const angle = Math.atan2(py - this.centerY, px - this.centerX);
        const startX = px - Math.cos(angle) * trailLength;
        const startY = py - Math.sin(angle) * trailLength;
        
        this.ctx.strokeStyle = star.color;
        this.ctx.lineWidth = sizeFactor;
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(px, py);
        this.ctx.stroke();
      } else {
        // Simple dot when moving slowly
        this.ctx.arc(px, py, sizeFactor, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    
    // Draw 3D orbital paths on top of the stars
    this.drawOrbits();
    
    // Spontaneous shooting star
    if (Math.random() < 0.005) {
      this.triggerShootingStar();
    }
    this.drawShootingStar();
    
    requestAnimationFrame(() => this.animate());
  }
}
