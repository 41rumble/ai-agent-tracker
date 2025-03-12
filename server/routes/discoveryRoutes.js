const express = require('express');
const router = express.Router();
const discoveryController = require('../controllers/discoveryController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all discovery routes
router.use(authMiddleware);

// @route   GET /api/discoveries/project/:projectId
// @desc    Get all discoveries for a project
// @access  Private
router.get('/project/:projectId', discoveryController.getDiscoveriesByProject);

// @route   GET /api/discoveries/:id
// @desc    Get discovery by ID
// @access  Private
router.get('/:id', discoveryController.getDiscoveryById);

// @route   PUT /api/discoveries/:id
// @desc    Update discovery feedback
// @access  Private
router.put('/:id', discoveryController.updateDiscoveryFeedback);

module.exports = router;