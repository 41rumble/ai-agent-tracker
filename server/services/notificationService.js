const axios = require('axios');
const apiConfig = require('../config/apiConfig');
const Project = require('../models/Project');
const User = require('../models/User');
const Discovery = require('../models/Discovery');

/**
 * Service for handling notifications
 */
const notificationService = {
  /**
   * Send an email notification
   */
  sendEmailNotification: async (to, subject, content) => {
    try {
      // This is a placeholder for email sending functionality
      // In a real implementation, you would use a service like SendGrid, Mailgun, etc.
      console.log(`[EMAIL NOTIFICATION] To: ${to}, Subject: ${subject}`);
      console.log(`Content: ${content}`);
      
      // If email service is configured, send the email
      if (apiConfig.email && apiConfig.email.enabled) {
        // Implementation would depend on the email service being used
        console.log('Email service is enabled, would send email here');
        return true;
      } else {
        console.log('Email service is not enabled, skipping email send');
        return false;
      }
    } catch (error) {
      console.error('Error sending email notification:', error);
      return false;
    }
  },
  
  /**
   * Send a Slack notification
   */
  sendSlackNotification: async (webhookUrl, channel, message) => {
    try {
      if (!webhookUrl) {
        console.log('No Slack webhook URL provided, skipping notification');
        return false;
      }
      
      // Send message to Slack webhook
      const response = await axios.post(webhookUrl, {
        channel: channel || '',
        text: message,
        username: 'AI Agent Tracker',
        icon_emoji: ':robot_face:'
      });
      
      if (response.status === 200) {
        console.log('Slack notification sent successfully');
        return true;
      } else {
        console.error('Error sending Slack notification:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      return false;
    }
  },
  
  /**
   * Notify user about new discoveries
   */
  notifyAboutDiscoveries: async (projectId, discoveries) => {
    try {
      if (!discoveries || discoveries.length === 0) {
        console.log('No discoveries to notify about');
        return;
      }
      
      // Get project and user details
      const project = await Project.findById(projectId);
      if (!project) {
        console.error(`Project not found with ID: ${projectId}`);
        return;
      }
      
      const user = await User.findById(project.userId);
      if (!user) {
        console.error(`User not found with ID: ${project.userId}`);
        return;
      }
      
      // Check notification preferences
      const emailEnabled = project.notificationPreferences?.email?.enabled;
      const slackEnabled = project.notificationPreferences?.slack?.enabled;
      
      if (!emailEnabled && !slackEnabled) {
        console.log(`No notifications enabled for project ${projectId}`);
        return;
      }
      
      // Prepare notification content
      const subject = `New Discoveries for ${project.name}`;
      let content = `We've found ${discoveries.length} new discoveries for your project "${project.name}":\n\n`;
      
      discoveries.forEach((discovery, index) => {
        content += `${index + 1}. ${discovery.title}\n`;
        content += `   Relevance: ${discovery.relevanceScore}/10\n`;
        content += `   ${discovery.description.substring(0, 100)}...\n\n`;
      });
      
      content += `View all discoveries at: ${apiConfig.appUrl}/projects/${projectId}`;
      
      // Send email notification if enabled
      if (emailEnabled) {
        const emailFrequency = project.notificationPreferences.email.frequency || 'daily';
        
        // For immediate notifications, send right away
        if (emailFrequency === 'immediate') {
          await notificationService.sendEmailNotification(user.email, subject, content);
        } else {
          // For non-immediate notifications, store for later batch sending
          console.log(`Queuing ${emailFrequency} email notification for user ${user.email}`);
          // In a real implementation, you would store this in a queue or database
        }
      }
      
      // Send Slack notification if enabled
      if (slackEnabled) {
        const webhookUrl = project.notificationPreferences.slack.webhookUrl;
        const channel = project.notificationPreferences.slack.channel;
        
        if (webhookUrl) {
          await notificationService.sendSlackNotification(webhookUrl, channel, content);
        }
      }
    } catch (error) {
      console.error('Error notifying about discoveries:', error);
    }
  },
  
  /**
   * Send a daily digest of discoveries
   */
  sendDailyDigest: async (userId) => {
    try {
      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        console.error(`User not found with ID: ${userId}`);
        return;
      }
      
      // Get all projects for this user with email notifications set to daily
      const projects = await Project.find({
        userId,
        'notificationPreferences.email.enabled': true,
        'notificationPreferences.email.frequency': 'daily'
      });
      
      if (projects.length === 0) {
        console.log(`No projects with daily email notifications for user ${userId}`);
        return;
      }
      
      // For each project, get discoveries from the last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      let hasDiscoveries = false;
      let digestContent = `Daily Digest for ${new Date().toLocaleDateString()}\n\n`;
      
      for (const project of projects) {
        const discoveries = await Discovery.find({
          projectId: project._id,
          createdAt: { $gte: yesterday }
        }).sort({ relevanceScore: -1 }).limit(5);
        
        if (discoveries.length > 0) {
          hasDiscoveries = true;
          digestContent += `Project: ${project.name}\n`;
          digestContent += `${discoveries.length} new discoveries found:\n\n`;
          
          discoveries.forEach((discovery, index) => {
            digestContent += `${index + 1}. ${discovery.title}\n`;
            digestContent += `   Relevance: ${discovery.relevanceScore}/10\n`;
            digestContent += `   ${discovery.description.substring(0, 100)}...\n\n`;
          });
          
          digestContent += `View all discoveries at: ${apiConfig.appUrl}/projects/${project._id}\n\n`;
          digestContent += `---\n\n`;
        }
      }
      
      // Send digest if there are discoveries
      if (hasDiscoveries) {
        await notificationService.sendEmailNotification(
          user.email,
          'AI Agent Tracker - Daily Digest',
          digestContent
        );
      } else {
        console.log(`No new discoveries for daily digest for user ${userId}`);
      }
    } catch (error) {
      console.error('Error sending daily digest:', error);
    }
  },
  
  /**
   * Send a weekly digest of discoveries
   */
  sendWeeklyDigest: async (userId) => {
    try {
      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        console.error(`User not found with ID: ${userId}`);
        return;
      }
      
      // Get all projects for this user with email notifications set to weekly
      const projects = await Project.find({
        userId,
        'notificationPreferences.email.enabled': true,
        'notificationPreferences.email.frequency': 'weekly'
      });
      
      if (projects.length === 0) {
        console.log(`No projects with weekly email notifications for user ${userId}`);
        return;
      }
      
      // For each project, get discoveries from the last 7 days
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      
      let hasDiscoveries = false;
      let digestContent = `Weekly Digest for ${new Date().toLocaleDateString()}\n\n`;
      
      for (const project of projects) {
        const discoveries = await Discovery.find({
          projectId: project._id,
          createdAt: { $gte: lastWeek }
        }).sort({ relevanceScore: -1 }).limit(10);
        
        if (discoveries.length > 0) {
          hasDiscoveries = true;
          digestContent += `Project: ${project.name}\n`;
          digestContent += `${discoveries.length} new discoveries found:\n\n`;
          
          discoveries.forEach((discovery, index) => {
            digestContent += `${index + 1}. ${discovery.title}\n`;
            digestContent += `   Relevance: ${discovery.relevanceScore}/10\n`;
            digestContent += `   ${discovery.description.substring(0, 100)}...\n\n`;
          });
          
          digestContent += `View all discoveries at: ${apiConfig.appUrl}/projects/${project._id}\n\n`;
          digestContent += `---\n\n`;
        }
      }
      
      // Send digest if there are discoveries
      if (hasDiscoveries) {
        await notificationService.sendEmailNotification(
          user.email,
          'AI Agent Tracker - Weekly Digest',
          digestContent
        );
      } else {
        console.log(`No new discoveries for weekly digest for user ${userId}`);
      }
    } catch (error) {
      console.error('Error sending weekly digest:', error);
    }
  }
};

module.exports = notificationService;