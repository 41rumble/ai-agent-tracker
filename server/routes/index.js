const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const projectRoutes = require('./projectRoutes');
const discoveryRoutes = require('./discoveryRoutes');
const scheduleRoutes = require('./scheduleRoutes');
const agentRoutes = require('./agentRoutes');

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/discoveries', discoveryRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/agent', agentRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

module.exports = router;