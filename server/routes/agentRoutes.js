const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all agent routes
router.use(authMiddleware);

// @route   POST /api/agent/search
// @desc    Trigger a search for a project
// @access  Private
router.post('/search', agentController.triggerSearch);

// @route   GET /api/agent/recommendations
// @desc    Get recommendations for a project
// @access  Private
router.get('/recommendations', agentController.getRecommendations);

module.exports = router;