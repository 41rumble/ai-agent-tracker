const Imap = require('imap');
const { simpleParser } = require('mailparser');
const schedule = require('node-schedule');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Discovery = require('../models/Discovery');
const User = require('../models/User');
const openaiService = require('./openaiService');
const apiConfig = require('../config/apiConfig');

// Default newsletter sources if none are specified by the user
const DEFAULT_NEWSLETTER_SOURCES = [
  // Primary sources specified by the user
  'news@alphasignal.ai',
  'superhuman@mail.joinsuperhuman.ai'
];

/**
 * Process email content into discoveries
 * @param {string} projectId - The project ID
 * @param {Object} newsletterData - Newsletter data
 * @returns {Promise<Object>} - Result with discovery count
 */
async function processNewsletterContent(projectId, newsletterData) {
  try {
    console.log(`Processing newsletter content for project ${projectId}`);
    console.log(`Newsletter: ${newsletterData.name}, Subject: ${newsletterData.subject}`);
    
    // Get project details for context
    const project = await Project.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    
    // Prepare context for OpenAI
    const context = {
      projectName: project.name,
      projectDescription: project.description,
      projectDomain: project.domain,
      projectGoals: project.goals,
      projectInterests: project.interests,
      newsletterName: newsletterData.name,
      newsletterSubject: newsletterData.subject,
      newsletterDate: newsletterData.date
    };
    
    // Process the content with OpenAI
    const aiResponse = await openaiService.processNewsletterContent(
      newsletterData.content,
      context
    );
    
    if (!aiResponse || !aiResponse.discoveries || !Array.isArray(aiResponse.discoveries)) {
      console.error('Invalid AI response format:', aiResponse);
      return { discoveryCount: 0 };
    }
    
    // Create discovery entries from the AI response
    const discoveries = aiResponse.discoveries.map(discovery => ({
      projectId,
      title: discovery.title,
      description: discovery.description,
      source: discovery.source || `Newsletter: ${newsletterData.name}`,
      relevanceScore: discovery.relevanceScore || 5,
      categories: discovery.categories || [],
      type: discovery.type || 'Article',
      discoveredAt: new Date(),
      publicationDate: newsletterData.date ? new Date(newsletterData.date) : new Date(),
      searchContext: {
        source: 'newsletter',
        newsletterName: newsletterData.name,
        newsletterSubject: newsletterData.subject
      }
    }));
    
    // Only save if we have discoveries
    if (discoveries.length > 0) {
      await Discovery.insertMany(discoveries);
      console.log(`Created ${discoveries.length} discoveries from newsletter`);
    } else {
      console.log('No relevant discoveries found in newsletter content');
    }
    
    return { discoveryCount: discoveries.length };
  } catch (error) {
    console.error('Error processing newsletter content:', error);
    return { discoveryCount: 0, error: error.message };
  }
}

/**
 * Check emails for a specific user
 * @param {string} userId - The user ID
 * @returns {Promise<void>}
 */
