import axios from 'axios';

// Simulate a base URL, not actually used for these mocks but good practice
const API_BASE_URL = 'http://localhost:3000/api'; // Example

// Simulate network latency
const simulateLatency = (delay = 1000) =>
  new Promise(resolve => setTimeout(resolve, delay));

// --- Simulated User Data Store ---
// This will act as our "database" for users and their encrypted master keys for the simulation.
// In a real app, this data resides on the server.
const simulatedUserStore = {
  // 'email@example.com': {
  //   id: 'user123',
  //   name: 'Test User',
  //   email: 'email@example.com',
  //   passwordHash: 'hashed_password_server_side', // Server would store a hash, not plain password
  //   encryptedMasterKeyString: 'salt:iv:authTag:cipherText',
  // },
};

// --- Auth Endpoints ---

/**
 * Simulates user registration.
 * @param {string} name User's name.
 * @param {string} email User's email.
 * @param {string} password User's password (in a real app, server would hash this).
 * @param {string} encryptedMasterKeyString The encrypted master key.
 * @returns {Promise<{user: object, token: string}>}
 */
export const registerUser = async (name, email, password, encryptedMasterKeyString) => {
  await simulateLatency();
  if (simulatedUserStore[email]) {
    throw new Error('User with this email already exists.');
  }

  const userId = `user_${Date.now()}`;
  const newUser = {
    id: userId,
    name,
    email,
    // Server would hash the password and store the hash, not the plain password.
    // passwordHash: await hashPasswordOnServer(password),
    encryptedMasterKeyString, // Server stores this
  };
  simulatedUserStore[email] = newUser;

  console.log('API_SIM: User registered:', newUser);
  return {
    user: { id: userId, name, email }, // Return basic user info
    token: `simulated_auth_token_for_${userId}`, // Dummy JWT
  };
};

/**
 * Simulates fetching the encrypted master key for a user (needed for client-side decryption on login).
 * @param {string} email User's email.
 * @returns {Promise<string|null>} The encrypted master key string or null if not found.
 */
export const getEncryptedMasterKeyForUser = async (email) => {
  await simulateLatency(500); // Shorter latency for this specific call
  const user = simulatedUserStore[email];
  if (user) {
    console.log('API_SIM: Fetched encryptedMasterKeyString for', email);
    return user.encryptedMasterKeyString;
  }
  console.warn('API_SIM: No encryptedMasterKeyString found for', email);
  return null;
};

/**
 * Simulates user login.
 * @param {string} email User's email.
 * @param {string} password User's password.
 * @returns {Promise<{user: object, token: string}>}
 */
export const loginUser = async (email, password) => {
  await simulateLatency();
  const userRecord = simulatedUserStore[email];

  if (!userRecord) {
    throw new Error('User not found.');
  }

  // In a real app, the server would validate the password against a stored hash.
  // For this simulation, we assume password validation happens and proceeds if user exists.
  // We've already "used" the password on the client to decrypt the master key.
  // The server's job here is to authenticate the user (e.g. by checking password hash)
  // and issue a session token if successful.

  console.log('API_SIM: User login successful for:', email);
  return {
    user: { id: userRecord.id, name: userRecord.name, email: userRecord.email },
    token: `simulated_auth_token_for_${userRecord.id}_${Date.now()}`, // New token on each login
  };
};

/**
 * Simulates fetching the current user's profile.
 * @param {string} token The auth token.
 * @returns {Promise<object>} User profile data.
 */
export const fetchUserProfile = async (token) => {
  await simulateLatency();
  if (!token || !token.startsWith('simulated_auth_token_for_')) {
    throw { status: 401, message: 'Unauthorized or invalid token.' }; // Simulate auth error
  }

  // Extract userId from token for simulation purposes
  const userIdFromToken = token.split('_for_')[1].split('_')[0];

  // Find user by ID (more robust than finding by email if email can change)
  let userProfile = null;
  for (const email in simulatedUserStore) {
    if (simulatedUserStore[email].id === userIdFromToken) {
      userProfile = {
        id: simulatedUserStore[email].id,
        name: simulatedUserStore[email].name,
        email: simulatedUserStore[email].email,
      };
      break;
    }
  }

  if (!userProfile) {
    throw new Error('User profile not found for token.');
  }

  console.log('API_SIM: Fetched user profile:', userProfile);
  return userProfile;
};


// --- File/Folder Endpoints (Stubs) ---
// These are placeholders for now and will be expanded later.

export const listFilesAndFolders = async (token, folderId = null) => {
  await simulateLatency();
  if (!token) throw new Error('Unauthorized');
  console.log('API_SIM: listFilesAndFolders called for folderId:', folderId);
  // Return dummy data
  return [
    { id: 'file1', name: 'MyDocument.txt', type: 'file', size: 1024, lastModified: new Date().toISOString() },
    { id: 'folder1', name: 'Work', type: 'folder', lastModified: new Date().toISOString() },
    { id: 'file2', name: 'Photo.jpg', type: 'file', size: 204800, lastModified: new Date().toISOString() },
  ];
};

export const uploadFile = async (token, fileData, folderId = null) => {
  await simulateLatency(2000); // Longer for upload
  if (!token) throw new Error('Unauthorized');
  console.log('API_SIM: uploadFile called for file:', fileData.name, 'in folderId:', folderId);
  // Return dummy success response
  return {
    id: `file_${Date.now()}`,
    name: fileData.name,
    size: fileData.size,
    type: 'file',
    message: 'File uploaded successfully (simulated)',
  };
};

// Add more simulated API functions as needed for:
// - createFolder
// - downloadFile
// - deleteFileOrFolder
// - trashFileOrFolder
// - restoreFileOrFolder
// - etc.

console.log('API service loaded. (Simulated)');

// Example of how Axios might be configured, though not strictly needed for these mocks
// const apiClient = axios.create({
//   baseURL: API_BASE_URL,
//   timeout: 10000, // 10 seconds timeout
// });

// apiClient.interceptors.request.use(async (config) => {
//   const token = useAuthStore.getState().authToken; // Access token from Zustand
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });
// export default apiClient; // If using actual Axios instance
