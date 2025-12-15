import * as THREE from 'three';

export class Grid3D {
    constructor(scene) {
        this.scene = scene;
        this.meshes = [];
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.cols = 8;
        this.rows = 0;
        this.resizeCooldown = 0;
        this.image = null;
    }

    init(image, cols = 8) {
        // Cleanup existing
        while (this.group.children.length > 0) {
            this.group.remove(this.group.children[0]);
        }
        this.meshes = [];

        this.image = image;
        this.cols = cols;
        const imgWidth = image.naturalWidth;
        const imgHeight = image.naturalHeight;

        const cellWidth = imgWidth / this.cols;
        this.rows = Math.round(imgHeight / cellWidth);
        const cellHeight = imgHeight / this.rows;

        // Texture
        const texture = new THREE.Texture(image);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;

        // Create Grid
        // We centre the grid at 0,0,0
        // Total World Width/Height
        const totalWorldW = 100; // Arbitrary units
        const scale = totalWorldW / imgWidth;
        const worldCellW = cellWidth * scale;
        const worldCellH = cellHeight * scale;

        const startX = -(totalWorldW / 2) + (worldCellW / 2);
        const startY = ((imgHeight * scale) / 2) - (worldCellH / 2);

        let index = 0;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                // UV Calculation
                // UVs range from 0 to 1
                // x goes 0 -> cols
                // y goes 0 -> rows
                // We need to map the sub-rectangle of the image to the face of the cube

                // Box Geometry default UVs map the whole texture to each face.
                // We need to modify them.
                const geometry = new THREE.BoxGeometry(worldCellW * 0.95, worldCellH * 0.95, 5); // Slight gap

                // Calculate UV range for this cell
                const uMin = x / this.cols;
                const uMax = (x + 1) / this.cols;

                // Three.js UV origin is bottom-left, typically. Image Y is top-down logic usually.
                // Let's check. 1 is top? 0 is bottom?
                // Standard UV: 0,0 is bottom-left. 1,1 is top-right.
                // Row y=0 is TOP row. So it should have v close to 1.
                // Row y=max is BOTTOM row. So v close to 0.
                const vMax = 1 - (y / this.rows);
                const vMin = 1 - ((y + 1) / this.rows);

                // Update UV attributes
                // BoxGeometry has 6 faces * 4 vertices = 24 vertices.
                // We only care about the front face (z+) which is usually indices 16-19 or similar? 
                // Actually easier to just check normal, but let's assume we map ALL faces or just front?
                // Let's map Front face only correctly, others can be gray.
                // Actually simpler: Let's use Material array. 
                // Front material gets the texture with Offset/Repeat.

                // Method 2: Texture Offset/Repeat
                // Each mesh gets its own material instance
                // This draws calls might be high (16*something) but for <1000 objects it's fine.
                const mat = new THREE.MeshBasicMaterial({ map: texture.clone() });
                mat.map.offset.set(uMin, vMin);
                mat.map.repeat.set(1 / this.cols, 1 / this.rows);
                mat.map.needsUpdate = true;

                // Side materials (dark)
                const darkMat = new THREE.MeshBasicMaterial({ color: 0x111122 });
                const materials = [
                    darkMat, // px
                    darkMat, // nx
                    darkMat, // py
                    darkMat, // ny
                    mat,     // pz (Front)
                    darkMat  // nz
                ];

                const mesh = new THREE.Mesh(geometry, materials);

                mesh.position.x = startX + (x * worldCellW);
                mesh.position.y = startY - (y * worldCellH);
                mesh.position.z = 0;

                // Metadata
                // Map to useful frequency range(0-256 usually has most energy)
                // We have ~hundreds of boxes. Let's map them to the first ~300 bins
                mesh.userData = {
                    baseX: mesh.position.x,
                    baseY: mesh.position.y,
                    baseZ: 0,
                    // Distribute indices across the active spectrum
                    mappedIndex: Math.floor((index / (this.cols * this.rows)) * 200),

                    // Animation State
                    targetScale: 1,
                    targetZ: 0,
                    targetRotX: 0,
                    targetRotY: 0,
                    targetRotZ: 0
                };

                this.meshes.push(mesh);
                this.group.add(mesh);
                index++;
            }
        }
    }

    update(audioData) {
        // Dynamic Resizing Logic - DISABLED per user request

        const { frequencyData, isBeat } = audioData;

        this.meshes.forEach(mesh => {
            const freq = frequencyData[mesh.userData.mappedIndex % frequencyData.length];
            // Boost reaction sensitivity
            const normFreq = freq / 255;

            // Logic
            mesh.userData.targetScale = 1;
            mesh.userData.targetZ = 0;
            mesh.userData.targetRotX = 0;
            mesh.userData.targetRotY = 0;
            mesh.userData.targetRotZ = 0;

            // Pulse (Low threshold for more movement)
            if (normFreq > 0.1) {
                mesh.userData.targetZ = normFreq * 30; // Stronger pop
            }

            // Beat Glitch
            if (isBeat && normFreq > 0.3) {
                mesh.userData.targetZ = 50 + (Math.random() * 20); // Big pop

                const rand = Math.random();
                if (rand < 0.3) {
                    // Spin X
                    mesh.userData.targetRotX = Math.PI;
                } else if (rand < 0.6) {
                    // Spin Y
                    mesh.userData.targetRotY = Math.PI;
                } else {
                    // Spin Z
                    mesh.userData.targetRotZ = Math.PI / 2;
                }
            }

            // Physics Lerp
            // Z
            mesh.position.z += (mesh.userData.targetZ - mesh.position.z) * 0.2;

            // Rotation
            // We accumulate rotation? Or start from 0? 
            // If target is PI, we want to go there. 
            // Ideally we just add rotation velocity, but let's stick to simple lerp to target for "glitch snap" look.
            // Actually, for spin, continuous rotation might be better. 
            // Let's simply lerp to the target offset from 0.

            mesh.rotation.x += (mesh.userData.targetRotX - mesh.rotation.x) * 0.1;
            mesh.rotation.y += (mesh.userData.targetRotY - mesh.rotation.y) * 0.1;
            mesh.rotation.z += (mesh.userData.targetRotZ - mesh.rotation.z) * 0.1;

            // Scale
            // mesh.scale.setScalar(mesh.userData.targetScale);
        });

        // Gentle Global Sway (Orbital Effect)
        // We rotate the whole group slightly to simulate camera movement
        // Keep it subtle: +/- 0.2 radians
        const time = Date.now() * 0.0005;
        this.group.rotation.y = Math.sin(time) * 0.2;
        this.group.rotation.x = Math.cos(time * 0.7) * 0.1;
    }
}
