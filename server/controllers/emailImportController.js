const emailImporter = require('../services/emailImporter');
const User = require('../models/User');

/**
 * Run an immediate email check
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.runEmailCheck = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
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
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const userId = req.user._id;
    console.log('Getting email settings for user:', userId);
    
    const user = await User.findById(userId).select('emailImportSettings');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Default settings if emailImportSettings is not defined
    const defaultSettings = {
      enabled: false,
      sources: []
    };
    
    res.status(200).json({
      success: true,
      settings: (user.emailImportSettings || defaultSettings)
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
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const userId = req.user._id;
    const { enabled, sources } = req.body;
    
    console.log('Updating email settings for user:', userId, { enabled, sources });
    
    // Update user settings
    const result = await User.findByIdAndUpdate(userId, {
      $set: {
        emailImportSettings: {
          enabled,
          sources: Array.isArray(sources) ? sources : []
        }
      }
    }, { new: true });
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
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