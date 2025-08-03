// GA Swarm Visualizer
// This module provides real-time visualization of genetic algorithm training

// UI element references
const ui = {
  popSize: null,
  mutRate: null,
  maxGen: null,
  speed: null,
  blend: null,
  start: null,
  pause: null,
  stop: null,
  status: null,
  popDisplay: null,
  mutDisplay: null,
  speedDisplay: null
};

// Swarm training state
let swarmPopulation = [];
let swarmGeneration = 0;
let swarmBestFitness = 0;
let swarmAnimating = false;
let swarmSpeedFactor = 1;
let swarmPaused = false;

// Initialize UI when DOM is loaded
function initSwarmUI() {
  // Get all UI elements
  ui.popSize = document.getElementById('popSize');
  ui.mutRate = document.getElementById('mutRate');
  ui.maxGen = document.getElementById('maxGen');
  ui.speed = document.getElementById('speed');
  ui.blend = document.getElementById('blendToggle');
  ui.start = document.getElementById('startBtn');
  ui.pause = document.getElementById('pauseBtn');
  ui.stop = document.getElementById('stopBtn');
  ui.status = document.getElementById('status');
  ui.popDisplay = document.getElementById('popDisplay');
  ui.mutDisplay = document.getElementById('mutDisplay');
  ui.speedDisplay = document.getElementById('speedDisplay');

  if (!ui.popSize) {
    console.log("Swarm UI not found - running in single-player mode");
    return;
  }

  // Bind event listeners
  ui.start.addEventListener('click', startSwarmTraining);
  ui.pause.addEventListener('click', toggleSwarmPause);
  ui.stop.addEventListener('click', stopSwarmTraining);

  // Update displays when sliders change
  ui.popSize.addEventListener('input', () => {
    ui.popDisplay.textContent = ui.popSize.value;
  });

  ui.mutRate.addEventListener('input', () => {
    ui.mutDisplay.textContent = parseFloat(ui.mutRate.value).toFixed(2);
  });

  ui.speed.addEventListener('input', () => {
    swarmSpeedFactor = parseFloat(ui.speed.value);
    ui.speedDisplay.textContent = swarmSpeedFactor.toFixed(1) + 'x';
  });

  console.log("🧬 Swarm visualizer initialized!");
}

// Setup GA parameters and start training
function setupSwarmGA() {
  swarmGeneration = 0;
  swarmBestFitness = 0;
  const popSize = parseInt(ui.popSize.value);
  
  // Create initial population using existing randGenome function
  swarmPopulation = Array.from({length: popSize}, () => randGenome());
  swarmAnimating = true;
  swarmPaused = false;
  
  // Update UI
  ui.start.disabled = true;
  ui.pause.disabled = false;
  ui.stop.disabled = false;
  ui.status.textContent = `Gen: 0 | Population: ${popSize} | Best: 0.00s`;
  
  console.log(`🚀 Starting swarm training with ${popSize} individuals`);
  console.log(`📐 Canvas dimensions: ${document.getElementById('gameCanvas').width}x${document.getElementById('gameCanvas').height}`);
}

