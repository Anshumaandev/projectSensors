import React, { useState, useEffect, useRef, } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View, } from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import useWebSocket, { ReadyState } from "react-native-use-websocket";
import { ma, sma } from 'moving-averages'
import { Dimensions } from "react-native";
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { jsonToCSV } from 'react-native-csv'


import {
  LineChart,
} from "react-native-chart-kit";
import { VictoryLine, VictoryChart, VictoryScatter } from "victory-native";

const screenWidth = Dimensions.get("window").width;
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
      // console.log("i---->", i, val);
    }
    this.sum = val * this.windowSize;
    this.currentIndex = 0;
    // console.log(`Values:-------------------->`, val, this.sum, this.windowSize)
  }

  pushValue(value) {
    // console.log(value, "------------------VALUE")
    this.values[this.currentIndex] = value;
    this.sum -= this.values[this.currentIndex];
    // this.sum += this.values[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.windowSize;
    if (this.currentIndex === 0) {
      this.sum = 0;
      for (let i = 0; i < this.windowSize; i++) {
        this.sum += this.values[i];
      }
    }
    // console.log("IN FOR LOOP", this.sum)
    // console.log("THIS VALUES", this)
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
  //**-------- OLD Initializations---------  **// 
  let prevTs = 0;
  let pprevTs = -1;
  let prevAccelVal = 0;
  let prevPosVal = 0;
  let pprevPosVal = 0;
  // let prevVelocityVal = 0;
  const calibrationAdjustmentFactor = useRef(1); // set it to whatever value it should be
  // const [movingAvg, setmovingAvg] = useState(0);
  // const accelMovingAverage = new MovingAverage(10);
  // const [chartData, setChartData] = useState([]);
  // const [isSavingData, setIsSavingData] = useState(false);
  // const dataArray = useRef([]);
  // const accDataArray = useRef([]);
  // const isSavingDataRef = useRef(isSavingData);
  //**-------- OLD Initializations---------  **// 
  //**-------- NEW Initializations---------  **// 
  const [movingAvg, setmovingAvg] = useState(0);
  const [isSavingData, setIsSavingData] = useState(false);
  const [chartData, setChartData] = useState([]);
  const dataArray = useRef([]);
  const accDataArray = useRef([]);
  const isSavingDataRef = useRef(isSavingData);
  const accelMovingAverage = useRef(new MovingAverage(10));
  // const prevVelocityVal = useRef(0);


  //**-------- NEW Initializations for FILTER ACC METHOD---------  **// 
  let timestamp = null;
  let startTimestamp = null;
  let dT = null;
  let alpha = null;
  let gravity = new Array(0, 0, 0);
  let linearAcceleration = new Array(0, 0, 0);
  let output = new Array(0, 0, 0);
  let count = 0;
  let timeConstant = 1; // assign this according to your needs
  //**-------- NEW Initializations for FILTER ACC METHOD---------  **// 
  //**-------- NEW Initializations for Depth calculation---------  **// 
  const pumpWindow = useRef([]);
  const positions = useRef([]);
  const dir = useRef(Direction.UNKNOWN);
  const prevMin = useRef(0);
  const prevMax = useRef(0);
  const pPrevMax = useRef(Number.MIN_SAFE_INTEGER);
  const pPrevMaxTs = useRef(0);
  const prev = useRef(0);
  const prevMaxTs = useRef(0);
  const end_pos = useRef(0);
  const end_ts = useRef(0);
  const localMaximaDirDrag = useRef(0);
  const prevPump = useRef(NULL_PUMP);
  const begin_pos = useRef(0);
  const begin_ts = useRef(0);
  const lowest_point_ts = useRef(0);
  const lowest_pos = useRef(0);
  const [pumpValues, setPumpValues] = useState([null, null, null]);

  //**-------- NEW Initializations for Depth calculation---------  **// 

  // useEffect(()

  const [data, setData] = useState({
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
  const _slow = () => Accelerometer.setUpdateInterval(500);
  const _fast = () => Accelerometer.setUpdateInterval(35);


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


  const _subscribe = () => {
    // console.log("In subscribe-----")
    // console.log(readyState, socketUrl, ReadyState, "In subscribe-----")
    setSubscription(
      Accelerometer.addListener((measurement, time = Date.now() / 1000) => {
        if (readyState === ReadyState.OPEN) {
          console.log('sending')
          sendJsonMessage({
            type: 'iotdata',
            content: measurement,
            moving_average: estimatePosition(measurement, time)
          });
        }
        setData(measurement, time)
        let FilteredAccelValues = filterAcc(measurement, time)
        estimatePosition(FilteredAccelValues, measurement, time)
      }),
    );
  };

  const _unsubscribe = () => {
    subscription && subscription.remove();
    setSubscription(null);
  };

  const filterAcc = (acceleration, timestamp) => {

    // timestamp in milliseconds

    if (!startTimestamp) {
      startTimestamp = timestamp;
    }

    // Find the sample period (between updates).
    // Convert from milliseconds to seconds
    dT = 1.0 / (count / ((timestamp - startTimestamp) / 1.0E3));

    count++;
    alpha = timeConstant / (timeConstant + dT);

    let accx = acceleration.x * -9.81
    let accy = acceleration.y * -9.81
    let accz = acceleration.z * -9.81
    // let accx = Platform.OS === 'android' ? acceleration.x * -1 : acceleration.x
    // let accy = Platform.OS === 'android' ? acceleration.y * -1 : acceleration.y
    // let accz = Platform.OS === 'android' ? acceleration.z * -1 : acceleration.z

    if (!isNaN(alpha)) {
      gravity[0] = alpha * gravity[0] + (1.0 - alpha) * accx;
      gravity[1] = alpha * gravity[1] + (1.0 - alpha) * accy;
      gravity[2] = alpha * gravity[2] + (1.0 - alpha) * accz;

      linearAcceleration[0] = accx - gravity[0];
      linearAcceleration[1] = accy - gravity[1];
      linearAcceleration[2] = accz - gravity[2];

      output = [...linearAcceleration];
    }

    // return [accx, accy, accz];
    return linearAcceleration;

  }


  const estimatePosition = (accelVal, OGAccelVals, time) => {
    // console.log("accel values", OGAccelVals.z)
    // const avgAccelVal = accelMovingAverage.current.pushValue(accelVal[2]).getAverage();
    const avgAccelVal = accelMovingAverage.current.pushValue(accelVal[2]).getAverage();
    const [accVal, velocity, pos] = WestimatePosition(avgAccelVal, time);
    const csvData = { avgAccelVal, timestamp: time, OGaccValZ: OGAccelVals.z, Velocity: velocity, Position: pos, RawAccelValueX: accelVal[0], RawAccelValueY: accelVal[1], RawAccelValueZ: accelVal[2] };
    if (isSavingDataRef.current) {
      writeToCSV(csvData);
    }
    setmovingAvg(avgAccelVal);
    return avgAccelVal;
  };

  const prevVelocityVal = useRef(0);
  const WestimatePosition = (accelVal, time) => {
    let dT = time - prevTs;
    let pdT = prevTs - pprevTs;
    if (time === prevTs || time === pprevTs) {
      return [accelVal, prevVelocityVal.current, prevPosVal];
    } else if (prevTs === 0) {
      prevTs = time;
      return [accelVal, prevVelocityVal.current, prevPosVal];
    }
    else {
      if (isNaN(accelVal) || isNaN(prevAccelVal)) {
        return [accelVal, prevVelocityVal.current, prevPosVal];
      }
      console.log(prevVelocityVal.current, '-----', accelVal, prevAccelVal, dT, "BEFORE FORMULAE-------")
      let vel = (prevVelocityVal.current + (0.5 * (accelVal + prevAccelVal) * dT));
      let pos = (prevPosVal + ((1 - deltaResistance) * (prevPosVal - pprevPosVal) * (dT / pdT)) + accelVal * dT * dT);
      console.log(vel, "After FORMULAE-------");

      prevPosVal = pos;
      pprevPosVal = prevPosVal;
      pprevTs = prevTs;
      prevTs = time;
      prevVelocityVal.current = vel;
      prevAccelVal = accelVal;
      return [accelVal, vel, pos];
    }
  }

  const writeToCSV = async (data) => {
    if (!isSavingDataRef.current) return;
    // const csvRow = `${data.avgAccelVal},,${data.timestamp}\n`;
    const csvRow = `${data.avgAccelVal},${data.OGaccValZ},${data.timestamp},${data.Velocity},${data.Position}\n`;
    dataArray.current.push(csvRow);
    accDataArray.current.push({ x: dataArray.current.length, y: data.Velocity });
    setChartData([...accDataArray.current]);
    const results = jsonToCSV(dataArray);
  };


  const toggleSaveData = () => {
    if (!isSavingData) {
      // We are about to start saving, so clear the array
      accDataArray.current = [];
    }
    console.log(dataArray.current, dataArray.current.length, Platform.OS === 'ios' ? "IOS dATA" : "Android DATAAAAA")
    console.log(isSavingData, "IS SAVING DATA")
    setIsSavingData(!isSavingData);
    console.log(isSavingData, "IS SAVING DATA")
    if (isSavingData) {
      flushDataToCSV();
    }
  };

  const flushDataToCSV = async () => {
    try {
      const fileUri = FileSystem.cacheDirectory + 'accelerometer_data.csv';
      const fileExists = await FileSystem.getInfoAsync(fileUri);

      let currentFileContent = 'avgAccelVal,OGaccValZ,timestamp,Velocity,Positions\n';

      if (fileExists.exists) {
        currentFileContent = await FileSystem.readAsStringAsync(fileUri);
      }

      const newData = dataArray.current.join('');
      const newFileContent = currentFileContent + newData;

      await FileSystem.writeAsStringAsync(fileUri, newFileContent);
      dataArray.current = [];
    } catch (error) {
      console.error('Error writing to CSV:', error.message, error.stack);
    }
  };

  const deleteFile = async () => {
    accDataArray.current = [];
    try {
      const fileUri = FileSystem.cacheDirectory + 'accelerometer_data.csv';
      const fileInfo = await FileSystem.getInfoAsync(fileUri);

      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri);
        console.log('File deleted successfully');
        Alert.alert('File deleted successfully');
      } else {
        console.log('File does not exist');
        Alert.alert('File does not exist');
      }
    } catch (error) {
      console.error('Error deleting file:', error.message, error.stack);
    }
  };


  const shareCSV = async () => {
    try {
      const fileUri = FileSystem.cacheDirectory + 'accelerometer_data.csv';
      const fileExists = await FileSystem.getInfoAsync(fileUri);

      if (!fileExists.exists) {
        console.log('File not found');
        Alert.alert('No file found!!');
        return;
      }

      await Sharing.shareAsync(fileUri);
    } catch (error) {
      console.error('Error sharing CSV:', error);
    }
  };


  useEffect(() => {
    _subscribe();
    return () => {
      _unsubscribe()
    };
  }, []);


  useEffect(() => {
    isSavingDataRef.current = isSavingData;
  }, [isSavingData]);

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>

        {/* <Text style={styles.text}>Accelerometer Data:</Text>
        <Text style={styles.text}>x: {data.x}</Text>
        <Text style={styles.text}>y: {data.y}</Text>
        <Text style={styles.text}>z: {data.z}</Text> */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={subscription ? _unsubscribe : _subscribe} style={styles.button}>
            <Text>{subscription ? 'On' : 'Off'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={_slow} style={[styles.button, styles.middleButton]}>
            <Text>Normal</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={_fast} style={styles.button}>
            <Text>Fast</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={toggleSaveData} style={styles.button}>
            <Text>{isSavingData ? 'Stop Saving' : 'Start Saving'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={shareCSV} style={styles.button}>
            <Text>Share CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={deleteFile} style={[styles.button, { backgroundColor: "#cc2f26" }]}>
            <Text style={{ color: "white" }} >Delete CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.innerContainer}>

        <Text style={styles.text}>Estimated Position, moved Data:</Text>
        <Text style={styles.text}> {movingAvg ? movingAvg : "Loading..."}</Text>

      </View>
      <View>
        <VictoryChart width={Dimensions.get('screen').width - 60}>
          <VictoryLine data={chartData} x="x" y="y" />
        </VictoryChart>
      </View>
      {/* {!isSavingData ?
        : <></>
      } */}
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
