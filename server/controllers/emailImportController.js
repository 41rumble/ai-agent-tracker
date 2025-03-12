const emailImporter = require('../services/emailImporter');
const User = require('../models/User');

/**
 * Run an immediate email check
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.runEmailCheck = async (req, res) => {
  try {
    const userId = req.user._id;
    
    console.log(`Manual email check requested by user ${userId}`);
    
    const result = await emailImporter.runImmediateCheck(userId);
    
    res.status(200).json({
      success: true,
      message: `Email check completed. Processed ${result.emailsProcessed} emails.`,
      result
    });
  } catch (error) {
    console.error('Error running email check:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run email check',
      error: error.message
    });
  }
};

/**
 * Get email import settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getEmailSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId).select('emailImportSettings');
    
    res.status(200).json({
      success: true,
      settings: user.emailImportSettings || {
        enabled: false,
        sources: []
      }
    });
  } catch (error) {
    console.error('Error getting email settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email settings',
      error: error.message
    });
  }
};

/**
 * Update email import settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateEmailSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { enabled, sources } = req.body;
    
    // Update user settings
    await User.findByIdAndUpdate(userId, {
      $set: {
        emailImportSettings: {
          enabled,
          sources: Array.isArray(sources) ? sources : []
        }
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Email import settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating email settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update email settings',
      error: error.message
    });
  }
};