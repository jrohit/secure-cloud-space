import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ProfileScreen from '../screens/ProfileScreen'; // Placeholder for a home/main screen

import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import { getTheme } from '../styles/theme';
import { getAuthToken } from '../services/secureStorage'; // To check initial token state

const Stack = createStackNavigator();

// Authentication Stack (Login, Register)
const AuthStack = () => {
  const { isDarkMode } = useThemeStore();
  const theme = getTheme(isDarkMode);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: 'bold' },
      }}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
    </Stack.Navigator>
  );
};

// Main Application Stack (after login)
// For now, it just has Profile. Could be a Tab Navigator or more complex Stack.
const AppStack = () => {
  const { isDarkMode } = useThemeStore();
  const theme = getTheme(isDarkMode);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: 'bold' },
      }}>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      {/* Add other main app screens here, e.g., HomeScreen, FileListScreen, etc. */}
      {/* <Stack.Screen name="Home" component={HomeScreen} /> */}
    </Stack.Navigator>
  );
};

// Root Navigator: Decides whether to show Auth or App stack
const AppNavigator = () => {
  const { authToken, isLoading: authLoading, setLoading, loginSuccess } = useAuthStore();
  const { isDarkMode, initializeTheme } = useThemeStore(); // Ensure theme is initialized
  const theme = getTheme(isDarkMode);
  const [isInitializing, setIsInitializing] = React.useState(true);

  useEffect(() => {
    // Initialize theme store
    initializeTheme();

    // Check for existing auth token on app startup
    const bootstrapAsync = async () => {
      setLoading(true); // Auth store loading
      try {
        const token = await getAuthToken();
        if (token) {
          // Here, you would typically validate the token with the server (e.g., call auth/me)
          // For this simulation, if a token exists, we'll assume it's valid and
          // transition to the app. The ProfileScreen will try to fetch user data.
          // A more robust solution would fetch user data here and then call loginSuccess.
          console.log('AppNavigator: Token found, simulating login state.');
          // To properly set the auth state, we need user data and the master key.
          // This simplified bootstrap just sets the token. ProfileScreen will fetch user.
          // In a real app, you'd fetch user from 'auth/me' here and then `loginSuccess`.
          // For now, we'll just set a dummy user and token to show the app stack.
          // The rawMasterKey would need to be re-derived or handled carefully.
          // This is a simplified bootstrap for navigation demonstration.
          useAuthStore.setState({ authToken: token, user: null }); // User will be fetched by ProfileScreen
        }
      } catch (e) {
        console.error('AppNavigator: Error bootstrapping auth token:', e);
        // Handle error, maybe clear token if invalid
      } finally {
        setLoading(false); // Auth store loading finished
        setIsInitializing(false); // App navigator initialization finished
      }
    };

    bootstrapAsync();
  }, [initializeTheme, setLoading]);


  if (isInitializing || authLoading) {
    // Loading screen while checking token or theme
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={{
      dark: isDarkMode,
      colors: {
        primary: theme.primary,
        background: theme.background,
        card: theme.background, // Stack navigator card background
        text: theme.text,
        border: theme.border,
        notification: theme.primary, // Example
      },
    }}>
      {authToken ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AppNavigator;
