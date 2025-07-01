import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, Switch } from 'react-native';
import { decryptMasterKeyFromStorage } from '../crypto/crypto.utils';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import { getTheme } from '../styles/theme';
import { saveAuthToken } from '../services/secureStorage';
import { loginUser, getEncryptedMasterKeyForUser } from '../services/api'; // Simulated API calls

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { loginSuccess, setLoading, setError, isLoading, error: authError } = useAuthStore(); // Renamed error to authError
  const { isDarkMode, toggleTheme } = useThemeStore();
  const theme = getTheme(isDarkMode);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Email and password are required.');
      return;
    }

    setLoading(true);
    setError(null); // Clears auth error

    try {
      // 1. Simulate fetching the encryptedMasterKeyString for the user.
      // This string is expected to be: saltBase64:ivBase64:authTagBase64:ciphertextBase64
      const encryptedMasterKeyString = await getEncryptedMasterKeyForUser(email);
      if (!encryptedMasterKeyString) {
        throw new Error('User not found or no master key available.');
      }
      console.log('LoginScreen: Encrypted master key string fetched.');

      // 2. Decrypt the master key using the password.
      // This will parse the string, use the salt to derive KEK, then decrypt.
      // Returns the raw master key as ArrayBuffer.
      const rawMasterKeyArrayBuffer = await decryptMasterKeyFromStorage(encryptedMasterKeyString, password);
      console.log('LoginScreen: Master key decrypted successfully.');

      // 3. Call the login API endpoint (simulated)
      // This would typically verify the password against a hash on the server
      // or use a more complex challenge-response mechanism if the password itself is not sent.
      // For this simulation, we assume the server login validates the user and returns a token.
      const response = await loginUser(email, password); // { user, token }
      console.log('LoginScreen: Login API call successful.');

      // 4. Save auth token and update store with user data, token, and rawMasterKey
      await saveAuthToken(response.token);
      loginSuccess(response.user, response.token, rawMasterKeyArrayBuffer);

      Alert.alert('Success', 'Login successful!');
      // Navigate to the main app area
      // navigation.navigate('App'); // This will be set up later
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.message || 'An unexpected error occurred during login.'); // Sets auth error
      Alert.alert('Login Failed', err.message || 'An error occurred. Check credentials or try again.');
    } finally {
      setLoading(false);
    }
  };

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: 20,
      backgroundColor: theme.background,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      textAlign: 'center',
      color: theme.text,
    },
    input: {
      height: 40,
      borderColor: theme.border,
      borderWidth: 1,
      marginBottom: 12,
      paddingHorizontal: 10,
      borderRadius: 5,
      color: theme.text,
      backgroundColor: theme.inputBackground,
    },
    errorText: {
      color: theme.error,
      textAlign: 'center',
      marginBottom: 10,
    },
    themeSwitcherContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 20,
    },
    themeSwitcherText: {
      color: theme.text,
      marginRight: 10,
    }
  });

  return (
    <View style={dynamicStyles.container}>
      <Text style={dynamicStyles.title}>Login</Text>

      <View style={dynamicStyles.themeSwitcherContainer}>
        <Text style={dynamicStyles.themeSwitcherText}>Dark Mode</Text>
        <Switch
          trackColor={{ false: "#767577", true: theme.primary }}
          thumbColor={isDarkMode ? theme.secondary : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={toggleTheme}
          value={isDarkMode}
        />
      </View>

      <TextInput
        style={dynamicStyles.input}
        placeholder="Email"
        placeholderTextColor={theme.text} // Adjust placeholder color too
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={dynamicStyles.input}
        placeholder="Password"
        placeholderTextColor={theme.text} // Adjust placeholder color
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {isLoading && <ActivityIndicator size="large" color={theme.primary} />}
      {authError && <Text style={dynamicStyles.errorText}>{authError}</Text>}

      <Button title="Login" onPress={handleLogin} disabled={isLoading} color={theme.primary} />
      <View style={{ marginTop: 10 }} />
      <Button title="Go to Register" onPress={() => navigation.navigate('Register')} disabled={isLoading} color={theme.secondary}/>
    </View>
  );
};

// Original static styles can be kept for non-theme dependent parts or removed if all dynamic
const styles = StyleSheet.create({
  // ... (keep any non-theme dependent styles here or merge into dynamicStyles logic)
});

export default LoginScreen;
