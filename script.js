const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 900;
canvas.height = 570;

// ------------------
// Bilder laden (PNG)
// ------------------
const images = {
  tree: new Image(),
  lake: new Image(),
  dino: new Image(),
  bird: new Image()
};

images.tree.src = "tree.png";
images.lake.src = "lake.png";
images.dino.src = "dino.png";
images.bird.src = "bird.png";

// ☄️ COMET IMAGE
images.comet = new Image();
images.comet.src = "comet.png";

// Preload
let loadedImages = 0;
const totalImages = Object.keys(images).length;

for (let key in images) {
  images[key].onload = () => {
    loadedImages++;
  };
}

// ------------------
// Grid
// ------------------
const SIZE = 80;

let bottom = new Array(12).fill("empty");
let birds = new Array(12).fill("empty");

// ------------------
// Game values
// ------------------
let oxygen = 21;
let co2 = 0.03;
let running = false;

let startTime = 0;
const ROUND_TIME = 30;

// ------------------
// ☄️ COMET STATE
// ------------------
let cometActive = false;
let cometX = canvas.width ;
let cometY = 0;
let cometSpeed = 3;      // slower
let cometSize = 350;     // bigger
let cometHasHit = false; // wipe flag

// ------------------
// Leaderboard
// ------------------
let scores = JSON.parse(localStorage.getItem("ecoScores")) || [];

