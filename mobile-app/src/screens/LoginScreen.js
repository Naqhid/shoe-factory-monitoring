import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  Title,
  Text,
  ActivityIndicator,
} from ;
import { B;
import AsyncStorage from '@re
import { BarCodeScanner } from 'expo-barcode-scanner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [workCentre, setWorkCentre] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [machineId, setMachineId] = useState('');
  const [loginDateTime, setLoginDateTime] = useState('');
  const [showEmployeeScanner, setShowEmployeeScanner] = useState(false);
  const [showMachineScanner, setShowMachineScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Set current date time
    const now = new Date();
    setLoginDateTime(now.toLocaleString());
    
    // Update time every second
    const timer = setInterval(() => {
      setLoginDateTime(new Date().toLocaleString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Load work centre from storage (from previous login)
    loadWorkCentre();
  }, []);

  const loadWorkCentre = async () => {
    try {
      const savedWorkCentre = await AsyncStorage.getItem('workCentre');
      if (savedWorkCentre) {
        setWorkCentre(savedWorkCentre);
      }
    } catch (error) {
      console.error('Error loading work centre:', error);
    }
  };

  const requestCameraPermission = async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    setHasPermission(status === 'granted');
    return status === 'granted';
  };

  const handleEmployeeScan = async () => {
    const hasPermission = await requestCameraPermission();
    if (hasPermission) {
      setShowEmployeeScanner(true);
    } else {
      Alert.alert('Permission Required', 'Camera permission is required to scan QR codes');
    }
  };

  const handleMachineScan = async () => {
    const hasPermission = await requestCameraPermission();
    if (hasPermission) {
      setShowMachineScanner(true);
    } else {
      Alert.alert('Permission Required', 'Camera permission is required to scan QR codes');
    }
  };

  const handleEmployeeBarCodeScanned = ({ type, data }) => {
    setShowEmployeeScanner(false);
    
    try {
      // Assuming QR code contains JSON with employee data
      const employeeData = JSON.parse(data);
      setEmployeeId(employeeData.id || data);
      setEmployeeName(employeeData.name || 'Employee Name');
      
      Toast.show({
        type: 'success',
        text1: 'Employee Scanned',
        text2: `ID: ${employeeData.id || data}`,
      });
    } catch (error) {
      // If not JSON, treat as plain employee ID
      setEmployeeId(data);
      setEmployeeName('Employee Name'); // Would be fetched from API in real implementation
      
      Toast.show({
        type: 'success',
        text1: 'Employee Scanned',
        text2: `ID: ${data}`,
      });
    }
  };

  const handleMachineBarCodeScanned = ({ type, data }) => {
    setShowMachineScanner(false);
    setMachineId(data);
    
    Toast.show({
      type: 'success',
      text1: 'Machine Scanned',
      text2: `Machine ID: ${data}`,
    });
  };

  const validateForm = () => {
    if (!workCentre.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Work Centre is required',
      });
      return false;
    }
    
    if (!login.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Login is required',
      });
      return false;
    }
    
    if (!password.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Password is required',
      });
      return false;
    }
    
    if (!employeeId.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Employee ID is required',
      });
      return false;
    }
    
    if (!machineId.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Machine ID is required',
      });
      return false;
    }
    
    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Save work centre for future use
      await AsyncStorage.setItem('workCentre', workCentre);
      
      // Save login session data
      const sessionData = {
        workCentre,
        login,
        employeeId,
        employeeName,
        machineId,
        loginDateTime,
      };
      
      await AsyncStorage.setItem('sessionData', JSON.stringify(sessionData));
      
      // In real implementation, validate credentials with API
      // For now, simulate successful login
      
      Toast.show({
        type: 'success',
        text1: 'Login Successful',
        text2: 'Redirecting to Line Setup...',
      });
      
      // Navigate to Line Setup screen
      setTimeout(() => {
        navigation.navigate('LineSetup', { sessionData });
      }, 1500);
      
    } catch (error) {
      console.error('Login error:', error);
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: 'Please try again',
      });
    } finally {
      setLoading(false);
    }
  };

  if (showEmployeeScanner) {
    return (
      <View style={styles.scannerContainer}>
        <BarCodeScanner
          onBarCodeScanned={handleEmployeeBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.scannerOverlay}>
          <Text style={styles.scannerText}>Scan Employee ID QR Code</Text>
          <Button
            mode="contained"
            onPress={() => setShowEmployeeScanner(false)}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
        </View>
      </View>
    );
  }

  if (showMachineScanner) {
    return (
      <View style={styles.scannerContainer}>
        <BarCodeScanner
          onBarCodeScanned={handleMachineBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.scannerOverlay}>
          <Text style={styles.scannerText}>Scan Machine ID QR Code</Text>
          <Button
            mode="contained"
            onPress={() => setShowMachineScanner(false)}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>Factory Login</Title>
          <Paragraph style={styles.subtitle}>
            Enter your credentials and scan QR codes
          </Paragraph>
          
          <Divider style={styles.divider} />
          
          {/* Work Centre - Read Only */}
          <TextInput
            label="Work Centre"
            value={workCentre}
            onChangeText={setWorkCentre}
            mode="outlined"
            style={styles.input}
            placeholder="Enter work centre name"
          />
          
          {/* Login */}
          <TextInput
            label="Login"
            value={login}
            onChangeText={setLogin}
            mode="outlined"
            style={styles.input}
            placeholder="Enter your login"
            autoCapitalize="none"
          />
          
          {/* Password */}
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            style={styles.input}
            placeholder="Enter your password"
            secureTextEntry
          />
          
          <Divider style={styles.divider} />
          
          {/* Employee ID Scanner */}
          <View style={styles.scanSection}>
            <TextInput
              label="Employee ID"
              value={employeeId}
              onChangeText={setEmployeeId}
              mode="outlined"
              style={styles.scanInput}
              placeholder="Scan or enter employee ID"
            />
            <IconButton
              icon="qrcode-scan"
              size={30}
              onPress={handleEmployeeScan}
              style={styles.scanButton}
            />
          </View>
          
          {/* Employee Name - Read Only */}
          {employeeName ? (
            <TextInput
              label="Employee Name"
              value={employeeName}
              mode="outlined"
              style={styles.input}
              editable={false}
              right={<TextInput.Icon icon="account" />}
            />
          ) : null}
          
          {/* Machine ID Scanner */}
          <View style={styles.scanSection}>
            <TextInput
              label="Machine ID"
              value={machineId}
              onChangeText={setMachineId}
              mode="outlined"
              style={styles.scanInput}
              placeholder="Scan or enter machine ID"
            />
            <IconButton
              icon="qrcode-scan"
              size={30}
              onPress={handleMachineScan}
              style={styles.scanButton}
            />
          </View>
          
          {/* Login Date & Time - Read Only */}
          <TextInput
            label="Login Date & Time"
            value={loginDateTime}
            mode="outlined"
            style={styles.input}
            editable={false}
            right={<TextInput.Icon icon="clock" />}
          />
          
          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.loginButton}
            contentStyle={styles.buttonContent}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563EB',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  input: {
    marginBottom: 16,
  },
  scanSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  scanInput: {
    flex: 1,
    marginRight: 8,
  },
  scanButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },
  loginButton: {
    marginTop: 24,
    backgroundColor: '#2563EB',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  scannerContainer: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scannerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#DC2626',
  },
});