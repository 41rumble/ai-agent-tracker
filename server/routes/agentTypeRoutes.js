const express = require('express');
const router = express.Router();
const agentTypeController = require('../controllers/agentTypeController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all agent type routes
router.use(authMiddleware);

// @route   GET /api/agent-types
// @desc    Get all agent types
// @access  Private
router.get('/', agentTypeController.getAgentTypes);

// @route   GET /api/agent-types/:id
// @desc    Get agent type by ID
// @access  Private
router.get('/:id', agentTypeController.getAgentTypeById);

// @route   POST /api/agent-types
// @desc    Create a new agent type
// @access  Private
router.post('/', agentTypeController.createAgentType);

// @route   PUT /api/agent-types/:id
// @desc    Update an agent type
// @access  Private
router.put('/:id', agentTypeController.updateAgentType);

// @route   DELETE /api/agent-types/:id
// @desc    Delete an agent type
// @access  Private
router.delete('/:id', agentTypeController.deleteAgentType);

module.exports = router;