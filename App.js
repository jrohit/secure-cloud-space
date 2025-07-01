import React from 'react';
import { StatusBar } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import useThemeStore from './src/store/themeStore'; // To set StatusBar style based on theme

// Optional: If you have any global error handling (e.g., Sentry) or other
// one-time setup, it could be initialized here.

const App = () => {
  const { isDarkMode } = useThemeStore(); // Get theme state

  // The themeStore's initializeTheme() is called when the store module is first imported.
  // AppNavigator also calls it to ensure it runs early.

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#121212' : '#FFFFFF'} // Match theme background
      />
      <AppNavigator />
      {/*
        If you were using React Context API for theme instead of Zustand,
        your ThemeProvider would likely wrap AppNavigator here.
        e.g.,
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      */}
    </>
  );
};

export default App;
