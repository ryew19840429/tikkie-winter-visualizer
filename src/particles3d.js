import * as THREE from 'three';

export class ParticleSystem3D {
    constructor(scene) {
        this.scene = scene;
        this.count = 4000; // High density
        this.particles = null;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.init();
    }

    init() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.count * 3);
        const colors = new Float32Array(this.count * 3);
        const velocities = []; // Store velocity per particle
        const originalPos = []; // Store base position for constraints

        // Define a bounding box for the cloud
        const range = 200;
        const color1 = new THREE.Color(0x00ffff); // Cyan
        const color2 = new THREE.Color(0x800080); // Purple
        const color3 = new THREE.Color(0xffffff); // White

        for (let i = 0; i < this.count; i++) {
            // Random Position in a wide cloud
            const x = (Math.random() - 0.5) * range;
            const y = (Math.random() - 0.5) * range * 0.5; // Flatter
            const z = (Math.random() - 0.5) * 100;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            originalPos.push({ x, y, z });
            velocities.push({
                x: (Math.random() - 0.5) * 0.1,
                y: (Math.random() - 0.5) * 0.1,
                z: (Math.random() - 0.5) * 0.1
            });

            // Color Gradient based on X position
            // Left = Cyan, Center = White, Right = Purple
            const t = (x / range) + 0.5; // 0 to 1
            const color = new THREE.Color();
            if (t < 0.5) {
                color.lerpColors(color1, color3, t * 2);
            } else {
                color.lerpColors(color3, color2, (t - 0.5) * 2);
            }

            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Material - Glowing Points
        const material = new THREE.PointsMaterial({
            size: 0.8, // Very fine
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false // Disable depth write for glow stacking
        });

        this.points = new THREE.Points(geometry, material);
        this.group.add(this.points);

        this.velocities = velocities;
        this.originalPos = originalPos;
    }

    update(audioData) {
        const { avgEnergy, isBeat, frequencyData } = audioData;
        const positions = this.points.geometry.attributes.position.array;

        const time = Date.now() * 0.001;

        // Speed modulation
        const baseSpeed = 0.5;
        const energySpeed = (avgEnergy / 255) * 2.0;
        const speed = baseSpeed + energySpeed;

        for (let i = 0; i < this.count; i++) {
            const ix = i * 3;
            let x = positions[ix];
            let y = positions[ix + 1];
            let z = positions[ix + 2];

            // Flow Field Noise Logic
            // Simple superposition of sine waves to simulate 3D noise/wind
            const noiseX = Math.sin(y * 0.05 + time) * Math.cos(z * 0.05 + time * 0.5);
            const noiseY = Math.cos(x * 0.05 + time) * Math.sin(z * 0.05 + time);
            const noiseZ = Math.sin(x * 0.05 + time * 0.8);

            // Apply Velocity
            x += noiseX * speed;
            y += noiseY * speed;
            z += noiseZ * speed;

            // Audio Reactivity: Jitter on Beat
            if (isBeat && i % 10 === 0) { // Optimize: not every particle needs complex beat logic
                y += (Math.random() - 0.5) * 2;
            }

            // Reset logic: wrap around or bounds check?
            // Let's pull them back to center if they drift too far
            const range = 200;
            if (x > range / 2) x = -range / 2;
            if (x < -range / 2) x = range / 2;
            if (y > range / 4) y = -range / 4;
            if (y < -range / 4) y = range / 4;
            // z wrap

            positions[ix] = x;
            positions[ix + 1] = y;
            positions[ix + 2] = z;
        }

        this.points.geometry.attributes.position.needsUpdate = true;

        // Subtle group rotation
        this.group.rotation.y = Math.sin(time * 0.1) * 0.1;
    }
}
