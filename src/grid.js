export class GridCell {
    constructor(image, sx, sy, sw, sh, x, y, w, h) {
        this.image = image;
        this.sx = sx; // Source X
        this.sy = sy; // Source Y
        this.sw = sw; // Source Width
        this.sh = sh; // Source Height
        this.x = x;   // Dest X
        this.y = y;   // Dest Y
        this.w = w;   // Dest Width
        this.h = h;   // Dest Height

        this.baseX = x;
        this.baseY = y;
        this.baseW = w;
        this.baseH = h;

        // Animation State
        this.scale = 1;
        this.targetScale = 1;
        this.rotation = 0;
        this.targetRotation = 0;
        this.opacity = 1;
        this.targetOpacity = 1;

        // New Variations
        this.scaleX = 1;
        this.scaleY = 1;
        this.targetScaleX = 1;
        this.targetScaleY = 1;

        this.offsetX = 0;
        this.offsetY = 0;
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;

        this.mappedIndex = 0; // Frequency bin assignment
    }

    update(audioData) {
        const { frequencyData, isBeat } = audioData;
        const freqValue = frequencyData[this.mappedIndex % frequencyData.length];
        const normalizedFreq = freqValue / 255;

        // --- Reactivity Logic ---

        // Default State (Reset)
        this.targetScale = 1;
        this.targetRotation = 0;
        this.targetScaleX = 1;
        this.targetScaleY = 1;
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
        this.targetOpacity = 1;

        // Active State (Pulse)
        if (normalizedFreq > 0.4) {
            this.targetScale = 1 - (normalizedFreq * 0.1);
        }

        // Beat State (Aggressive Glitch)
        if (isBeat && normalizedFreq > 0.5) {
            this.targetScale = 0.8;

            // Random Variation Picker
            const rand = Math.random();

            if (rand < 0.25) {
                // Variation 1: Rotation
                const rotations = [0, 90, 180, -90];
                this.targetRotation = rotations[Math.floor(Math.random() * rotations.length)] * (Math.PI / 180);
            } else if (rand < 0.5) {
                // Variation 2: Flip
                if (Math.random() > 0.5) this.targetScaleX = -1;
                else this.targetScaleY = -1;
            } else if (rand < 0.75) {
                // Variation 3: Slide/Jitter
                this.targetOffsetX = (Math.random() - 0.5) * 20;
                this.targetOffsetY = (Math.random() - 0.5) * 20;
            } else {
                // Variation 4: Flash Opacity
                this.opacity = 0.4;
            }
        } else if (!isBeat) {
            // Keep rotation logic sticky if needed, or reset?
            // Let's reset rotation slowly or just keep it 0
        }

        // --- Physics Lerp ---
        this.scale += (this.targetScale - this.scale) * 0.2;
        this.rotation += (this.targetRotation - this.rotation) * 0.15;
        this.scaleX += (this.targetScaleX - this.scaleX) * 0.2;
        this.scaleY += (this.targetScaleY - this.scaleY) * 0.2;
        this.offsetX += (this.targetOffsetX - this.offsetX) * 0.2;
        this.offsetY += (this.targetOffsetY - this.offsetY) * 0.2;
        this.opacity += (this.targetOpacity - this.opacity) * 0.1;
    }

    draw(ctx) {
        const cx = this.x + this.offsetX + this.w / 2;
        const cy = this.y + this.offsetY + this.h / 2;

        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(cx, cy);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale * this.scaleX, this.scale * this.scaleY); // Apply flips

        ctx.drawImage(
            this.image,
            this.sx, this.sy, this.sw, this.sh,
            -this.w / 2, -this.h / 2, this.w, this.h
        );
        ctx.restore();
    }
}

export class GridSystem {
    constructor() {
        this.cells = [];
        this.cols = 16;
        this.rows = 0; // Calculated based on aspect ratio
    }

    init(image) {
        this.cells = [];
        const imgWidth = image.naturalWidth;
        const imgHeight = image.naturalHeight;

        // Calculate Grid
        // We want 16 columns.
        const cellWidth = imgWidth / this.cols;
        // Rows depend on maintaining aspect ratio of cells (square cells? or image ratio cells?)
        // User said "equal sized boxes". Let's assume the grid cells tile the image perfectly.
        // So cellHeight should probably preserve the ratio if we want the logo to look correct.
        // Actually, if we want "equal sized boxes" (squares), we might crop.
        // But "logo is not legible anymore" implies we should keep the full image.
        // Let's just divide the height by the same cellWidth to get square-ish cells, 
        // OR just divide height by X rows where X is calculated to keep aspect ratio.

        const cellHeight = cellWidth; // Let's try square cells first
        this.rows = Math.ceil(imgHeight / cellHeight);

        // Calculate Screen Display Size
        // We want to fit the logo on screen with some padding.
        // Max width 80% of screen
        const maxScreenWidth = window.innerWidth * 0.8;
        const displayScale = maxScreenWidth / imgWidth;

        const displayCellWidth = cellWidth * displayScale;
        const displayCellHeight = cellHeight * displayScale;

        const startX = (window.innerWidth - (displayCellWidth * this.cols)) / 2;
        const startY = (window.innerHeight - (displayCellHeight * this.rows)) / 2;

        let index = 0;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                // Image Source Coords
                const sx = x * cellWidth;
                const sy = y * cellHeight;

                // Ensure we don't go out of bounds (bottom row might be partial)
                // drawImage handles out of bounds source gracefully usually, but good to be safe.
                // We'll just pass the coords.

                // Screen Dest Coords
                const dx = startX + (x * displayCellWidth);
                const dy = startY + (y * displayCellHeight);

                const cell = new GridCell(
                    image,
                    sx, sy, cellWidth, cellHeight,
                    dx, dy, displayCellWidth, displayCellHeight
                );

                // Map to unique frequency bin
                // We have ~16 * ~10 = 160 cells. 
                // We have 2048 bins. We can space them out or pick random useful bins.
                // Low Freqs (Bass) are at lower indices. 
                // Let's map radially or linear? 
                // Linear mapping X major:
                cell.mappedIndex = index * 2; // Skip every other bin to spread it out

                this.cells.push(cell);
                index++;
            }
        }
    }

    update(audioData) {
        this.cells.forEach(cell => cell.update(audioData));
    }

    draw(ctx) {
        this.cells.forEach(cell => cell.draw(ctx));
    }
}
