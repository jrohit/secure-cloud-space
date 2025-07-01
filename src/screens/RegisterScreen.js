import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { generateMasterKey, encryptMasterKeyForStorage } from '../crypto/crypto.utils';
import useAuthStore from '../store/authStore';
import { saveAuthToken } from '../services/secureStorage';
import { registerUser } from '../services/api'; // Simulated API call

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { loginSuccess, setLoading, setError, isLoading, error } = useAuthStore();

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Generate a new raw master key (base64 encoded)
      const rawMasterKeyBase64 = await generateMasterKey();
      console.log('RegisterScreen: Raw master key generated.');

      // 2. Encrypt the master key with the password for storage
      // This will produce the string: saltBase64:ivBase64:authTagBase64:ciphertextBase64
      const encryptedMasterKeyString = await encryptMasterKeyForStorage(rawMasterKeyBase64, password);
      console.log('RegisterScreen: Master key encrypted for storage.');

      // 3. Call the registration API
      // The simulated registerUser function should return { user, token }
      const response = await registerUser(name, email, password, encryptedMasterKeyString);
      console.log('RegisterScreen: Registration API call successful.');

      // 4. On successful registration, the server returns user data and an auth token.
      // The rawMasterKey (ArrayBuffer) needs to be derived again for in-memory storage,
      // or the server could potentially return it if the registration implies immediate login.
      // For simplicity, let's assume registration implies login and we can use the generated raw key.
      // However, a more secure flow might involve a separate login step or careful handling.
      // For this simulation, we'll re-derive it to ensure the KEK is correctly used.
      // OR, even better, the loginSuccess action should handle decrypting it if needed.
      // Let's assume for now the rawMasterKeyBase64 is what we need to store in ArrayBuffer form.

      // To get the ArrayBuffer of the rawMasterKey to store in Zustand:
      // (This step is slightly redundant if generateMasterKey returned ArrayBuffer directly,
      // but we made it return base64. So we convert it back here for in-memory store)
      // This is a conceptual step; the actual rawMasterKey needs to be available post-login.
      // For registration that logs the user in, the `rawMasterKeyBase64` is the key.
      // We need its ArrayBuffer form for crypto operations.
      const { base64ToArrayBuffer } = await import('../crypto/crypto.utils'); // Dynamic import for clarity
      const rawMasterKeyArrayBuffer = base64ToArrayBuffer(rawMasterKeyBase64);


      // 5. Save auth token and update store
      await saveAuthToken(response.token);
      loginSuccess(response.user, response.token, rawMasterKeyArrayBuffer); // Store raw key in memory

      Alert.alert('Success', 'Registration successful!');
      // Navigate to the main app area (e.g., Home or Profile)
      // navigation.navigate('App'); // This will be set up later
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.message || 'An unexpected error occurred during registration.');
      Alert.alert('Registration Failed', err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {isLoading && <ActivityIndicator size="large" color="#0000ff" />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Button title="Register" onPress={handleRegister} disabled={isLoading} />
      <Button title="Go to Login" onPress={() => navigation.navigate('Login')} disabled={isLoading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
});

export default RegisterScreen;
