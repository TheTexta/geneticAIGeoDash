var app = document.getElementById("gameCanvas");
var ctx = app.getContext("2d");

// Global constants for GA
const CANVAS_WIDTH = 800;  // Default dimensions for headless simulation
const CANVAS_HEIGHT = 450;

// Obstacle class
class Obstacle {
  constructor(x, y, width, height, speed, color = "red") {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = speed; // pixels per second
    this.color = color;
  }

  update(deltaTime) {
    // Move left
    this.x -= this.speed * deltaTime;
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }

  isOffScreen() {
    return this.x + this.width < 0;
  }

  collidesWith(player) {
    return !(
      player.x + player.width  < this.x ||
      player.x              > this.x + this.width ||
      player.y + player.height < this.y ||
      player.y             > this.y + this.height
    );
  }
}

// Obstacle management
const obstacles = [];
const minSpawnDelay = 0.8;      // seconds
const maxSpawnDelay = 2.5;      // seconds
const obstacleSpeed = 250;      // pixels per second
const obstacleSize = { w: 25, h: 25 };

let spawnTimer = 0;
let nextSpawnDelay = getRandomDelay();

function getRandomDelay() {
  return minSpawnDelay + Math.random() * (maxSpawnDelay - minSpawnDelay);
}

// Headless Game class for GA training
class Game {
  constructor(genome) {
    this.w1 = genome[0];
    this.w2 = genome[1];
    this.b = genome[2];

    // Canvas dimensions for simulation
    this.canvasWidth = CANVAS_WIDTH;
    this.canvasHeight = CANVAS_HEIGHT;

    // Player setup (copy from main game)
    this.player = {
      x: this.canvasWidth / 2 - 10,
      y: this.canvasHeight - 30,
      width: 20,
      height: 20,
      velocityY: 0,
      gravity: 981,
      jumpPower: -500,
      grounded: false
    };

    // Obstacle management
    this.obstacles = [];
    this.spawnTimer = 0;
    this.nextSpawnDelay = getRandomDelay();
    this.totalTime = 0;
    this.gameOver = false;
  }

  step(dt) {
    // 1) Accumulate fitness (survival time)
    this.totalTime += dt;

    // 2) Player physics
    if (!this.player.grounded) {
      this.player.velocityY += this.player.gravity * dt;
    }
    
    this.player.y += this.player.velocityY * dt;
    
    // Ground collision
    var groundY = this.canvasHeight - this.player.height;
    if (this.player.y >= groundY) {
      this.player.y = groundY;
      this.player.velocityY = 0;
      this.player.grounded = true;
    } else {
      this.player.grounded = false;
    }

    // 3) GA "brain" decision
    // Find the next obstacle that the player needs to jump over
    const nextObstacle = this.obstacles.find(o => o.x + o.width > this.player.x);
    const distToNext = nextObstacle ? (nextObstacle.x - this.player.x) : 999; // Large number if no obstacle
    const playerHeight = this.player.y;
    
    // Normalize inputs to [0, 1] range for better neural network performance
    const normalizedDist = Math.min(distToNext / this.canvasWidth, 1.0);
    const normalizedHeight = playerHeight / this.canvasHeight;
    
    // Neural network decision (simple linear model)
    const output = this.w1 * normalizedDist + this.w2 * normalizedHeight + this.b;
    
    // Jump if output > 0 and player is grounded
    if (output > 0 && this.player.grounded) {
      this.player.velocityY = this.player.jumpPower;
      this.player.grounded = false;
    }

    // 4) Spawn obstacles
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.nextSpawnDelay) {
      this.spawnTimer = 0;
      this.nextSpawnDelay = getRandomDelay();
      
      var yPos = this.canvasHeight - obstacleSize.h;
      this.obstacles.push(new Obstacle(
        this.canvasWidth,
        yPos,
        obstacleSize.w,
        obstacleSize.h,
        obstacleSpeed
      ));
    }

    // 5) Update and cull obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      this.obstacles[i].update(dt);
      if (this.obstacles[i].isOffScreen()) {
        this.obstacles.splice(i, 1);
      }
    }

    // 6) Collision detection
    for (let j = 0; j < this.obstacles.length; j++) {
      if (this.obstacles[j].collidesWith(this.player)) {
        this.gameOver = true;
        break;
      }
    }
  }

  run() {
    const FIXED_DT = 1/60; // Simulate at 60fps
    const MAX_TIME = 30; // Maximum simulation time (30 seconds)
    
    while (!this.gameOver && this.totalTime < MAX_TIME) {
      this.step(FIXED_DT);
    }
    
    return this.totalTime;
  }
}

