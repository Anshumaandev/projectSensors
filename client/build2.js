import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import useWebSocket, { ReadyState } from "react-native-use-websocket";


export default function App() {
  const MovingAverage = require('./utils');
  const WS_URL = 'ws://192.168.1.13:8000';
  const [socketUrl] = useState(WS_URL);
  const [prevVelocityVal, setPrevVelocityVal] = useState(0);
  const [prevPosVal, setPrevPosVal] = useState(0);
  const [pprevPosVal, setPprevPosVal] = useState(0);
  const [movingAvg, setMovingAvg] = useState(0);
  const [subscription, setSubscription] = useState(null);
  const deltaResistance = 0.03;
  const accelMovingAverage = new MovingAverage(10);
  let prevTs = Date.now(), pprevTs = -1;

  const [{ x, y, z }, setData] = useState({
    x: 0,
    y: 0,
    z: 0,
  });

  const {
    sendJsonMessage,
    readyState,
  } = useWebSocket(socketUrl, {
    onOpen: () => console.log('opened'),
    onClose: () => console.log('closed'),
    onMessage: (message) => console.log(message),
    shouldReconnect: (closeEvent) => true,
  });

  const _slow = () => Accelerometer.setUpdateInterval(1000);
  const _fast = () => Accelerometer.setUpdateInterval(50);

  const setPrevAccelVal = (accelVal) => {
    pprevPosVal = prevPosVal;
    prevPosVal = 0;
    pprevTs = prevTs;
    prevTs = Date.now();
    prevVelocityVal = 0;
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
    setPrevAccelVal(avgAccelVal);
    return pos;
  };

  const _subscribe = () => {
    setSubscription(
      Accelerometer.addListener((measurement) => {
        if (readyState === ReadyState.OPEN) {
          console.log('sending');
          const movingAvg = estimatePosition(measurement.z, measurement.z);
          sendJsonMessage({
            type: 'iotdata',
            content: measurement,
            moving_average: movingAvg,
          });
          setData(measurement)
          setMovingAvg(movingAvg);
        }
      })
    );
  };

  const _unsubscribe = () => {
    subscription && subscription.remove();
    setSubscription(null);
  };

  useEffect(() => {
    _subscribe();
    return () => {
      _unsubscribe()
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