// Test setup file for Jest
// Uses real MongoDB connection with test database

process.env.NODE_ENV = "test";
process.env.PORT = "5001";
process.env.MONGODB_CONNECTIONSTRING = process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/derit-test";
process.env.SESSION_SECRET = "test-secret-for-testing-only";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
process.env.GOOGLE_CALLBACK_URL = "http://localhost:5001/auth/google/callback";
process.env.FRONTEND_URL = "http://localhost:3000";
