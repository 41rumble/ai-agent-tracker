require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const apiConfig = require('./config/apiConfig');
const routes = require('./routes');
const schedulerService = require('./services/schedulerService');

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: apiConfig.cors.allowedOrigins,
  credentials: true
}));

// Connect to MongoDB
mongoose.connect(apiConfig.mongodb.uri)
  .then(() => {
    console.log('Connected to MongoDB');
    // Initialize scheduler after DB connection
    schedulerService.initializeScheduler();
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;