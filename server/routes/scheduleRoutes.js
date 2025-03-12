const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all schedule routes
router.use(authMiddleware);

// @route   GET /api/schedules/project/:projectId
// @desc    Get all schedules for a project
// @access  Private
router.get('/project/:projectId', scheduleController.getSchedulesByProject);

// @route   POST /api/schedules
// @desc    Create a new schedule
// @access  Private
router.post('/', scheduleController.createSchedule);

// @route   PUT /api/schedules/:id
// @desc    Update schedule
// @access  Private
router.put('/:id', scheduleController.updateSchedule);

// @route   DELETE /api/schedules/:id
// @desc    Delete schedule
// @access  Private
router.delete('/:id', scheduleController.deleteSchedule);

module.exports = router;