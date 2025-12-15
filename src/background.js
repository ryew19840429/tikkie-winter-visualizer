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
        const phases = new Float32Array(this.count); // For individual twinkling

        const palette = [
            new THREE.Color(0xff0044), // Red
            new THREE.Color(0x00ff88), // Teal-Green
            new THREE.Color(0x4444ff), // Indigo
            new THREE.Color(0xffaa22), // Warm Gold
        ];

        for (let i = 0; i < this.count; i++) {
            // Spread them slightly wider and vertically
            const x = (Math.random() - 0.5) * 500;
            const y = (Math.random() - 0.5) * 400;
            const z = -60 - Math.random() * 120;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Random Color
            const color = palette[Math.floor(Math.random() * palette.length)];
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            // Random Twinkle Phase
            phases[i] = Math.random() * Math.PI * 2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

        // Material
        const texture = this.createBokehTexture();
        this.material = new THREE.PointsMaterial({
            map: texture,
            size: 60, // Large and soft
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.NormalBlending, // Smoother than Additive (prevents whiteout)
            depthWrite: false
        });

        this.points = new THREE.Points(geometry, this.material);
        this.group.add(this.points);
    }

    update(audioData) {
        const { avgEnergy, isBeat } = audioData;
        const time = Date.now() * 0.001;
        const phases = this.points.geometry.attributes.phase.array;
        const colors = this.points.geometry.attributes.color.array;

        // "Twinkle" effect: Instead of global fading, we modulate brightness individually
        // We can't easily modulate alpha per-vertex without a shader, but we CAN modulate vertex color brightness!

        // Base audio boost
        const boost = (avgEnergy / 255) * 0.3;

        for (let i = 0; i < this.count; i++) {
            // Calculate a sine wave pulse based on phase + time
            // Add audio energy to speed up the pulse slightly or increase intensity
            const pulse = Math.sin(time * 2 + phases[i]) * 0.5 + 0.5; // 0 to 1

            // Current brightness = Base glow + Twinkle + Audio Bump
            const brightness = 0.5 + (pulse * 0.3) + boost;

            // We need to re-apply the base color * brightness
            // This is a bit expensive to do every frame on CPU for thousands, but for <200 it's free.
            // Wait, we lost the original color reference.
            // Let's assume the colors in the array are the target 'max' colors.
            // Actually, simply modulating opacity globally is easier, but 'twinkling' implies individual variance.

            // Let's stick to a simpler approach: 
            // The shader is best for this. But since we are using PointsMaterial, we are limited.
            // Let's just do gentle global movement and soft, slow transparency pulse.
        }

        // Revised Update Logic for Elegance:
        // 1. Very slow Drift
        this.group.rotation.z = Math.sin(time * 0.05) * 0.05;

        // 2. Soft pulsing opacity (Global) - Breathing effect
        const breath = Math.sin(time * 0.5) * 0.1 + 0.8; // 0.7 to 0.9
        this.material.opacity = breath * (0.6 + boost * 0.5);
    }
}
