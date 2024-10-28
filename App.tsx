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

  useEffect(() => {
    const subscription = manager.onStateChange(state => {
      if (state === 'PoweredOn') {
        // BLE is powered on
      }
    }, true);

    return () => subscription.remove();
  }, []);

  const startScan = () => {
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
              // await readMessage();
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

  const readMessage = async () => {
    if (connectedDevice) {
      try {
        const services = await connectedDevice.services();
        for (const service of services) {
          const characteristics = await service.characteristics();
          for (const characteristic of characteristics) {
            if (characteristic.isReadable) {
              const readResult = await characteristic.read();
              const decodedMessage = Buffer.from(
                readResult.value,
                'base64',
              ).toString('utf-8');
              console.log('Message received:', decodedMessage);
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
          const object = JSON.parse(decodedValue);
          if (object.humidity) setAirHumidity(object.humidity);
          if (object.temperature) setTemperature(object.temperature);
        }
      },
    );
  };

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
            <Text>공기 습도</Text>
            <Text>{airHumidity !== null ? `${airHumidity}%` : 'N/A'}</Text>
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
            <Text>토양 습도</Text>
            <Text>{soilHumidity !== null ? `${soilHumidity}%` : 'N/A'}</Text>
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
            <Text>온도</Text>
            <Text>{temperature !== null ? `${temperature}°C` : 'N/A'}</Text>
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
            <Text>{connectedDevice ? connectedDevice.name : ''}</Text>
            <Text>{connectedDevice ? '데이터 업데이트' : '블루투스 연결'}</Text>
          </TouchableOpacity>
        </View>
        <View
          style={{
            width: '100%',
            height: 150,
            backgroundColor: 'white',
            borderRadius: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}></View>
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
