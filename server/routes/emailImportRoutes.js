const express = require('express');
const router = express.Router();
const emailImportController = require('../controllers/emailImportController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Run an immediate email check
router.post('/check', emailImportController.runEmailCheck);

// Get email import settings
router.get('/settings', emailImportController.getEmailSettings);

// Update email import settings
router.put('/settings', emailImportController.updateEmailSettings);

module.exports = router;