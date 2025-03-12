const apiConfig = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    webSearchEnabled: process.env.ENABLE_OPENAI_WEB_SEARCH !== 'false', // Enabled by default
    assistantsEnabled: process.env.ENABLE_OPENAI_ASSISTANTS !== 'false' // Enabled by default
  },
  googleSearch: {
    apiKey: process.env.GOOGLE_SEARCH_API_KEY || '',
    cx: process.env.GOOGLE_SEARCH_CX || '',
    enabled: process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX
  },
  mongodb: {
    uri: process.env.MONGODB_URI
  },
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiry: process.env.JWT_EXPIRY
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000']
  }
};

module.exports = apiConfig;