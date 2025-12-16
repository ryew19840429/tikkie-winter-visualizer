export class AudioController {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048; // Higher resolution
        this.analyser.smoothingTimeConstant = 0.6; // Snappier response
        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);
        this.timeDataArray = new Uint8Array(this.bufferLength); // For waveform
        this.source = null;
        this.audioBuffer = null;
        this.isPlaying = false;

        // Beat detection variables
        this.beatThreshold = 0.5;
        this.beatDecay = 0.95;
        this.currentEnergy = 0;
    }

    async loadFile(file) {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        if (this.source) {
            this.source.stop();
        }

        const arrayBuffer = await file.arrayBuffer();
        this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

        this.play();
    }

    play() {
        if (!this.audioBuffer) return;

        this.source = this.ctx.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
        this.source.start(0);
        this.isPlaying = true;

        this.source.onended = () => {
            this.isPlaying = false;
        };
    }

    update() {
        this.analyser.getByteFrequencyData(this.dataArray);
        this.analyser.getByteTimeDomainData(this.timeDataArray);
    }

    getAudioData() {
        // Calculate average energy for beat detection
        let sum = 0;
        for (let i = 0; i < this.bufferLength; i++) {
            sum += this.dataArray[i];
        }
        const average = sum / this.bufferLength;
        const normalizedEnergy = average / 256;

        // Low-Frequency Beat Detection (Kicks)
        // FFT Size 2048, Sample Rate ~44100 -> Bin width ~21.5 Hz
        // We want ~20Hz to ~160Hz. So roughly bins 1 to 8.
        let bassSum = 0;
        let bassCount = 0;
        for (let i = 1; i < 10; i++) {
            bassSum += this.dataArray[i];
            bassCount++;
        }
        const bassAverage = bassSum / bassCount;
        const normalizedBass = bassAverage / 255;

        let isBeat = false;
        // Use BASS energy for thresholding, not overall average
        if (normalizedBass > this.beatThreshold && normalizedBass > this.currentEnergy) {
            isBeat = true;
            this.beatThreshold = normalizedBass * 1.1; // Jump threshold
        } else {
            this.beatThreshold *= 0.90; // Faster decay for snappier beats
            this.beatThreshold = Math.max(this.beatThreshold, 0.4); // Higher floor
        }

        // Prevent double-triggering too fast? 
        // Logic handles this via threshold jumping above current energy

        this.currentEnergy = normalizedBass;

        return {
            frequencyData: this.dataArray,
            waveform: this.timeDataArray,
            avgEnergy: average,
            isBeat: isBeat
        };
    }
}
