
# Cloud Drive SaaS

A multi-user cloud storage application with MongoDB and Redis.

## Setup

### Prerequisites

- Node.js (v14+)
- MongoDB installed and running on localhost:27017
- Redis installed and running on localhost:6379

### Backend Setup

1. Navigate to the server directory:
   ```
   cd server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the server directory with:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/clouddrive
   JWT_SECRET=your_jwt_secret_key_change_this_in_production
   REDIS_HOST=localhost
   REDIS_PORT=6379
   STORAGE_PATH=./storage
   ```

4. Start the server:
   ```
   npm run dev
   ```

### Frontend Setup

1. In the root directory, install dependencies:
   ```
   npm install
   ```

2. Start the application:
   ```
   npm run dev
   ```

3. Access the application at `http://localhost:5173`

## Features

- User authentication with JWT
- Per-user file storage buckets
- File upload and download
- Folder creation and navigation
- Redis caching for improved performance