// ------------------
// Particles
// ------------------
class Particle {
  constructor(x, y, color, area) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.color = color;
    this.area = area;
  }

  update() {
    this.vx += (Math.random() - 0.5) * 0.5;
    this.vy += (Math.random() - 0.5) * 0.5;

    this.x += this.vx;
    this.y += this.vy;

    if (this.x < this.area.x || this.x > this.area.x + this.area.w) {
      this.vx *= -0.5;
    }
    if (this.y < this.area.y || this.y > this.area.y + this.area.h) {
      this.vy *= -0.5;
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

let o2Particles = [];
let co2Particles = [];

const O2_AREA = { x: 50, y: 20, w: 500, h: 50 };
const CO2_AREA = { x: 50, y: 20, w: 500, h: 50 };

function syncParticles(value, particles, color, area) {
  let target = Math.floor(value);

  while (particles.length < target) {
    particles.push(
      new Particle(
        area.x + Math.random() * area.w,
        area.y + Math.random() * area.h,
        color,
        area
      )
    );
  }

  particles.length = target;
}

// ------------------
// Add / Remove
// ------------------
function add(type) {
  if (type === "tree") {
    for (let i = 0; i < 6; i++) {
      if (bottom[i] === "empty") {
        bottom[i] = "tree";
        return;
      }
    }
  } else if (type === "lake") {
    for (let i = 6; i < 12; i++) {
      if (bottom[i] === "empty") {
        bottom[i] = "lake";
        return;
      }
    }
  } else {
    for (let i = 0; i < bottom.length; i++) {
      if (bottom[i] === "empty") {
        bottom[i] = type;
        return;
      }
    }
  }
}

function remove(type) {
  for (let i = bottom.length - 1; i >= 0; i--) {
    if (bottom[i] === type) {
      bottom[i] = "empty";
      return;
    }
  }
}

function addBird() {
  for (let i = 0; i < birds.length; i++) {
    if (birds[i] === "empty") {
      birds[i] = "bird";
      return;
    }
  }
}

function removeBird() {
  for (let i = birds.length - 1; i >= 0; i--) {
    if (birds[i] === "bird") {
      birds[i] = "empty";
      return;
    }
  }
}

// ☄️ TRIGGER COMET
function triggerComet() {
  cometActive = true;
  cometHasHit = false;
  cometX = canvas.width * 0.7;
  cometY = -cometSize;
}

function startGame() {
  bottom.fill("empty");
  birds.fill("empty");
  oxygen = 21;
  co2 = 0.03;
  running = true;
  startTime = Date.now();

  document.getElementById("startBtn").textContent = "RUNNING";

  let plays = localStorage.getItem("playCount");
  plays = plays ? parseInt(plays) : 0;
  plays++;

  localStorage.setItem("playCount", plays);

  // ☄️ comet after 5 seconds
  const delay = Math.random() * 80000 + 10000;; // 10-60 seconds
  setTimeout(triggerComet, delay);
}

// ------------------
// Logic
// ------------------
function count(arr, type) {
  return arr.filter(x => x === type).length;
}

function update() {
  if (!running) return;

  let trees = count(bottom, "tree");
  let lakes = count(bottom, "lake");
  let dinos = count(bottom, "dino");
  let birdCount = count(birds, "bird");

  oxygen += trees * 0.001 + lakes * 0.001 - dinos * 0.001 - birdCount * 0.001;
  co2 += dinos * 0.0001 + birdCount * 0.00005 - trees * 0.00001 - lakes * 0.0001;

  oxygen = Math.max(0, Math.min(25, oxygen));
  co2 = Math.max(0, Math.min(0.08, co2));

  if (oxygen < 15 || co2 > 0.07) remove("dino");
  if (oxygen < 20 || co2 > 0.07) removeBird();

  syncParticles(oxygen, o2Particles, "blue", O2_AREA);
  syncParticles(co2 * 100, co2Particles, "red", CO2_AREA);

  let elapsed = (Date.now() - startTime) / 1000;
  if (elapsed >= ROUND_TIME) {
    running = false;
    endGame();
  }

  // ☄️ COMET LOGIC (CORRECT)
  if (cometActive) {
    // movement (more left than down)
    cometX -= cometSpeed * 1;
    cometY += cometSpeed;

    // wipe late
    if (!cometHasHit && cometX < canvas.width * 0.1) {

      // remove only dinos + trees
      for (let i = 0; i < bottom.length; i++) {
        if (bottom[i] === "dino" || bottom[i] === "tree") {
          bottom[i] = "empty";
        }
      }

      // remove birds
      for (let i = 0; i < birds.length; i++) {
        if (birds[i] === "bird") {
          birds[i] = "empty";
        }
      }

      cometHasHit = true;
    }

    // deactivate comet when off screen
    if (cometX < -cometSize || cometY > canvas.height + cometSize) {
      cometActive = false;
    }
  }
}

function getBiodiversity() {
  return (
    (count(birds, "bird") * 3 +
      count(bottom, "dino") * 3 +
      count(bottom, "tree") +
      count(bottom, "lake")) /
    70 *
    100
  );
}

// ------------------
// End Game
// ------------------
function endGame() {
  let name = prompt("Your Name?");
  if (!name) name = "NoName";

  let score = getBiodiversity();

  scores.push({ name, score });
  scores.sort((a, b) => b.score - a.score);
  scores = scores.slice(0, 10);

  localStorage.setItem("ecoScores", JSON.stringify(scores));

  document.getElementById("startBtn").textContent = "START";
}

// ------------------
// Drawing
// ------------------
function drawBox(x, y, type) {
  //ctx.strokeRect(x, y, SIZE, SIZE);

  if (type === "empty") return;

  const img = images[type];

  if (img && img.complete) {
    const scale = (type === "tree") ? 1.5 : 1.1;
    const w = SIZE * scale;
    const h = SIZE * scale;
    const offsetX = x + SIZE / 2 - w / 2;
    const offsetY = y + SIZE / 2 - h / 2;
    ctx.drawImage(img, offsetX, offsetY, w, h);
  }
}

function drawLeaderboard() {
  ctx.font = "12px Arial";
  ctx.fillText("Leaderboard:", 650, 350);

  scores.forEach((s, i) => {
    ctx.fillText(
      (i + 1) + ". " + s.name + " - " + s.score.toFixed(1) + "%",
      650,
      370 + i * 20
    );
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);




  // ------------------
  // 🌤️ SKY + HORIZON
  // ------------------

  // Sky (light blue)
  ctx.fillStyle = "#bde0fe";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Ground (curved horizon)
  ctx.beginPath();

  // start left
  ctx.moveTo(0, canvas.height * 0.6);

  // curved horizon (higher in middle)
  ctx.quadraticCurveTo(
    canvas.width / 2, canvas.height * 0.4, // control point (curve peak)
    canvas.width, canvas.height * 0.6      // end right
  );

  // close shape to bottom
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();

  // green ground
  ctx.fillStyle = "#7bc96f";
  ctx.fill();


  o2Particles.forEach(p => {
    p.update();
    p.draw();
  });

  co2Particles.forEach(p => {
    p.update();
    p.draw();
  });

  ctx.font = "30px Arial";

  for (let i = 0; i < 12; i++) {
    let x = 50 + (i % 6) * (SIZE + 10);
    let y = 100 + Math.floor(i / 6) * (SIZE + 10);
    drawBox(x, y, birds[i]);
  }

  for (let i = 0; i < 12; i++) {
    let x = 50 + (i % 6) * (SIZE + 10);
    let y = 350 + Math.floor(i / 6) * (SIZE + 10);
    drawBox(x, y, bottom[i]);
  }

  // ☄️ DRAW COMET (bigger)
  if (cometActive && images.comet.complete) {
    ctx.drawImage(images.comet, cometX, cometY, cometSize, cometSize);
  }

  ctx.font = "20px Arial";

  ctx.fillStyle = "blue";
  ctx.fillText("O₂: " + oxygen.toFixed(1) + "%", 650, 40);

  ctx.fillStyle = "red";
  ctx.fillText("CO₂: " + co2.toFixed(3) + "%", 650, 70);

  ctx.fillStyle = "black";

  let bio = getBiodiversity();

  let barX = 650;
  let barY = 180;
  let barWidth = 200;
  let barHeight = 20;

  ctx.fillStyle = "#ddd";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = "green";
  ctx.fillRect(barX, barY, (bio / 100) * barWidth, barHeight);

  ctx.strokeStyle = "black";
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = "black";
  ctx.font = "40px Arial";
  ctx.fillText("Biodiversity", barX, barY - 10);

  if (running) {
    let remaining = ROUND_TIME - (Date.now() - startTime) / 1000;
    ctx.font = "20px Arial";
    ctx.fillText("Time: " + remaining.toFixed(0), 650, 270);
  }

  drawLeaderboard();

  let plays = localStorage.getItem("playCount") || 0;
  ctx.fillText("Played: " + plays, 650, 320);
}

// ------------------
// Loop
// ------------------
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();