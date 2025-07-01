import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'authToken';

/**
 * Saves the authentication token securely.
 * @param {string} token The authentication token to save.
 * @returns {Promise<void>}
 */
export async function saveAuthToken(token) {
  try {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
    console.log('Auth token saved securely.');
  } catch (error) {
    console.error('Error saving auth token to secure store:', error);
    // Potentially re-throw or handle as per app's error handling strategy
    throw error;
  }
}

/**
 * Retrieves the authentication token from secure store.
 * @returns {Promise<string|null>} The token, or null if not found or an error occurs.
 */
export async function getAuthToken() {
  try {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    if (token) {
      console.log('Auth token retrieved from secure store.');
      return token;
    }
    console.log('No auth token found in secure store.');
    return null;
  } catch (error) {
    console.error('Error retrieving auth token from secure store:', error);
    return null; // Return null on error to allow for fresh login flow
  }
}

/**
 * Deletes the authentication token from secure store.
 * @returns {Promise<void>}
 */
export async function deleteAuthToken() {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    console.log('Auth token deleted from secure store.');
  } catch (error) {
    console.error('Error deleting auth token from secure store:', error);
    // Potentially re-throw or handle
    throw error;
  }
}