async function checkEmailsForUser(userId) {
  try {
    console.log(`Checking emails for user ${userId}`);
    
    // Get user and their email settings
    const user = await User.findById(userId);
    if (!user) {
      console.log(`User ${userId} not found`);
      return { error: 'User not found' };
    }
    
    // Check if email import is enabled for this user
    if (!user.emailImportSettings || !user.emailImportSettings.enabled) {
      console.log(`Email import not enabled for user ${userId}`);
      return { error: 'Email import not enabled' };
    }
    
    // Get user's projects
    const projects = await Project.find({ userId });
    if (!projects.length) {
      console.log(`No projects found for user ${userId}`);
      return { error: 'No projects found' };
    }
    
    // Use the first project for now - could be enhanced to determine relevance
    const projectId = projects[0]._id;
    
    // Get email settings from user
    const emailSettings = user.emailImportSettings;
    
    // Use newsletter sources from user settings, or fall back to defaults
    const newsletterSources = emailSettings.sources && emailSettings.sources.length > 0 
      ? emailSettings.sources 
      : DEFAULT_NEWSLETTER_SOURCES;
    
    if (newsletterSources.length === 0) {
      console.log('No newsletter sources configured');
      return { error: 'No newsletter sources configured' };
    }
    
    console.log(`Connecting to email server ${emailSettings.server}:${emailSettings.port} with username ${emailSettings.username}`);
    
    // Connect to email using user settings
    const imap = new Imap({
      user: emailSettings.username || process.env.EMAIL_IMPORT_USER,
      password: emailSettings.password || process.env.EMAIL_IMPORT_PASS,
      host: emailSettings.server || process.env.EMAIL_IMPORT_SERVER || 'mail.hover.com',
      port: emailSettings.port || parseInt(process.env.EMAIL_IMPORT_PORT, 10) || 993,
      tls: emailSettings.secure !== undefined ? emailSettings.secure : (process.env.EMAIL_IMPORT_SECURE === 'true'),
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 30000, // 30 seconds connection timeout
      authTimeout: 30000  // 30 seconds authentication timeout
    });
    
    return new Promise((resolve, reject) => {
      imap.once('ready', function() {
        imap.openBox('INBOX', false, function(err, box) {
          if (err) {
            console.error('Error opening inbox:', err);
            imap.end();
            return reject(err);
          }
          
          // Create search criteria for newsletter sources
          // This searches for emails from any of the newsletter sources
          const searchCriteria = [
            'UNSEEN', // Only get unread emails
            ['OR', 
              ...newsletterSources.map(source => ['FROM', source])
            ]
          ];
          
          imap.search(searchCriteria, function(err, results) {
            if (err) {
              console.error('Error searching emails:', err);
              imap.end();
              return reject(err);
            }
            
            if (!results.length) {
              console.log('No new newsletter emails found');
              imap.end();
              return resolve({ emailsProcessed: 0 });
            }
            
            console.log(`Found ${results.length} new newsletter emails`);
            
            let processedCount = 0;
            let emailsToProcess = results.length;
            
            // Fetch the emails
            const fetch = imap.fetch(results, { bodies: '' });
            
            fetch.on('message', function(msg) {
              msg.on('body', function(stream) {
                simpleParser(stream, async (err, parsed) => {
                  if (err) {
                    console.error('Error parsing email:', err);
                    emailsToProcess--;
                    if (emailsToProcess === 0) {
                      imap.end();
                      resolve({ emailsProcessed: processedCount });
                    }
                    return;
                  }
                  
                  const from = parsed.from.text;
                  const subject = parsed.subject;
                  const date = parsed.date;
                  
                  // Prefer HTML content for better URL extraction, but fall back to text
                  let content = '';
                  if (parsed.html) {
                    // Keep HTML content for better URL extraction
                    content = parsed.html;
                    console.log('Using HTML content for better URL extraction');
                  } else if (parsed.text) {
                    content = parsed.text;
                    console.log('Using plain text content');
                  } else {
                    console.log('No content found in email');
                    emailsToProcess--;
                    if (emailsToProcess === 0) {
                      imap.end();
                      resolve({ emailsProcessed: processedCount });
                    }
                    return;
                  }
                  
                  console.log(`Processing email: ${subject} from ${from}`);
                  
                  // Process the newsletter content
                  try {
                    const result = await processNewsletterContent(
                      projectId, 
                      {
                        name: from,
                        subject: subject,
                        date: date,
                        content: content
                      }
                    );
                    
                    console.log(`Created ${result.discoveryCount} discoveries from email`);
                    processedCount++;
                  } catch (error) {
                    console.error('Error processing newsletter content:', error);
                  }
                  
                  emailsToProcess--;
                  if (emailsToProcess === 0) {
                    imap.end();
                    resolve({ emailsProcessed: processedCount });
                  }
                });
              });
            });
            
            fetch.once('error', function(err) {
              console.error('Fetch error:', err);
              imap.end();
              reject(err);
            });
            
            fetch.once('end', function() {
              console.log('Done fetching emails');
              // Don't end the connection here, as we might still be processing emails
            });
          });
        });
      });
      
      imap.once('error', function(err) {
        console.error('IMAP error:', err);
        reject(err);
      });
      
      imap.once('end', function() {
        console.log('IMAP connection ended');
      });
      
      imap.connect();
    });
    
  } catch (error) {
    console.error('Error in email import process:', error);
    throw error;
  }
}

/**
 * Schedule email checks for all users
 */
function scheduleEmailChecks() {
  // Only schedule if email import is enabled
  if (process.env.EMAIL_IMPORT_ENABLED !== 'true') {
    console.log('Email import is disabled. Not scheduling checks.');
    return;
  }
  
  console.log('Scheduling email checks...');
  
  // Run every 6 hours
  const job = schedule.scheduleJob('0 */6 * * *', async function() {
    console.log('Running scheduled email check');
    
    try {
      // Get all users
      const users = await User.find().select('_id');
      
      // Check emails for each user
      for (const user of users) {
        try {
          await checkEmailsForUser(user._id);
        } catch (err) {
          console.error(`Error checking emails for user ${user._id}:`, err);
        }
      }
    } catch (err) {
      console.error('Error in scheduled email check:', err);
    }
  });
  
  console.log('Email checks scheduled successfully');
  return job;
}

/**
 * Run an immediate email check for testing
 */
async function runImmediateCheck(userId) {
  if (!userId) {
    const users = await User.find().select('_id');
    if (users.length > 0) {
      userId = users[0]._id;
    } else {
      throw new Error('No users found');
    }
  }
  
  try {
    // Update the lastChecked timestamp
    await User.findByIdAndUpdate(userId, {
      $set: {
        'emailImportSettings.lastChecked': new Date()
      }
    });
    
    return checkEmailsForUser(userId);
  } catch (error) {
    console.error('Error running immediate check:', error);
    throw error;
  }
}

module.exports = {
  checkEmailsForUser,
  scheduleEmailChecks,
  runImmediateCheck,
  processNewsletterContent
};