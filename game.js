var app = document.getElementById("gameCanvas");
var ctx = app.getContext("2d");

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
  
  // Continue game loop unless game over
  if (!gameOver) {
    requestAnimationFrame(update);
  }
}

requestAnimationFrame(update);

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
});