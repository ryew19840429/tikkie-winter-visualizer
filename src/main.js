
import './style.css'
import { AudioController } from './audio.js';
import { GridSystem } from './grid.js';

const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const audioController = new AudioController();
const gridSystem = new GridSystem();

let mouse = { x: null, y: null };

window.addEventListener('mousemove', (e) => {
  mouse.x = e.x;
  mouse.y = e.y;
});

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Re-init grid on resize to recenter
  if (logoImage.complete) {
    gridSystem.init(logoImage);
  }
});

// Load Logo
const logoImage = new Image();
logoImage.src = '/logo.png';
logoImage.onload = () => {
  gridSystem.init(logoImage);
  animate();
};

// UI Handling
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const statusText = document.getElementById('status-text');

uploadBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
  if (e.target.files.length > 0) {
    const file = e.target.files[0];
    statusText.innerText = "Processing Audio...";
    await audioController.loadFile(file);
    statusText.innerText = "Playing: " + file.name;
    uploadBtn.innerText = "Change Song";
  }
});

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  audioController.update();
  const audioData = audioController.getAudioData();

  // Visual feedback for deep bass/beat
  if (audioData.isBeat) {
    // No color shift, just physics
  }

  gridSystem.update(audioData);
  gridSystem.draw(ctx);


  requestAnimationFrame(animate);
}
