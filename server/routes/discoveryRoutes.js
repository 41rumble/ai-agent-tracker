const express = require('express');
const router = express.Router();
const discoveryController = require('../controllers/discoveryController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all discovery routes
router.use(authMiddleware);

// @route   GET /api/discoveries/project/:projectId
// @desc    Get all discoveries for a project with optional filtering
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

// @route   PUT /api/discoveries/:id/viewed
// @desc    Mark discovery as viewed
// @access  Private
router.put('/:id/viewed', discoveryController.markDiscoveryAsViewed);

// @route   PUT /api/discoveries/:id/toggle-hidden
// @desc    Toggle discovery hidden status
// @access  Private
router.put('/:id/toggle-hidden', discoveryController.toggleDiscoveryHidden);

// @route   POST /api/discoveries/project/:projectId/bulk-update
// @desc    Bulk update discoveries for a project
// @access  Private
router.post('/project/:projectId/bulk-update', discoveryController.bulkUpdateDiscoveries);

module.exports = router;