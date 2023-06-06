export class MovingAverage {
    constructor(historyLength, staticResetVal) {
      const DEFAULT_WINDOW_SIZE = 10;
      if (historyLength === 0) {
        historyLength = DEFAULT_WINDOW_SIZE;
      }
      this.windowSize = historyLength;
      this.values = new Array(historyLength).fill(staticResetVal);
      this.sum = staticResetVal * historyLength;
      this.currentIndex = 0;
    }
  
    resetTo(val) {
      for (let i = 0; i < this.windowSize; i++) {
        this.values[i] = val;
      }
      this.sum = val * this.windowSize;
      this.currentIndex = 0;
    }
  
    pushValue(value) {
      this.sum -= this.values[this.currentIndex];
      this.values[this.currentIndex] = value;
      this.sum += value;
      this.currentIndex = (this.currentIndex + 1) % this.windowSize;
      if (this.currentIndex === 0) {
        this.sum = this.values.reduce((acc, val) => acc + val, 0);
      }
      return this;
    }
  
    getAverage() {
      return this.sum / this.windowSize;
    }
  }