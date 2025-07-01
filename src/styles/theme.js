export const lightTheme = {
  background: '#FFFFFF',
  text: '#121212',
  primary: '#007AFF', // Example primary color (iOS Blue)
  secondary: '#5856D6', // Example secondary color
  border: '#D1D1D6',
  inputBackground: '#F0F0F0',
  error: '#FF3B30', // Example error color
  // ... add more as needed
};

export const darkTheme = {
  background: '#121212', // Common dark theme background
  text: '#EFEFEF',
  primary: '#0A84FF', // Adjusted primary for dark mode
  secondary: '#5E5CE6', // Adjusted secondary
  border: '#3A3A3C',
  inputBackground: '#2C2C2E',
  error: '#FF453A',
  // ... add more as needed
};

export const commonStyles = {
  // Common styles that don't change with theme
  container: {
    flex: 1,
    padding: 20,
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  // ... add more common styles
};

// Function to get current theme (could be expanded for more complex theming)
export const getTheme = (isDarkMode) => (isDarkMode ? darkTheme : lightTheme);
