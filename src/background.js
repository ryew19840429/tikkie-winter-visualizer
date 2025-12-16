import * as THREE from 'three';

export class BackgroundSystem {
    constructor(scene) {
        this.scene = scene;
        this.count = 100; // Reduced count for less chaos
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.init();
    }

    createBokehTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128; // Even smoother
        canvas.height = 128;

        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
        // Very soft falloff
        gradient.addColorStop(0, 'rgba(255,255,255,0.8)');   // Soft core
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.6)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.1)'); // Wide glow
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        context.fillStyle = gradient;
        context.fillRect(0, 0, 128, 128);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    init() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.count * 3);
        const colors = new Float32Array(this.count * 3);

        // Store particle state on CPU for logic
        this.particleData = [];

        const palette = [
            new THREE.Color(0xff0044), // Red
            new THREE.Color(0x00ff88), // Teal-Green
            new THREE.Color(0x4444ff), // Indigo
            new THREE.Color(0xffaa22), // Warm Gold
            new THREE.Color(0xff00ff), // Magenta
        ];

        for (let i = 0; i < this.count; i++) {
            // Assign random init properties
            const p = this.createParticleData(palette);

            // Start Hidden
            p.active = false;
            p.progress = 0;

            this.particleData.push(p);

            // Init off-screen or invisible
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = -5000; // Far away

            colors[i * 3] = 0;
            colors[i * 3 + 1] = 0;
            colors[i * 3 + 2] = 0;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Material
        const texture = this.createBokehTexture();
        this.material = new THREE.PointsMaterial({
            map: texture,
            size: 120, // Much bigger base size
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            blending: THREE.NormalBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(geometry, this.material);
        this.points.frustumCulled = false; // Prevent culling when moving points into view
        this.group.add(this.points);
    }

    createParticleData(palette) {
        const color = palette[Math.floor(Math.random() * palette.length)];
        return {
            x: 0, y: 0, z: 0,
            color: color,
            baseR: color.r,
            baseG: color.g,
            baseB: color.b,
            speed: 0.01 + Math.random() * 0.03, // Varied speeds
            progress: 0,
            active: false, // Start hidden
        };
    }

    update(audioData) {
        const { avgEnergy, isBeat } = audioData;
        const positions = this.points.geometry.attributes.position.array;
        const colors = this.points.geometry.attributes.color.array;

        // Count how many to spawn this frame
        // On beat, spawn a burst. Randomly spawn quiet ones otherwise?
        // Let's rely mostly on beats for that "following the music" feel.
        let spawnCount = 0;
        if (isBeat) {
            spawnCount = 3 + Math.floor((avgEnergy / 255) * 5);
        } else if (Math.random() > 0.95) {
            spawnCount = 1; // Occasional random blink
        }

        for (let i = 0; i < this.count; i++) {
            const p = this.particleData[i];

            if (p.active) {
                // Advance
                p.progress += p.speed;

                // Death
                if (p.progress >= 1.0) {
                    p.active = false;
                    p.progress = 0;
                    // Hide
                    colors[i * 3] = 0;
                    colors[i * 3 + 1] = 0;
                    colors[i * 3 + 2] = 0;
                    continue; // Skip rendering
                }

                // Render Logic
                // Sine wave opacity: 0 -> 1 -> 0
                let alpha = Math.sin(p.progress * Math.PI);

                // Audio modulation: Brighten active ones with current energy
                alpha *= (1.0 + (avgEnergy / 255) * 0.5);

                colors[i * 3] = p.baseR * alpha;
                colors[i * 3 + 1] = p.baseG * alpha;
                colors[i * 3 + 2] = p.baseB * alpha;

            } else {
                // Inactive
                if (spawnCount > 0) {
                    // SPAWN!
                    spawnCount--;
                    p.active = true;
                    p.progress = 0;
                    // Much wider range for "Random Size" effect via perspective
                    p.x = (Math.random() - 0.5) * 1200;
                    p.y = (Math.random() - 0.5) * 800;
                    p.z = -100 - Math.random() * 400; // -100 to -500

                    // Update Position immediately
                    positions[i * 3] = p.x;
                    positions[i * 3 + 1] = p.y;
                    positions[i * 3 + 2] = p.z;
                }
            }
        }

        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;

        // Gentle rotation
        this.group.rotation.z += 0.0005;
    }
}
