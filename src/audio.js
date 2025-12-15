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

        let isBeat = false;
        if (normalizedEnergy > this.beatThreshold && normalizedEnergy > this.currentEnergy) {
            isBeat = true;
            this.beatThreshold = normalizedEnergy * 1.1; // Temporarily raise threshold
        } else {
            this.beatThreshold *= this.beatDecay; // Decay threshold
            this.beatThreshold = Math.max(this.beatThreshold, 0.3); // Min threshold
        }
        this.currentEnergy = normalizedEnergy;

        return {
            frequencyData: this.dataArray,
            waveform: this.timeDataArray,
            avgEnergy: average,
            isBeat: isBeat
        };
    }
}
