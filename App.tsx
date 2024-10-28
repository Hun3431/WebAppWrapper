import React, {useEffect, useState} from 'react';
import {
  Button,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
} from 'react-native';
import {BleManager, Device} from 'react-native-ble-plx';

const manager = new BleManager();

function App(): React.JSX.Element {
  const [scanDeviceModalVisible, setScanDeviceModalVisible] =
    useState<boolean>(false);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [message, setMessage] = useState('');

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
              const message = 'Hello ESP32!';
              const encodedMessage = Buffer.from(message).toString('base64');
              await characteristic.writeWithResponse(encodedMessage);
              console.log('Message sent successfully');
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
            onPress={startScan}>
            <Text>{devices ? connectedDevice?.name : '블루투스 연결'}</Text>
            <Text>{devices ? '연결됨' : ''}</Text>
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
