import { create } from 'zustand';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = 'appTheme';

// Helper function to get the initial theme
const getInitialTheme = async () => {
  try {
    const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme) {
      return storedTheme === 'dark';
    }
  } catch (e) {
    console.error('Error reading theme from AsyncStorage:', e);
  }
  // Fallback to system preference if no stored theme
  return Appearance.getColorScheme() === 'dark';
};


const useThemeStore = create((set) => ({
  isDarkMode: false, // Initial default, will be updated

  // Initialize theme when store is created
  initializeTheme: async () => {
    const initialDarkMode = await getInitialTheme();
    set({ isDarkMode: initialDarkMode });
  },

  // Action to toggle theme
  toggleTheme: () => set((state) => {
    const newDarkModeState = !state.isDarkMode;
    AsyncStorage.setItem(THEME_STORAGE_KEY, newDarkModeState ? 'dark' : 'light')
      .catch(e => console.error('Error saving theme to AsyncStorage:', e));
    return { isDarkMode: newDarkModeState };
  }),

  // Action to set a specific theme (e.g., based on system changes if not overriding)
  setTheme: (isDark) => {
    AsyncStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light')
      .catch(e => console.error('Error saving theme to AsyncStorage:', e));
    set({ isDarkMode: isDark });
  }
}));

// Call initializeTheme when the store is first imported/used.
// This is a common pattern for async initialization in Zustand.
useThemeStore.getState().initializeTheme();

// Optional: Listen to system theme changes
// This can be integrated into the App.js or a ThemeProvider component
// Appearance.addChangeListener(({ colorScheme }) => {
//   useThemeStore.getState().setTheme(colorScheme === 'dark');
// });


export default useThemeStore;
