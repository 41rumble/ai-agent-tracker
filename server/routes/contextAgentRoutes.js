const express = require('express');
const router = express.Router();
const contextAgentController = require('../controllers/contextAgentController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all context agent routes
router.use(authMiddleware);

// @route   GET /api/context-agent/project/:projectId
// @desc    Get project context
// @access  Private
router.get('/project/:projectId', contextAgentController.getProjectContext);

// @route   POST /api/context-agent/project/:projectId/update
// @desc    Add a user update to project context
// @access  Private
router.post('/project/:projectId/update', contextAgentController.addUserUpdate);

// @route   POST /api/context-agent/project/:projectId/response/:questionId
// @desc    Add a user response to an agent question
// @access  Private
router.post('/project/:projectId/response/:questionId', contextAgentController.addUserResponse);

// @route   GET /api/context-agent/project/:projectId/question
// @desc    Generate a follow-up question for the project
// @access  Private
router.get('/project/:projectId/question', contextAgentController.generateQuestion);

module.exports = router;