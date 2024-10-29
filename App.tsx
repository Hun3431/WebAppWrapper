import React, {useEffect, useState} from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
} from 'react-native';
import {BleManager, Device} from 'react-native-ble-plx';
import {Buffer} from 'buffer';
global.Buffer = Buffer;

import {PermissionsAndroid, Platform} from 'react-native';

const requestBlePermissions = async () => {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      return (
        result['android.permission.BLUETOOTH_CONNECT'] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        result['android.permission.BLUETOOTH_SCAN'] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        result['android.permission.ACCESS_FINE_LOCATION'] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  }
  return true;
};

const manager = new BleManager();

// ESP32 서비스 및 특성 UUID 추가
const ESP32_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const ESP32_CHARACTERISTIC_UUID_TX = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

function App(): React.JSX.Element {
  const [scanDeviceModalVisible, setScanDeviceModalVisible] =
    useState<boolean>(false);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [message, setMessage] = useState('');
  // 새로운 상태 추가
  const [airHumidity, setAirHumidity] = useState<number | null>(null);
  const [soilHumidity, setSoilHumidity] = useState<number | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);

  const [red, setRed] = useState<number>(120);
  const [green, setGreen] = useState<number>(120);
  const [blue, setBlue] = useState<number>(120);

  useEffect(() => {
    const subscription = manager.onStateChange(state => {
      if (state === 'PoweredOn') {
        // BLE is powered on
      }
    }, true);

    return () => subscription.remove();
  }, []);

  const startScan = async () => {
    if (Platform.OS === 'android') {
      const hasPermission = await requestBlePermissions();
      if (!hasPermission) return;
    }
    setScanDeviceModalVisible(true);
    if (!isScanning) {
      setDevices([]);
      setIsScanning(true);
      manager.startDeviceScan(null, null, (error, scannedDevice) => {
        if (error) {
          console.log('Scanning error:', error);
          setIsScanning(false);
          return;
        }

        if (scannedDevice) {
          if (scannedDevice.name != null) {
            setDevices(prevDevices => {
              if (!prevDevices.find(d => d.id === scannedDevice.id)) {
                return [...prevDevices, scannedDevice];
              }
              return prevDevices;
            });
          }
        }
      });

      // Stop scanning after 5 seconds
      setTimeout(() => {
        manager.stopDeviceScan();
        setIsScanning(false);
      }, 5000);
    }
  };

  const connectToDevice = async (device: Device) => {
    try {
      const connectedDevice = await device.connect();
      const discoveredDevice =
        await connectedDevice.discoverAllServicesAndCharacteristics();
      setConnectedDevice(discoveredDevice);

      console.log('Connected to device:', discoveredDevice.name);
      setScanDeviceModalVisible(false);
      startMonitoringData(discoveredDevice);
    } catch (error) {
      console.log('Connection error:', error);
    }
  };

  const sendMessage = async () => {
    if (connectedDevice) {
      try {
        const services = await connectedDevice.services();
        for (const service of services) {
          const characteristics = await service.characteristics();
          for (const characteristic of characteristics) {
            if (characteristic.isWritableWithResponse) {
              const message = 'get_temp_humidity';
              const encodedMessage = Buffer.from(message).toString('base64');
              await characteristic.writeWithResponse(encodedMessage);
              console.log('Message sent successfully');
              // await readMessage(); // 이 줄을 주석 처리하거나 제거
              await startMonitoringData(connectedDevice);
              return; // 메시지를 성공적으로 보냈으면 함수를 종료
            }
          }
        }
        console.log('No writable characteristic found');
      } catch (error) {
        console.log('Error sending message:', error);
      }
    } else {
      console.log('No device connected');
    }
  };

  const sendColor = async () => {
    if (connectedDevice) {
      try {
        const services = await connectedDevice.services();
        for (const service of services) {
          const characteristics = await service.characteristics();
          for (const characteristic of characteristics) {
            if (characteristic.isWritableWithResponse) {
              const message = `rgb(${red},${green},${blue})`;
              const encodedMessage = Buffer.from(message).toString('base64');
              await characteristic.writeWithResponse(encodedMessage);
              console.log('Message sent successfully');
              // await readMessage();
              await startMonitoringData(connectedDevice);
              return;
            }
          }
        }
        console.log('No writable characteristic found');
      } catch (error) {
        console.log('Error sending message:', error);
      }
    } else {
      console.log('No device connected');
    }
  };

  const renderDeviceItem = ({item}: {item: Device}) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => connectToDevice(item)}>
      <Text style={{fontSize: 16}}>{item.name || 'Unknown Device'}</Text>
      <View
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
        }}>
        <View
          style={{
            height: '25%',
            backgroundColor: '#d1d1d1',
            width: 4,
            marginRight: 1,
          }}
        />
        <View
          style={{
            height: '50%',
            backgroundColor: '#d1d1d1',
            width: 4,
            marginRight: 1,
          }}
        />
        <View
          style={{
            height: '75%',
            backgroundColor: '#d1d1d1',
            width: 4,
            marginRight: 1,
          }}
        />
        <View style={{height: '100%', backgroundColor: '#d1d1d1', width: 4}} />
      </View>
    </TouchableOpacity>
  );

  const ScanDeviceModal = () => {
    if (scanDeviceModalVisible) {
      return (
        <TouchableOpacity
          style={styles.deviceModal}
          onPress={() => {
            setScanDeviceModalVisible(false);
            setIsScanning(false);
          }}>
          <View style={styles.modalContainer}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: 700,
                textAlign: 'center',
                marginTop: 10,
                marginBottom: 10,
              }}>
              연결 가능한 디바이스
            </Text>
            <FlatList
              data={devices}
              renderItem={renderDeviceItem}
              keyExtractor={item => item.id}
              style={styles.list}
            />
          </View>
        </TouchableOpacity>
      );
    }
    return <></>;
  };

  // 데이터 수신 모니터링 함수
  const startMonitoringData = (device: Device) => {
    device.monitorCharacteristicForService(
      ESP32_SERVICE_UUID,
      ESP32_CHARACTERISTIC_UUID_TX,
      (error, characteristic) => {
        if (error) {
          console.log('Error monitoring:', error);
          return;
        }
        if (characteristic?.value) {
          const decodedValue = Buffer.from(
            characteristic.value,
            'base64',
          ).toString('utf-8');
          console.log('Received data:', decodedValue);
          try {
            const object = JSON.parse(decodedValue);
            if (object.h) setAirHumidity(object.h);
            if (object.t) setTemperature(object.t);
          } catch (error) {
            // console.error(error);
          }
        }
      },
    );
  };

  // 데이터를 2초마다 갱신시킴(온습도)
  useEffect(() => {
    if (connectedDevice) {
      const intervalFunction = () => {
        sendMessage();
      };
      const intervalId = setInterval(intervalFunction, 2000);
    }
  }, [connectedDevice]);

  return (
    <SafeAreaView style={styles.container}>
      <Image
        source={require('./image/bgImage.png')}
        style={{
          width: '100%',
          height: 300,
          resizeMode: 'cover',
          position: 'absolute',
          top: 0,
        }}
      />
      <View
        style={{
          width: '100%',
          backgroundColor: '#d9d9d9',
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          padding: 30,
          display: 'flex',
          flexDirection: 'column',
          position: 'absolute',
          bottom: 0,
        }}>
        <View
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 30,
          }}>
          <View
            style={{
              width: 150,
              height: 150,
              backgroundColor: 'white',
              borderRadius: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{fontSize: 20, fontWeight: 700}}>공기 습도</Text>
            <Text style={{fontSize: 28, fontWeight: 400, marginTop: 10}}>
              {airHumidity !== null ? `${airHumidity}%` : ''}
            </Text>
          </View>
          <View
            style={{
              width: 150,
              height: 150,
              backgroundColor: 'white',
              borderRadius: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{fontSize: 20, fontWeight: 700}}>토양 습도</Text>
            <Text style={{fontSize: 28, fontWeight: 400, marginTop: 10}}>
              {soilHumidity !== null ? `${soilHumidity}%` : ''}
            </Text>
          </View>
        </View>
        <View
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 30,
          }}>
          <View
            style={{
              width: 150,
              height: 150,
              backgroundColor: 'white',
              borderRadius: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{fontSize: 20, fontWeight: 700}}>온도</Text>
            <Text style={{fontSize: 28, fontWeight: 400, marginTop: 10}}>
              {temperature !== null ? `${temperature}°C` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={{
              width: 150,
              height: 150,
              backgroundColor: 'white',
              borderRadius: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={connectedDevice ? sendMessage : startScan}>
            <Text style={{fontSize: 20, fontWeight: 700}}>
              {connectedDevice ? connectedDevice.name : '블루투스 연결'}
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={{
            width: '100%',
            height: 150,
            backgroundColor: 'white',
            borderRadius: 30,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 20,
          }}>
          <View
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
            <TouchableOpacity
              style={{
                width: 50,
                height: 30,
                backgroundColor: '#EEEEEE',
                borderTopRightRadius: 10,
                borderTopLeftRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => {
                if (red < 255) setRed(red + 5);
              }}>
              <Text>+</Text>
            </TouchableOpacity>
            <View
              style={{
                width: 50,
                height: 50,
                backgroundColor: 'red',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Text style={{fontWeight: 700, color: 'white'}}>{red}</Text>
            </View>
            <TouchableOpacity
              style={{
                width: 50,
                height: 30,
                backgroundColor: '#EEEEEE',
                borderBottomRightRadius: 10,
                borderBottomLeftRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => {
                if (red > 0) setRed(red - 5);
              }}>
              <Text>-</Text>
            </TouchableOpacity>
          </View>
          <View
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
            <TouchableOpacity
              style={{
                width: 50,
                height: 30,
                backgroundColor: '#EEEEEE',
                borderTopRightRadius: 10,
                borderTopLeftRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => {
                if (green < 255) setGreen(green + 5);
              }}>
              <Text>+</Text>
            </TouchableOpacity>
            <View
              style={{
                width: 50,
                height: 50,
                backgroundColor: 'green',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Text style={{fontWeight: 700, color: 'white'}}>{green}</Text>
            </View>
            <TouchableOpacity
              style={{
                width: 50,
                height: 30,
                backgroundColor: '#EEEEEE',
                borderBottomRightRadius: 10,
                borderBottomLeftRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => {
                if (green > 0) setGreen(green - 5);
              }}>
              <Text>-</Text>
            </TouchableOpacity>
          </View>
          <View
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
            <TouchableOpacity
              style={{
                width: 50,
                height: 30,
                backgroundColor: '#EEEEEE',
                borderTopRightRadius: 10,
                borderTopLeftRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => {
                if (blue < 255) setBlue(blue + 5);
              }}>
              <Text>+</Text>
            </TouchableOpacity>
            <View
              style={{
                width: 50,
                height: 50,
                backgroundColor: 'blue',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Text style={{fontWeight: 700, color: 'white'}}>{blue}</Text>
            </View>
            <TouchableOpacity
              style={{
                width: 50,
                height: 30,
                backgroundColor: '#EEEEEE',
                borderBottomRightRadius: 10,
                borderBottomLeftRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => {
                if (blue > 0) setBlue(blue - 5);
              }}>
              <Text>-</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
            onPress={sendColor}>
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 50,
                backgroundColor: `rgb(${red}, ${green}, ${blue})`,
              }}
            />
          </TouchableOpacity>
        </View>
      </View>
      <ScanDeviceModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  list: {
    flex: 1,
    width: '100%',
  },
  deviceModal: {
    position: 'absolute',
    zIndex: 10,
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: 'gray',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContainer: {
    width: '80%',
    height: '60%',
    borderWidth: 1,
    borderRadius: 20,
    padding: 10,
    backgroundColor: 'white',
  },
  deviceItem: {
    display: 'flex',
    width: '100%',
    justifyContent: 'space-between',
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  connectedDevice: {
    marginTop: 20,
    alignItems: 'center',
  },
});

export default App;
