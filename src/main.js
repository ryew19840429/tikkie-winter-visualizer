
import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AudioController } from './audio.js';
import { Grid3D } from './grid3d.js';
import { ParticleSystem3D } from './particles3d.js';

// Setup Three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Remove old canvas if it exists (it's in index.html, we should probably remove it or hide it)
const oldCanvas = document.getElementById('canvas1');
if (oldCanvas) oldCanvas.style.display = 'none';

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
camera.position.z = 100;

const audioController = new AudioController();
const grid3d = new Grid3D(scene);
const particles = new ParticleSystem3D(scene);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 30);
scene.add(dirLight);


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Load Logo
const logoImage = new Image();
logoImage.src = '/logo.png';
logoImage.onload = () => {
  grid3d.init(logoImage);
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
  controls.update();
  audioController.update();
  const audioData = audioController.getAudioData();

  grid3d.update(audioData);
  particles.update(audioData);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
