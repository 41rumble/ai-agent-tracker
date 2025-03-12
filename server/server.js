require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const apiConfig = require('./config/apiConfig');
const routes = require('./routes');
const schedulerService = require('./services/schedulerService');
const emailImporter = require('./services/emailImporter');

const app = express();

// Middleware
app.use(express.json());

// Configure CORS to allow requests from any origin in development
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? apiConfig.cors.allowedOrigins 
    : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Log CORS configuration
console.log('CORS configuration:', {
  environment: process.env.NODE_ENV || 'development',
  origins: process.env.NODE_ENV === 'production' ? apiConfig.cors.allowedOrigins : 'All origins allowed'
});

// Connect to MongoDB
mongoose.connect(apiConfig.mongodb.uri)
  .then(() => {
    console.log('Connected to MongoDB');
    // Initialize scheduler after DB connection
    schedulerService.initializeScheduler();
    
    // Initialize email importer if enabled
    if (process.env.EMAIL_IMPORT_ENABLED === 'true') {
      console.log('Initializing email importer...');
      emailImporter.scheduleEmailChecks();
    } else {
      console.log('Email importer is disabled');
    }
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: apiConfig.server.env === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = apiConfig.server.port;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log('Server is accessible from all network interfaces');
    console.log('You can access it from other devices using your machine\'s IP address');
  }
});

module.exports = app;