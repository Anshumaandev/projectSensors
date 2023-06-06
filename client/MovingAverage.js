export class MovingAverage {
  constructor(historyLength, staticResetVal = 0) {
    if (historyLength === 0) {
      historyLength = MovingAverage.DEFAULT_WINDOW_SIZE;
    }
    this.windowSize = historyLength;
    this.values = new Array(historyLength).fill(staticResetVal);
    this.sum = staticResetVal * historyLength;
    this.currentIndex = 0;
  }

  pushValue(value) {
    this.sum -= this.values[this.currentIndex];
    this.values[this.currentIndex] = value;
    this.sum += value;
    this.currentIndex = (this.currentIndex + 1) % this.windowSize;
    if (this.currentIndex === 0) {
      this.sum = this.values.reduce((sum, val) => sum + val, 0);
    }
    return this;
  }

  getAverage() {
    return this.sum / this.windowSize;
  }
}

MovingAverage.DEFAULT_WINDOW_SIZE = 10;
