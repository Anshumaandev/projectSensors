import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import useWebSocket, { ReadyState } from "react-native-use-websocket";
import { ma, sma } from 'moving-averages'
const DEFAULT_WINDOW_SIZE = 10

class MovingAverage {
  static DEFAULT_WINDOW_SIZE = 10;
  windowSize;
  values = [];
  sum = 0;
  currentIndex = 0;

  constructor(historyLength, staticResetVal = 0) {
    this.windowSize = historyLength || MovingAverage.DEFAULT_WINDOW_SIZE;
    this.resetTo(staticResetVal);
  }

  resetTo(val) {
    for (let i = 0; i < this.windowSize; i++) {
      val = this.values[i]
    }
    console.log(`Values:--------------------_>`, val,)
    this.sum = val * this.windowSize;
    console.log("In for loop", val * this.windowSize)
    this.currentIndex = 0;
  }

  pushValue(value) {
    this.sum = this.sum - this.values[this.currentIndex];
    this.values[this.currentIndex] = value;
    this.sum += this.values[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.windowSize;
    if (this.currentIndex === 0) {
      this.sum = 0;
      for (let i = 0; i < this.windowSize; i++) {
        this.sum += this.values[i];
      }
    }
    console.log("THIS VALUES", 0 - this.values[this.currentIndex])
    return this;
  }

  getAverage() {
    return this.sum / this.windowSize;
  }
}


export default function App() {

  // const WS_URL = 'ws://192.168.1.127:8000'
  // const WS_URL = 'ws://172.58.176.170:8000'
  const WS_URL = 'ws://192.168.1.13:8000'
  // const WS_URL = 'ws://exp:/zmmcka0.shashank_anshumaan.8000.exp.direct'

  const [socketUrl] = React.useState(WS_URL);
  //Initializations
  let prevTs = Date.now(), pprevTs = -1;
  // let prevAccelVal = 0, prevVelocityVal = 0, prevPosVal = 0, pprevPosVal = 0;
  let deltaT = 0.01;
  const [prevAccelVal, setprevAccelVal] = useState(null);
  const [prevVelocityVal, setprevVelocityVal] = useState(0);
  const [prevPosVal, setprevPosVal] = useState(0);
  const [pprevPosVal, setpprevPosVal] = useState(0);
  const [movingAvg, setmovingAvg] = useState(0);
  const accelMovingAverage = new MovingAverage(10);


  let deltaResistance = 0.03;



  const {
    sendJsonMessage,
    readyState,
  } = useWebSocket(socketUrl, {
    onOpen: () => console.log('opened'),
    onClose: () => console.log('closed'),
    onMessage: (message) => console.log(message),
    //Will attempt to reconnect on all close events, such as server shutting down
    shouldReconnect: (closeEvent) => true,
  });

  const [{ x, y, z }, setData] = useState({
    x: 0,
    y: 0,
    z: 0,
  });
  const [{ a, b, c }, setGData] = useState({
    a: 0,
    b: 0,
    c: 0,
  });
  const [subscription, setSubscription] = useState(null);
  const _slow = () => Accelerometer.setUpdateInterval(1000);
  const _fast = () => Accelerometer.setUpdateInterval(50);

  const _subscribe = () => {
    // console.log("In subscribe-----")
    // console.log(readyState, socketUrl, ReadyState, "In subscribe-----")
    setSubscription(
      Accelerometer.addListener(measurement => {
        // console.log(readyState, ReadyState.OPEN, ReadyState.CLOSED, "ReadyS")
        if (readyState === ReadyState.OPEN) {
          console.log('sending')
          sendJsonMessage({
            type: 'iotdata',
            content: measurement,
            moving_average: estimatePosition(measurement, prevAccelVal)
          });
        }
        setData(measurement)
        setprevAccelVal(measurement);
        let prevAccelVal1 = measurement;

        console.log("Estimated Position=======>", estimatePosition(measurement, prevAccelVal))
        // setGData({ a: estimatePosition(measurement, Date.now())[0].x, b: estimatePosition(measurement, Date.now())[0].y, c: estimatePosition(measurement, Date.now())[0].z })

      }),
    );
  };

  const _unsubscribe = () => {
    subscription && subscription.remove();
    setSubscription(null);
  };

  // This method is called from estimatePosition
  const WestimatePosition = (accelVal) => {
    // console.log("prevTS--->", prevTs)
    let dT = Date.now() - prevTs;
    let pdT = prevTs - pprevTs;
    if (Date.now() === prevTs || Date.now() === pprevTs) { // Nothing to process if timestamps did not change
      console.log("HEREEEE if", Date.now(),)
      return [accelVal, prevVelocityVal, prevPosVal];
    } else if (prevTs === 0) { // Assumed timestamps should not be negative
      prevTs = Date.now();
      console.log("HEREEEE elif", Date.now(), Date.now())
      return [accelVal, prevVelocityVal, prevPosVal];
    }
    else {
      console.log("HERE-----__>>>", accelVal, prevAccelVal)
      // console.log("HEREEEE", prevAccelVal)
      setprevVelocityVal(prevVelocityVal + 0.5 * (accelVal + prevAccelVal) * dT)
      let vel = prevVelocityVal + 0.5 * (accelVal + prevAccelVal) * dT;
      let pos = prevPosVal + (1 - deltaResistance) * (prevPosVal - pprevPosVal) * (dT / pdT) + accelVal * dT * dT;
      // console.log("VEloCITYYYYYYYYYY------>>>", vel)

      // pprevPosVal = prevPosVal;
      // prevPosVal = pos;
      // pprevTs = prevTs;
      // prevTs = Date.now();
      // prevVelocityVal = vel;
      // prevAccelVal = accelVal;

      // console.log("in WESTIMATE====+>", accelVal, vel, pos, Date.now())
      // return [accelVal, vel, pos];
    }
  }

  const setPrevAccelVal = (accelVal) => {
    setpprevPosVal(prevPosVal);
    setprevPosVal(0);
    pprevTs = prevTs;
    prevTs = Date.now();
    setprevVelocityVal(0);
  }

  const estimatePosition = (accelVal, prevAccelVal) => {
    const avgAccelVal = accelMovingAverage.pushValue(accelVal).getAverage();
    const dT = Date.now() - prevTs;
    const pdT = prevTs - pprevTs;
    if (Date.now() === prevTs || Date.now() === pprevTs) {
      return prevPosVal;
    } else if (prevTs === 0) {
      prevTs = Date.now();
      return prevPosVal;
    }
    const vel = prevVelocityVal + (0.5 * (avgAccelVal + prevAccelVal) * dT);
    const pos = prevPosVal + ((1 - deltaResistance) * (prevPosVal - pprevPosVal) * (dT / pdT)) + 0.5 * (avgAccelVal + prevAccelVal) * dT * dT;
    console.log("avgAccelVal------->", avgAccelVal)
    setPrevAccelVal(avgAccelVal);
    return pos;
  };


  useEffect(() => {
    _subscribe();
    // _Gsubscribe();
    return () => {
      _unsubscribe()
      // _Gunsubscribe()
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>

        <Text style={styles.text}>Accelerometer Data:</Text>
        <Text style={styles.text}>x: {x}</Text>
        <Text style={styles.text}>y: {y}</Text>
        <Text style={styles.text}>z: {z}</Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={subscription ? _unsubscribe : _subscribe} style={styles.button}>
            <Text>{subscription ? 'On' : 'Off'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={_slow} style={[styles.button, styles.middleButton]}>
            <Text>Slow</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={_fast} style={styles.button}>
            <Text>Fast</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.innerContainer}>

        <Text style={styles.text}>Estimated Position, moved Data:</Text>
        <Text style={styles.text}> {movingAvg}</Text>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  innerContainer: {
    marginTop: 12,
    justifyContent: 'center',
    borderColor: "black",
    borderWidth: 1,
    borderRadius: 12,
    padding: 4

  },
  text: {
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 15,
  },
  button: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eee',
    padding: 10,
    borderRadius: 12
  },
  middleButton: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#ccc',
  },
});