// Genetic Algorithm Functions
function randGenome() {
  // Generate random weights and bias in range [-1, 1]
  return [
    Math.random() * 2 - 1, // w1: weight for distance
    Math.random() * 2 - 1, // w2: weight for height
    Math.random() * 2 - 1  // b: bias
  ];
}

function randn() {
  // Box-Muller transformation for normal distribution
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// GA Parameters
const POP_SIZE = 50;
const ELITE_FRACTION = 0.1; // Top 10%
const GENERATIONS = 100;
const MUTATION_RATE = 0.1;

async function runGA() {
  console.log("🧬 Starting Genetic Algorithm training...");
  
  // Initialize population
  let population = Array.from({length: POP_SIZE}, () => randGenome());
  let bestFitnessHistory = [];

  for (let gen = 0; gen < GENERATIONS; gen++) {
    // Evaluate fitness for each genome
    const scored = population.map(genome => {
      const fitness = new Game(genome).run();
      return { genome, fitness };
    });

    // Sort by fitness (descending)
    scored.sort((a, b) => b.fitness - a.fitness);

    // Track best fitness
    bestFitnessHistory.push(scored[0].fitness);

    // Select elites (top performers)
    const eliteCount = Math.floor(POP_SIZE * ELITE_FRACTION);
    const elites = scored.slice(0, eliteCount);

    // Calculate diversity metrics for mutation
    const w1Vals = elites.map(e => e.genome[0]);
    const w2Vals = elites.map(e => e.genome[1]);
    const bVals = elites.map(e => e.genome[2]);
    
    const σ1 = Math.max(0.1, Math.max(...w1Vals) - Math.min(...w1Vals));
    const σ2 = Math.max(0.1, Math.max(...w2Vals) - Math.min(...w2Vals));
    const σb = Math.max(0.1, Math.max(...bVals) - Math.min(...bVals));

    // Create next generation
    const newPop = [];
    
    // Elitism: carry over best performers unchanged
    elites.forEach(e => newPop.push([...e.genome]));
    
    // Fill rest with mutated offspring
    while (newPop.length < POP_SIZE) {
      const parent = elites[Math.floor(Math.random() * eliteCount)].genome;
      const child = [
        parent[0] + randn() * σ1 * MUTATION_RATE,
        parent[1] + randn() * σ2 * MUTATION_RATE,
        parent[2] + randn() * σb * MUTATION_RATE
      ];
      
      // Clamp values to reasonable range
      child[0] = Math.max(-2, Math.min(2, child[0]));
      child[1] = Math.max(-2, Math.min(2, child[1]));
      child[2] = Math.max(-2, Math.min(2, child[2]));
      
      newPop.push(child);
    }

    population = newPop;
    
    // Log progress
    console.log(`Gen ${gen + 1}/${GENERATIONS} - Best: ${scored[0].fitness.toFixed(2)}s - Avg: ${(scored.reduce((sum, s) => sum + s.fitness, 0) / scored.length).toFixed(2)}s`);
    
    // Allow UI to update
    if (gen % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  const finalBest = population[0];
  console.log("🏆 Training complete! Best genome:", finalBest);
  console.log("📊 Fitness history:", bestFitnessHistory);
  
  return finalBest;
}

// Global variable to store the best AI genome
let bestAIGenome = null;
let aiMode = false;

var player = {
  x: app.width / 2 - 10, // Center the player horizontally
  y: app.height - 30, // Start near the bottom of the canvas
  width: 20,
  height: 20,
  color: "blue",
  velocityY: 0,
  gravity: 981, // pixels per second squared
  jumpPower: -500, // negative for upward movement
  grounded: false
};

function drawPlayer() {
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);
}

function drawUI() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(10, 10, 250, 100);
  
  ctx.fillStyle = "white";
  ctx.font = "14px Arial";
  ctx.fillText("Controls:", 20, 30);
  ctx.fillText("SPACE/↑ - Jump", 20, 50);
  ctx.fillText("R - Reset game", 20, 70);
  ctx.fillText("T - Train AI", 20, 90);
  ctx.fillText("A - Toggle AI mode", 20, 110);
  
  // Show current mode
  ctx.fillStyle = aiMode ? "lime" : "yellow";
  ctx.font = "16px Arial";
  const modeText = aiMode ? "🤖 AI Mode" : "👤 Manual Mode";
  ctx.fillText(modeText, app.width - 150, 30);
  
  // Show AI status
  if (bestAIGenome) {
    ctx.fillStyle = "lime";
    ctx.fillText("✅ AI Trained", app.width - 150, 50);
  } else {
    ctx.fillStyle = "orange";
    ctx.fillText("❌ No AI", app.width - 150, 50);
  }
}

var lastTime = 0;

function update(currentTime) {
  var deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;
  
  // Apply gravity
  if (!player.grounded) {
    player.velocityY += player.gravity * deltaTime;
  }
  
  // Update position
  player.y += player.velocityY * deltaTime;
  
  // Ground collision
  var groundY = app.height - player.height;
  if (player.y >= groundY) {
    player.y = groundY;
    player.velocityY = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }
  
  // AI decision making (if in AI mode)
  if (aiMode && bestAIGenome) {
    const nextObstacle = obstacles.find(o => o.x + o.width > player.x);
    const distToNext = nextObstacle ? (nextObstacle.x - player.x) : 999;
    const playerHeight = player.y;
    
    // Normalize inputs to [0, 1] range for better neural network performance
    const normalizedDist = Math.min(distToNext / app.width, 1.0);
    const normalizedHeight = playerHeight / app.height;
    
    // Use the trained AI genome to make decisions
    const output = bestAIGenome[0] * normalizedDist + bestAIGenome[1] * normalizedHeight + bestAIGenome[2];
    
    if (output > 0 && player.grounded) {
      player.velocityY = player.jumpPower;
      player.grounded = false;
    }
  }
  
  // Random obstacle spawning
  spawnTimer += deltaTime;
  if (spawnTimer >= nextSpawnDelay) {
    // Reset timer and roll a new random delay
    spawnTimer = 0;
    nextSpawnDelay = getRandomDelay();
    
    // Spawn obstacle at right edge
    var yPos = app.height - obstacleSize.h;
    obstacles.push(new Obstacle(
      app.width,          // x position (right edge)
      yPos,               // y position (on ground)
      obstacleSize.w,     // width
      obstacleSize.h,     // height
      obstacleSpeed       // speed
    ));
  }
  
  // Update obstacles and remove off-screen ones
  for (var i = obstacles.length - 1; i >= 0; i--) {
    var obstacle = obstacles[i];
    obstacle.update(deltaTime);
    if (obstacle.isOffScreen()) {
      obstacles.splice(i, 1);
    }
  }
  
  // Collision detection
  var gameOver = false;
  for (var j = 0; j < obstacles.length; j++) {
    if (obstacles[j].collidesWith(player)) {
      console.log("Hit! Game Over!");
      gameOver = true;
      break;
    }
  }
  
  // Render everything
  ctx.clearRect(0, 0, app.width, app.height);
  drawPlayer();
  
  // Draw all obstacles
  for (var k = 0; k < obstacles.length; k++) {
    obstacles[k].draw(ctx);
  }
  
  // Draw UI overlay
  drawUI();
  
  // Continue game loop unless game over
  if (!gameOver) {
    requestAnimationFrame(update);
  }
}

requestAnimationFrame(update);

console.log("🎮 Genetic AI Geo Dash loaded!");
console.log("📖 Controls:");
console.log("  SPACE/↑ - Jump");
console.log("  R - Reset game");
console.log("  T - Train AI (takes ~30 seconds)");
console.log("  A - Toggle AI mode");
console.log("🧬 Press 'T' to train an AI player!");

// Add event listeners for player controls
document.addEventListener("keydown", function(event) {
  if (event.key === "ArrowUp" || event.key === " ") {
    if (player.grounded) {
      player.velocityY = player.jumpPower; // Jump
      player.grounded = false;
    }
  }
  
  // Reset game on 'R' key
  if (event.key === "r" || event.key === "R") {
    // Reset player position
    player.x = app.width / 2 - 10;
    player.y = app.height - 30;
    player.velocityY = 0;
    player.grounded = false;
    
    // Clear all obstacles
    obstacles.length = 0;
    
    // Reset spawn timer
    spawnTimer = 0;
    nextSpawnDelay = getRandomDelay();
    
    // Restart game loop
    requestAnimationFrame(update);
  }
  
  // Train AI on 'T' key
  if (event.key === "t" || event.key === "T") {
    console.log("🚀 Starting AI training...");
    runGA().then(best => {
      bestAIGenome = best;
      console.log("✅ AI trained! Press 'A' to watch the AI play.");
    });
  }
  
  // Toggle AI mode on 'A' key
  if (event.key === "a" || event.key === "A") {
    if (bestAIGenome) {
      aiMode = !aiMode;
      console.log(aiMode ? "🤖 AI mode ON" : "👤 Manual mode ON");
    } else {
      console.log("❌ No trained AI available. Press 'T' to train first.");
    }
  }
});