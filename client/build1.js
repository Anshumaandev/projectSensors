import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import useWebSocket, { ReadyState } from "react-native-use-websocket";
import { ma, sma } from 'moving-averages'



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

  const estimatePosition = (accelVal, prevaccval) => {
    let accelMovingAverage = sma([accelVal.x, accelVal.y, accelVal.z], Date.now());
    console.log("Moving avg------->>", accelMovingAverage)
    const average = array => array.reduce((a, b) => a + b) / array.length;
    let avg = average(accelMovingAverage);
    console.log("Estimate Position, accelVal average is...", avg);
    setmovingAvg(avg);
    return avg;
    // let prevAccelVal = accelVal;
    // let dT = Date.now()
    // let pdT = dT
    // let prevVelVal = prevVelocityVal + 0.5 * (accelVal + prevAccelVal) * dT
    // let pos = prevPosVal + (1 - deltaResistance) * (prevPosVal - pprevPosVal) * (dT / pdT) + accelVal * dT * dT;
    // let prevPosVal = pos;
    
    // // compare current and previous accelerometer values
    // let diff = {
    //   x: Math.abs(accelVal.x - prevaccval.x),
    //   y: Math.abs(accelVal.y - prevaccval.y),
    //   z: Math.abs(accelVal.z - prevaccval.z)
    // };
    
    // console.log("VALUES=-==========>>",prevaccval,accelVal, diff)
    // // print difference if it's greater than 0.1 in all fields
    // if (diff.x > 0.01 || diff.y > 0.01 || diff.z > 0.01) {
    //   console.log(`Acceleration difference===================: x=${diff.x}, y=${diff.y}, z=${diff.z}`);
    // }

    // update previous accelerometer value for next comparison
    // prevAccelVal = accelVal;

    // getPreviousValues()
    let ret = WestimatePosition(accelVal);
    // console.log([ret[0], ret[1], ret[2]], "ret----------")
    // return [ret[0], ret[1], ret[2]];
  }

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
