const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const projectRoutes = require('./projectRoutes');
const discoveryRoutes = require('./discoveryRoutes');
const scheduleRoutes = require('./scheduleRoutes');
const agentRoutes = require('./agentRoutes');
const contextAgentRoutes = require('./contextAgentRoutes');
const agentTypeRoutes = require('./agentTypeRoutes');
const emailImportRoutes = require('./emailImportRoutes');

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/discoveries', discoveryRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/agent', agentRoutes);
router.use('/context-agent', contextAgentRoutes);
router.use('/agent-types', agentTypeRoutes);
router.use('/email-import', emailImportRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

module.exports = router;