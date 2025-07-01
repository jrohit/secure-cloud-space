import React, { useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import { getTheme } from '../styles/theme';
import { fetchUserProfile } from '../services/api'; // Simulated API call
import { deleteAuthToken } from '../services/secureStorage';

const ProfileScreen = ({ navigation }) => {
  // Zustand store hooks
  const { user, authToken, setUser, logout, isLoading, setLoading, setError, error } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const theme = getTheme(isDarkMode);

  // Effect to fetch user profile if not already loaded
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user && authToken) { // Only fetch if user is null but token exists
        setLoading(true);
        setError(null);
        try {
          console.log('ProfileScreen: Fetching user profile...');
          const userProfile = await fetchUserProfile(authToken); // Simulate API call
          setUser(userProfile); // Update user in authStore
          console.log('ProfileScreen: User profile fetched and set.');
        } catch (err) {
          console.error('ProfileScreen: Failed to fetch user profile:', err);
          setError(err.message || 'Could not load profile.');
          Alert.alert('Error', 'Could not load your profile. Please try again later.');
          // Potentially handle token expiry by logging out
          if (err.response && err.response.status === 401) {
            handleLogout(); // Or navigate to login
          }
        } finally {
          setLoading(false);
        }
      } else if (user) {
        console.log('ProfileScreen: User data already available in store.');
      }
    };

    loadUserProfile();
  }, [authToken, user, setUser, setLoading, setError]); // Dependencies for the effect

  const handleLogout = async () => {
    setLoading(true);
    try {
      // Simulate server-side logout if necessary (e.g., invalidate token)
      // await logoutUserApi(authToken);
      console.log('ProfileScreen: Logging out...');
      await deleteAuthToken(); // Remove token from secure storage
      logout(); // Clear auth state in Zustand (including rawMasterKey)

      // Navigate to Auth flow (e.g., Login screen)
      // This navigation will be handled by AppNavigator based on auth state
      console.log('ProfileScreen: Logout successful. Navigation should redirect to Auth flow.');
      // navigation.navigate('Auth'); // Example, actual navigation will be more robust
    } catch (err) {
      console.error('ProfileScreen: Logout failed:', err);
      Alert.alert('Logout Failed', err.message || 'An error occurred during logout.');
      // Still clear local state even if server call fails
      await deleteAuthToken().catch(e => console.error("Failed to delete token on error", e));
      logout();
    } finally {
      setLoading(false);
    }
  };

  // Dynamic styles
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: theme.text,
    },
    userInfoText: {
      fontSize: 18,
      marginBottom: 10,
      color: theme.text,
    },
    errorText: {
      color: theme.error,
      textAlign: 'center',
      marginBottom: 10,
    },
    buttonContainer: {
      marginTop: 30,
      width: '80%',
    }
  });

  if (isLoading && !user) { // Show loading indicator if fetching initial profile
    return (
      <View style={[dynamicStyles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.text, marginTop: 10 }}>Loading Profile...</Text>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <Text style={dynamicStyles.title}>User Profile</Text>
      {error && <Text style={dynamicStyles.errorText}>{error}</Text>}
      {user ? (
        <>
          <Text style={dynamicStyles.userInfoText}>Name: {user.name}</Text>
          <Text style={dynamicStyles.userInfoText}>Email: {user.email}</Text>
          {/* Display other user information as needed */}
        </>
      ) : (
        !isLoading && <Text style={dynamicStyles.userInfoText}>No user data available. Please login.</Text>
      )}
      <View style={dynamicStyles.buttonContainer}>
        <Button
          title="Logout"
          onPress={handleLogout}
          color={theme.error}
          disabled={isLoading}
        />
      </View>
    </View>
  );
};

export default ProfileScreen;