// Main training loop
async function swarmTrainingLoop() {
  const maxGen = parseInt(ui.maxGen.value);
  
  while (swarmGeneration < maxGen && swarmAnimating) {
    if (swarmPaused) {
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }

    swarmGeneration++;
    
    // Run one generation with visualization
    const scored = await runSwarmGenerationVisual(swarmPopulation);
    
    // Sort by fitness (descending)
    scored.sort((a, b) => b.fitness - a.fitness);
    swarmBestFitness = scored[0].fitness;
    
    // Update status
    const avgFitness = scored.reduce((sum, s) => sum + s.fitness, 0) / scored.length;
    ui.status.textContent = `Gen: ${swarmGeneration} | Best: ${swarmBestFitness.toFixed(2)}s | Avg: ${avgFitness.toFixed(2)}s`;
    
    // Create next generation
    const eliteCount = Math.floor(scored.length * 0.1); // Top 10%
    const elites = scored.slice(0, eliteCount);
    swarmPopulation = breedNextGeneration(elites, parseFloat(ui.mutRate.value));
    
    // Small delay to keep UI responsive
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  if (swarmAnimating) {
    console.log(`🏆 Swarm training complete! Best fitness: ${swarmBestFitness.toFixed(2)}s`);
    ui.status.textContent = `✅ Training complete! Best: ${swarmBestFitness.toFixed(2)}s`;
    stopSwarmTraining();
  }
}

// Run one generation with real-time visualization
function runSwarmGenerationVisual(population) {
  return new Promise(resolve => {
    // Get actual canvas dimensions
    const canvas = document.getElementById('gameCanvas');
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Create game instances for each genome with actual canvas dimensions
    const bots = population.map(genome => {
      const game = new Game(genome);
      game.genome = genome; // Store genome reference
      
      // Override canvas dimensions to match actual canvas
      game.canvasWidth = canvasWidth;
      game.canvasHeight = canvasHeight;
      
      // Adjust player position for actual canvas size
      game.player.x = canvasWidth / 2 - 10;
      game.player.y = canvasHeight - 30;
      
      return game;
    });
    
    let aliveBots = bots.slice();
    const dt = 1/60 * swarmSpeedFactor;
    
    function simulationStep() {
      if (!swarmAnimating || swarmPaused) {
        // If stopped/paused, just return current results
        resolve(bots.map(bot => ({ 
          genome: bot.genome, 
          fitness: bot.totalTime 
        })));
        return;
      }
      
      // Get canvas and context
      const canvas = document.getElementById('gameCanvas');
      const ctx = canvas.getContext('2d');
      
      // Clear canvas completely
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Reset to default rendering state
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      
      // Update and draw all alive bots
      aliveBots = aliveBots.filter(bot => {
        if (!bot.gameOver && bot.totalTime < 30) { // Max 30 seconds
          bot.step(dt);
          return true;
        }
        return false;
      });
      
      // Draw obstacles first (from any bot - they should be similar)
      if (aliveBots.length > 0) {
        ctx.fillStyle = 'red';
        for (const obstacle of aliveBots[0].obstacles) {
          ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }
      }
      
      // Set blend mode for bots if enabled
      if (ui.blend.checked) {
        ctx.globalAlpha = 0.1;
        ctx.globalCompositeOperation = 'multiply';
      }
      
      // Draw all alive bots
      let botCount = 0;
      for (const bot of aliveBots) {
        drawSwarmBot(bot, ctx);
        botCount++;
      }
      
      // Debug: log bot count occasionally
      if (Math.random() < 0.01) { // 1% chance per frame
        console.log(`🤖 Drawing ${botCount} bots at generation ${swarmGeneration}`);
      }
      
      // Reset rendering state
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      
      // Continue simulation if bots are alive
      if (aliveBots.length > 0) {
        requestAnimationFrame(simulationStep);
      } else {
        // All bots are done, collect results
        resolve(bots.map(bot => ({ 
          genome: bot.genome, 
          fitness: bot.totalTime 
        })));
      }
    }
    
    simulationStep();
  });
}

// Draw a single bot (player rectangle)
function drawSwarmBot(bot, ctx) {
  const player = bot.player;
  
  // Make bots more visible based on blend mode
  if (ui.blend.checked) {
    ctx.fillStyle = 'rgba(0, 100, 255, 0.3)'; // More visible in ghost mode
  } else {
    ctx.fillStyle = 'rgba(0, 100, 255, 0.8)'; // Semi-transparent blue in normal mode
  }
  
  ctx.fillRect(player.x, player.y, player.width, player.height);
}

// Create next generation through breeding
function breedNextGeneration(elites, mutationRate) {
  const targetPopSize = parseInt(ui.popSize.value);
  const nextGeneration = [];
  
  // Elitism: carry over best performers unchanged
  for (const elite of elites) {
    nextGeneration.push([...elite.genome]);
  }
  
  // Fill rest with mutated offspring
  while (nextGeneration.length < targetPopSize) {
    const parent = elites[Math.floor(Math.random() * elites.length)].genome;
    const child = mutateGenome(parent, mutationRate);
    nextGeneration.push(child);
  }
  
  return nextGeneration;
}

// Mutate a genome
function mutateGenome(genome, mutationRate) {
  const child = [...genome];
  
  for (let i = 0; i < child.length; i++) {
    if (Math.random() < mutationRate) {
      // Add Gaussian noise
      child[i] += randn() * 0.2;
      // Clamp to reasonable range
      child[i] = Math.max(-2, Math.min(2, child[i]));
    }
  }
  
  return child;
}

// Event handlers
function startSwarmTraining() {
  setupSwarmGA();
  swarmTrainingLoop();
}

function toggleSwarmPause() {
  swarmPaused = !swarmPaused;
  ui.pause.textContent = swarmPaused ? '▶️ Resume' : '⏸️ Pause';
  console.log(swarmPaused ? '⏸️ Swarm training paused' : '▶️ Swarm training resumed');
}

function stopSwarmTraining() {
  swarmAnimating = false;
  swarmPaused = false;
  
  // Reset UI
  ui.start.disabled = false;
  ui.pause.disabled = true;
  ui.stop.disabled = true;
  ui.pause.textContent = '⏸️ Pause';
  
  console.log('🛑 Swarm training stopped');
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSwarmUI);
} else {
  initSwarmUI();
}

// Export functions for potential use by main game
window.swarmVisualizer = {
  isTraining: () => swarmAnimating,
  getBestGenome: () => swarmPopulation.length > 0 ? swarmPopulation[0] : null,
  getCurrentGeneration: () => swarmGeneration,
  getBestFitness: () => swarmBestFitness
};
