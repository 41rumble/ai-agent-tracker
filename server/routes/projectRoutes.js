const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const projectController = require('../controllers/projectController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all project routes
router.use(authMiddleware);

// @route   POST /api/projects
// @desc    Create a new project
// @access  Private
router.post(
  '/',
  [
    body('name', 'Name is required').not().isEmpty(),
    body('description', 'Description is required').not().isEmpty(),
    body('domain', 'Domain is required').not().isEmpty(),
    body('goals', 'Goals must be an array').isArray(),
    body('interests', 'Interests must be an array').isArray()
  ],
  projectController.createProject
);

// @route   GET /api/projects
// @desc    Get all projects for user
// @access  Private
router.get('/', projectController.getAllProjects);

// @route   GET /api/projects/:id
// @desc    Get project by ID
// @access  Private
router.get('/:id', projectController.getProjectById);

// @route   PUT /api/projects/:id
// @desc    Update project
// @access  Private
router.put('/:id', projectController.updateProject);

// @route   DELETE /api/projects/:id
// @desc    Delete project
// @access  Private
router.delete('/:id', projectController.deleteProject);

module.exports = router;