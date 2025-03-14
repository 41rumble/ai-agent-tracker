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
    
    // Check if we have direct discoveries from Alpha Signal items
    let directDiscoveries = [];
    
    // Try to extract direct discoveries from the content
    try {
      // Look for the extracted sections in the content
      const extractedSectionsMatch = newsletterData.content.match(/### EXTRACTED SECTIONS ###\s*(\{[\s\S]*\})/);
      if (extractedSectionsMatch && extractedSectionsMatch[1]) {
        const extractedSections = JSON.parse(extractedSectionsMatch[1]);
        if (extractedSections.directDiscoveries && Array.isArray(extractedSections.directDiscoveries)) {
          directDiscoveries = extractedSections.directDiscoveries;
          console.log(`Found ${directDiscoveries.length} direct discoveries in extracted sections`);
        }
      }
    } catch (error) {
      console.error('Error extracting direct discoveries:', error);
    }
    
    let aiResponse;
    
    // If we have direct discoveries, use them directly with our own relevance scoring
    if (directDiscoveries.length > 0) {
      console.log('Using direct discoveries from Alpha Signal items with direct relevance scoring');
      
      // Skip OpenAI evaluation completely for Alpha Signal newsletters
      // Assign relevance scores and categories based on project domain and keywords
      const enhancedDiscoveries = directDiscoveries.map(discovery => {
        // Create a more detailed description based on the title
        const title = discovery.title;
        let enhancedDescription = `"${title}" is an AI technology or tool mentioned in the Alpha Signal newsletter.`;
        
        // Add specific details based on keywords in the title
        if (title.toLowerCase().includes('gemma')) {
          enhancedDescription += ` Gemma is Google's family of lightweight open models, which can be used for various AI applications including text generation, code assistance, and potentially creative workflows.`;
        } else if (title.toLowerCase().includes('openai')) {
          enhancedDescription += ` OpenAI develops advanced AI models and tools that can be integrated into creative workflows for automation, content generation, and assistance.`;
        } else if (title.toLowerCase().includes('image')) {
          enhancedDescription += ` This appears to be related to image processing or generation, which could be directly relevant to visual effects and animation workflows.`;
        } else if (title.toLowerCase().includes('api') || title.toLowerCase().includes('sdk')) {
          enhancedDescription += ` This developer tool could potentially be integrated into existing pipelines to add AI capabilities to creative workflows.`;
        }
        
        // Add potential relevance to VFX/Animation if that's the project domain
        if (context.projectDomain && (context.projectDomain.toLowerCase().includes('vfx') || 
            context.projectDomain.toLowerCase().includes('animation'))) {
          enhancedDescription += ` This could potentially be relevant to ${context.projectDomain} workflows by providing new tools or techniques that could be integrated into the creative pipeline.`;
        }
        
        // Assign default categories based on title keywords
        const lowerTitle = title.toLowerCase();
        let categories = discovery.categories || [];
        let relevanceScore = 5; // Default middle score
        let type = 'Tool'; // Default type
        
        // Determine type based on title - only use valid enum values: ['Article', 'Discussion', 'News', 'Research', 'Tool', 'Other']
        if (lowerTitle.includes('announces') || lowerTitle.includes('launches') || lowerTitle.includes('introduces') || lowerTitle.includes('reveals')) {
          type = 'News';
        } else if (lowerTitle.includes('research') || lowerTitle.includes('paper')) {
          type = 'Research';
        } else if (lowerTitle.includes('tutorial') || lowerTitle.includes('guide') || lowerTitle.includes('how to') || lowerTitle.includes('case study')) {
          type = 'Article';
        } else if (lowerTitle.includes('discussion') || lowerTitle.includes('debate') || lowerTitle.includes('forum')) {
          type = 'Discussion';
        }
        
        // Check for keywords in the title to determine relevance and categories
        if (lowerTitle.includes('ai') || lowerTitle.includes('ml') || lowerTitle.includes('model') || 
            lowerTitle.includes('gemma') || lowerTitle.includes('gpt') || lowerTitle.includes('llm')) {
          categories.push('AI Tools');
          relevanceScore = 6;
        }
        
        if (lowerTitle.includes('image') || lowerTitle.includes('video') || lowerTitle.includes('render') || 
            lowerTitle.includes('visual') || lowerTitle.includes('luma')) {
          categories.push('Visual Processing');
          relevanceScore = 7;
        }
        
        if (lowerTitle.includes('3d') || lowerTitle.includes('animation') || lowerTitle.includes('motion')) {
          categories.push('Animation');
          relevanceScore = 8;
        }
        
        if (lowerTitle.includes('api') || lowerTitle.includes('sdk') || lowerTitle.includes('developer')) {
          categories.push('Development Tools');
          relevanceScore = 6;
        }
        
        // Check for specific tools that might be relevant to VFX/Animation
        if (lowerTitle.includes('luma') || lowerTitle.includes('imm')) {
          categories.push('3D Content');
          relevanceScore = 7;
        }
        
        if (lowerTitle.includes('editing') || lowerTitle.includes('generation')) {
          categories.push('Content Creation');
          relevanceScore = 7;
        }
        
        // Boost relevance score for items that match project interests
        if (context.projectInterests && Array.isArray(context.projectInterests)) {
          for (const interest of context.projectInterests) {
            if (interest && lowerTitle.includes(interest.toLowerCase())) {
              relevanceScore += 2;
              break;
            }
          }
        }
        
        // Cap relevance score at 10
        relevanceScore = Math.min(relevanceScore, 10);
        
        // Ensure we have at least some categories
        if (categories.length === 0) {
          categories = ['AI', 'Technology'];
        }
        
        // Remove duplicates
        categories = [...new Set(categories)];
        
        // Validate type to ensure it's one of the allowed enum values
        const validTypes = ['Article', 'Discussion', 'News', 'Research', 'Tool', 'Other'];
        if (!validTypes.includes(type)) {
          console.log(`Invalid type "${type}" for discovery "${title}", defaulting to "Other"`);
          type = 'Other';
        }
        
        return {
          ...discovery,
          description: enhancedDescription,
          categories: categories,
          relevanceScore: relevanceScore,
          type: type
        };
      });
      
      // Log the enhanced discoveries
      console.log('Enhanced discoveries with direct relevance scoring:');
      enhancedDiscoveries.forEach((discovery, index) => {
        console.log(`Discovery ${index + 1}: ${discovery.title} - Relevance: ${discovery.relevanceScore}, Type: ${discovery.type}`);
      });
      
      aiResponse = { discoveries: enhancedDiscoveries };
    } else {
      // Process the content with OpenAI as usual
      console.log(`Sending newsletter content to OpenAI for processing (${newsletterData.content.length} characters)`);
      aiResponse = await openaiService.processNewsletterContent(
        newsletterData.content,
        context
      );
    }
    
    console.log('Received response from OpenAI:', JSON.stringify(aiResponse, null, 2));
    
    if (!aiResponse || !aiResponse.discoveries || !Array.isArray(aiResponse.discoveries)) {
      console.error('Invalid AI response format:', aiResponse);
      
      // If we have direct discoveries but AI processing failed, use them directly
      if (directDiscoveries.length > 0) {
        console.log('Using direct discoveries as fallback since AI processing failed');
        aiResponse = { discoveries: directDiscoveries };
      } else {
        return { discoveryCount: 0 };
      }
    }
    
    // If AI returned empty discoveries but we have direct discoveries, use them
    // This is a fallback that should rarely be needed now that we're using direct relevance scoring
    if (aiResponse.discoveries.length === 0 && directDiscoveries.length > 0) {
      console.log('AI returned empty discoveries array, using direct discoveries as fallback');
      aiResponse = { discoveries: directDiscoveries };
    }
    
    console.log(`Found ${aiResponse.discoveries.length} discoveries in AI response`);
    
    // Log the first discovery to verify format
    if (aiResponse.discoveries.length > 0) {
      console.log('Sample discovery:', JSON.stringify(aiResponse.discoveries[0], null, 2));
    }
    
    // Create discovery entries from the AI response with validation
    const validTypes = ['Article', 'Discussion', 'News', 'Research', 'Tool', 'Other'];
    
    const discoveries = aiResponse.discoveries.map(discovery => {
      // Validate type
      let type = discovery.type || 'Article';
      if (!validTypes.includes(type)) {
        console.log(`Invalid type "${type}" for discovery "${discovery.title}", defaulting to "Other"`);
        type = 'Other';
      }
      
      // Ensure relevance score is within valid range
      let relevanceScore = discovery.relevanceScore || 5;
      relevanceScore = Math.max(1, Math.min(10, relevanceScore));
      
      return {
        projectId,
        title: discovery.title,
        description: discovery.description,
        source: discovery.source || `Newsletter: ${newsletterData.name}`,
        relevanceScore: relevanceScore,
        categories: discovery.categories || [],
        type: type,
        discoveredAt: new Date(),
        publicationDate: newsletterData.date ? new Date(newsletterData.date) : new Date(),
        searchContext: {
          source: 'newsletter',
          newsletterName: newsletterData.name,
          newsletterSubject: newsletterData.subject
        }
      };
    });
    
    // Only save if we have discoveries
    if (discoveries.length > 0) {
      console.log(`Attempting to save ${discoveries.length} discoveries to database`);
      try {
        // Log the first discovery to be saved
        console.log('First discovery to be saved:', JSON.stringify(discoveries[0], null, 2));
        
        // Save to database
        const savedDiscoveries = await Discovery.insertMany(discoveries);
        console.log(`Successfully created ${savedDiscoveries.length} discoveries from newsletter`);
        
        // Log the IDs of saved discoveries
        console.log('Saved discovery IDs:', savedDiscoveries.map(d => d._id));
      } catch (dbError) {
        console.error('Error saving discoveries to database:', dbError);
        // Try to identify the specific issue
        if (dbError.name === 'ValidationError') {
          console.error('Validation error details:', dbError.errors);
        }
        throw dbError; // Re-throw to be caught by the outer try/catch
      }
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
                  let extractedLinks = [];
                  
                  if (parsed.html) {
                    // Keep HTML content for better URL extraction
                    content = parsed.html;
                    console.log('Using HTML content for better URL extraction');
                    
                    // Extract links from HTML content
                    try {
                      // More comprehensive regex to extract URLs from href attributes
                      // This handles both quoted and unquoted href values
                      const linkRegex = /href=["']?(https?:\/\/[^"'\s>]+)["']?/g;
                      let match;
                      while ((match = linkRegex.exec(parsed.html)) !== null) {
                        // Clean up the URL (remove tracking parameters if present)
                        let url = match[1];
                        
                        // Remove common tracking parameters
                        try {
                          const urlObj = new URL(url);
                          ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
                            urlObj.searchParams.delete(param);
                          });
                          url = urlObj.toString();
                        } catch (e) {
                          // If URL parsing fails, use the original URL
                          console.log(`Failed to parse URL: ${url}`);
                        }
                        
                        if (!extractedLinks.includes(url)) {
                          extractedLinks.push(url);
                        }
                      }
                      
                      // Also look for URLs in text content that might not be in href attributes
                      const urlRegex = /(https?:\/\/[^\s"'<>()[\]{}]+)/g;
                      while ((match = urlRegex.exec(parsed.html)) !== null) {
                        let url = match[1];
                        
                        // Special handling for Alpha Signal URLs
                        if (url.includes('link.alphasignal.ai')) {
                          // Make sure the URL is properly formatted
                          if (!url.startsWith('http')) {
                            url = 'https://' + url.replace(/^:?\/\//, '');
                          }
                          
                          // Ensure we have the correct Alpha Signal URL format
                          const codeMatch = url.match(/link\.alphasignal\.ai\/([A-Za-z0-9]+)/);
                          if (codeMatch && codeMatch[1]) {
                            // Ensure we have the clean format
                            url = `https://link.alphasignal.ai/${codeMatch[1]}`;
                            console.log(`Found Alpha Signal URL in text: ${url}`);
                          }
                        }
                        
                        if (!extractedLinks.includes(url)) {
                          extractedLinks.push(url);
                        }
                      }
                      
                      // Specifically look for Alpha Signal URLs in the content
                      const alphaSignalRegex = /https?:\/\/link\.alphasignal\.ai\/([A-Za-z0-9]+)/g;
                      while ((match = alphaSignalRegex.exec(parsed.html)) !== null) {
                        const url = `https://link.alphasignal.ai/${match[1]}`;
                        console.log(`Found direct Alpha Signal URL: ${url}`);
                        if (!extractedLinks.includes(url)) {
                          extractedLinks.push(url);
                        }
                      }
                      
                      console.log(`Extracted ${extractedLinks.length} links from HTML content`);
                      
                      // Add extracted links to the content for better processing
                      // Format as a structured section for better OpenAI processing
                      if (extractedLinks.length > 0) {
                        // First, prioritize Alpha Signal links by moving them to the top
                        const alphaSignalLinks = extractedLinks.filter(link => link.includes('link.alphasignal.ai'));
                        const otherLinks = extractedLinks.filter(link => !link.includes('link.alphasignal.ai'));
                        
                        // Sort the links so Alpha Signal links come first
                        const sortedLinks = [...alphaSignalLinks, ...otherLinks];
                        
                        content += "\n\n### EXTRACTED LINKS ###\n";
                        
                        // Add special marker for Alpha Signal links to ensure they're prioritized
                        if (alphaSignalLinks.length > 0) {
                          content += "# IMPORTANT ALPHA SIGNAL LINKS - USE THESE EXACT URLS:\n";
                          alphaSignalLinks.forEach((link, index) => {
                            content += `[Alpha Signal Link ${index + 1}] ${link}\n`;
                          });
                          content += "\n# OTHER EXTRACTED LINKS:\n";
                        }
                        
                        // Add all links with indices
                        sortedLinks.forEach((link, index) => {
                          content += `[Link ${index + 1}] ${link}\n`;
                        });
                      }
                    } catch (err) {
                      console.error('Error extracting links from HTML:', err);
                    }
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
                    // Special handling for Alpha Signal newsletters
                    if (from.includes('alphasignal.ai')) {
                      console.log('Detected Alpha Signal newsletter - using specialized processing');
                      
                      // Extract sections from Alpha Signal newsletter if possible
                      try {
                        const sections = extractAlphaSignalSections(content);
                        if (sections && Object.keys(sections).length > 0) {
                          console.log(`Successfully extracted ${Object.keys(sections).length} sections from Alpha Signal newsletter`);
                          
                          // Format extracted items in a more structured way for better OpenAI processing
                          if (sections.extractedItems && sections.extractedItems.length > 0) {
                            console.log(`Found ${sections.extractedItems.length} direct items from Alpha Signal newsletter`);
                            
                            content += "\n\n### ALPHA SIGNAL CONTENT ITEMS ###\n";
                            sections.extractedItems.forEach((item, index) => {
                              content += `[Item ${index + 1}] ${item.title}\n`;
                              content += `URL: ${item.url}\n`;
                              if (item.category) content += `Category: ${item.category}\n`;
                              if (item.likes) content += `Popularity: ${item.likes} Likes\n`;
                              content += "\n";
                            });
                            
                            // Process each item directly to create discoveries
                            const directDiscoveries = [];
                            
                            // First, log all items for debugging
                            console.log('Alpha Signal items extracted:');
                            sections.extractedItems.forEach((item, index) => {
                              console.log(`Item ${index + 1}: Title: "${item.title}", URL: ${item.url}, Category: ${item.category || 'N/A'}`);
                            });
                            
                            // Create a map to track which URLs have been used
                            const usedUrls = new Map();
                            
                            // Define promotional titles to filter out
                            const promotionalTitles = [
                              'signup', 'sign up', 'subscribe', 
                              'follow', 'work with us', 'join', 
                              'contact', 'about us', 'feedback'
                            ];
                            
                            sections.extractedItems.forEach((item, index) => {
                              if (item.url && item.title) {
                                // Skip promotional items
                                const lowerTitle = item.title.toLowerCase();
                                if (promotionalTitles.some(promo => lowerTitle.includes(promo))) {
                                  console.log(`Skipping promotional item: "${item.title}"`);
                                  return; // Skip this item
                                }
                                // Clean and format Alpha Signal URLs
                                if (item.url.includes('link.alphasignal.ai')) {
                                  const codeMatch = item.url.match(/link\.alphasignal\.ai\/([A-Za-z0-9]+)/);
                                  if (codeMatch && codeMatch[1]) {
                                    // Ensure we have the clean format
                                    const cleanUrl = `https://link.alphasignal.ai/${codeMatch[1]}`;
                                    
                                    // Update the item URL to the clean version
                                    item.url = cleanUrl;
                                  }
                                }
                                
                                // Add to extracted links if not already there
                                if (!extractedLinks.includes(item.url)) {
                                  extractedLinks.push(item.url);
                                  console.log(`Added item URL to extracted links: ${item.url}`);
                                }
                                
                                // Check if this URL has been used before
                                if (usedUrls.has(item.url)) {
                                  console.log(`Warning: URL ${item.url} is used by multiple items. First for "${usedUrls.get(item.url)}", now for "${item.title}"`);
                                } else {
                                  usedUrls.set(item.url, item.title);
                                }
                                
                                // Create a direct discovery for this item
                                console.log(`Creating direct discovery for item ${index + 1}: ${item.title}`);
                                
                                // Create a basic description
                                let description = `This is an AI tool or technology mentioned in the Alpha Signal newsletter.`;
                                if (item.category) {
                                  description += ` It falls under the category of ${item.category}.`;
                                }
                                if (item.likes) {
                                  description += ` It has received ${item.likes} likes.`;
                                }
                                
                                // Create discovery object with exact title and URL from the newsletter
                                const discovery = {
                                  title: item.title,
                                  description: description,
                                  source: item.url,
                                  relevanceScore: 5, // Default middle relevance - will be evaluated by OpenAI
                                  categories: item.category ? [item.category, 'AI', 'Technology'] : ['AI', 'Technology'],
                                  type: 'Tool' // Default type
                                };
                                
                                directDiscoveries.push(discovery);
                              }
                            });
                            
                            // Store the direct discoveries for later use
                            if (directDiscoveries.length > 0) {
                              console.log(`Created ${directDiscoveries.length} direct discoveries from Alpha Signal items`);
                              sections.directDiscoveries = directDiscoveries;
                            }
                          }
                          
                          // Add other section information to the content
                          content += "\n\n### EXTRACTED SECTIONS ###\n" + JSON.stringify(sections, null, 2);
                        }
                      } catch (err) {
                        console.error('Error extracting sections from Alpha Signal newsletter:', err);
                      }
                    }
                    
                    // Special handling for Superhuman newsletters
                    if (from.includes('joinsuperhuman.ai')) {
                      console.log('Detected Superhuman newsletter - using specialized processing');
                      
                      // Extract sections from Superhuman newsletter if possible
                      try {
                        const sections = extractSuperhumanSections(content);
                        if (sections && Object.keys(sections).length > 0) {
                          console.log(`Successfully extracted ${Object.keys(sections).length} sections from Superhuman newsletter`);
                          // Add section information to the content
                          content += "\n\nEXTRACTED SECTIONS:\n" + JSON.stringify(sections, null, 2);
                        }
                      } catch (err) {
                        console.error('Error extracting sections from Superhuman newsletter:', err);
                      }
                    }
                    
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

/**
 * Extract sections from Alpha Signal newsletter
 * @param {string} content - The newsletter content
 * @returns {Object} - Extracted sections
 */
function extractAlphaSignalSections(content) {
  const sections = {};
  const items = [];
  
  try {
    // Extract TOP NEWS section
    const topNewsMatch = content.match(/TOP NEWS([\s\S]*?)(?:TRENDING SIGNALS|$)/i);
    if (topNewsMatch && topNewsMatch[1]) {
      sections.topNews = topNewsMatch[1].trim();
    }
    
    // Extract TRENDING SIGNALS section
    const trendingSignalsMatch = content.match(/TRENDING SIGNALS([\s\S]*?)(?:TOP TUTORIALS|$)/i);
    if (trendingSignalsMatch && trendingSignalsMatch[1]) {
      sections.trendingSignals = trendingSignalsMatch[1].trim();
    }
    
    // Extract TOP TUTORIALS section
    const topTutorialsMatch = content.match(/TOP TUTORIALS([\s\S]*?)(?:HOW TO|$)/i);
    if (topTutorialsMatch && topTutorialsMatch[1]) {
      sections.topTutorials = topTutorialsMatch[1].trim();
    }
    
    // Extract HOW TO section
    const howToMatch = content.match(/HOW TO([\s\S]*?)(?:How was today's email\?|$)/i);
    if (howToMatch && howToMatch[1]) {
      sections.howTo = howToMatch[1].trim();
    }
    
    // Extract news items directly from HTML structure
    // Look for href links with titles - these are the main content items
    // This pattern handles both standard format and the special Alpha Signal format with =3D encoding
    const titleLinkRegex = /<a href=3D["']?(https?:\/\/[^"'\s>]+)["']?[^>]*>([^<]+)<\/a>/g;
    
    // Also try a more specific pattern for Alpha Signal URLs - with multiple encoding variations
    // The email format can vary significantly between email clients and rendering
    const alphaSignalLinkRegex = [
      // Standard format with =3D encoding
      /<a href=3D["']?(https?:\/\/link\.alphasignal\.ai\/[^"'\s>]+)["']?[^>]*>([^<]+)<\/a>/g,
      // Format without =3D encoding
      /<a href=["']?(https?:\/\/link\.alphasignal\.ai\/[^"'\s>]+)["']?[^>]*>([^<]+)<\/a>/g,
      // Format with different quote styles
      /<a href=3D'(https?:\/\/link\.alphasignal\.ai\/[^']+)'[^>]*>([^<]+)<\/a>/g,
      // Format with URL encoding in path
      /<a href=3D["']?(https?:\/\/link\.alphasignal\.ai\/[A-Za-z0-9%]+)["']?[^>]*>([^<]+)<\/a>/g
    ];
    
    // Log the content for debugging
    console.log('Searching for Alpha Signal links in content...');
    
    // Look for specific patterns that indicate Alpha Signal newsletter format
    const alphaSignalFormatMatch = content.match(/TOP NEWS|TRENDING SIGNALS|TOP TUTORIALS|HOW TO/g);
    if (alphaSignalFormatMatch) {
      console.log(`Detected Alpha Signal newsletter format with sections: ${alphaSignalFormatMatch.join(', ')}`);
    }
    let match;
    
    while ((match = titleLinkRegex.exec(content)) !== null) {
      // Fix URL encoding - handle both =3D and other encoded characters
      let url = match[1].replace(/=3D/g, '=');
      
      // Handle other common URL encoding in emails
      url = url.replace(/=([0-9A-F]{2})/g, (_, p1) => {
        try {
          return String.fromCharCode(parseInt(p1, 16));
        } catch (e) {
          return _;
        }
      });
      
      // Special handling for Alpha Signal URLs - preserve their tracking/shortened URLs
      if (url.includes('link.alphasignal.ai')) {
        console.log(`Preserving Alpha Signal tracking URL: ${url}`);
        // Make sure the URL is properly formatted
        if (!url.startsWith('http')) {
          url = 'https://' + url.replace(/^:?\/\//, '');
        }
        
        // Ensure we have the correct Alpha Signal URL format
        const codeMatch = url.match(/link\.alphasignal\.ai\/([A-Za-z0-9]+)/);
        if (codeMatch && codeMatch[1]) {
          // Ensure we have the clean format
          url = `https://link.alphasignal.ai/${codeMatch[1]}`;
          console.log(`Cleaned Alpha Signal URL: ${url}`);
        }
      } else {
        // For other URLs, clean tracking parameters
        try {
          const urlObj = new URL(url);
          ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
            urlObj.searchParams.delete(param);
          });
          url = urlObj.toString();
        } catch (e) {
          console.log(`Failed to parse URL: ${url}`);
        }
      }
      
      const title = match[2].trim();
      
      // Look for category tags (like "AI Tool", "Chatbot", etc.)
      const beforeContext = content.substring(Math.max(0, match.index - 300), match.index);
      const categoryMatch = beforeContext.match(/<span style=3D[^>]*>([^<]+)<\/span>/);
      const category = categoryMatch ? categoryMatch[1].replace(/=3D/g, '=').trim() : '';
      
      // Look for like counts
      const afterContext = content.substring(match.index, Math.min(content.length, match.index + 500));
      const likesMatch = afterContext.match(/=E2=87=A7\s*([\d,]+)\s*Likes/);
      const likes = likesMatch ? likesMatch[1].trim() : '';
      
      if (title && url) {
        items.push({
          title,
          url, // URL is already cleaned above
          category,
          likes
        });
      }
    }
    
    // Try each of the Alpha Signal specific regex patterns to catch any links we might have missed
    for (const regexPattern of alphaSignalLinkRegex) {
      let alphaMatch;
      while ((alphaMatch = regexPattern.exec(content)) !== null) {
        // Fix URL encoding
        let url = alphaMatch[1].replace(/=3D/g, '=');
        
        // Handle other common URL encoding in emails
        url = url.replace(/=([0-9A-F]{2})/g, (_, p1) => {
          try {
            return String.fromCharCode(parseInt(p1, 16));
          } catch (e) {
            return _;
          }
        });
        
        // Make sure the URL is properly formatted
        if (!url.startsWith('http')) {
          url = 'https://' + url.replace(/^:?\/\//, '');
        }
        
        // Ensure we have the correct Alpha Signal URL format
        if (url.includes('link.alphasignal.ai/')) {
          // Extract just the code part if needed
          const codeMatch = url.match(/link\.alphasignal\.ai\/([A-Za-z0-9]+)/);
          if (codeMatch && codeMatch[1]) {
            // Ensure we have the clean format
            url = `https://link.alphasignal.ai/${codeMatch[1]}`;
          }
        }
        
        // Get the title and clean it
        const title = alphaMatch[2].trim()
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/=E2=80=99/g, "'")
          .replace(/=E2=80=9C/g, '"')
          .replace(/=E2=80=9D/g, '"');
        
        // Log the match for debugging
        console.log(`Found Alpha Signal link match: URL=${url}, Title="${title}"`);
        
        // Look for category tags - search in a wider context to find the category
        const beforeContext = content.substring(Math.max(0, alphaMatch.index - 500), alphaMatch.index);
        
        // Try multiple patterns for category extraction
        const categoryPatterns = [
          /<span style=3D[^>]*>([^<]+)<\/span>/,
          /<span style=[^>]*>([^<]+)<\/span>/,
          /<div[^>]*class=3D["']?category["']?[^>]*>([^<]+)<\/div>/,
          /<div[^>]*class=["']?category["']?[^>]*>([^<]+)<\/div>/
        ];
        
        let category = '';
        for (const pattern of categoryPatterns) {
          const categoryMatch = beforeContext.match(pattern);
          if (categoryMatch && categoryMatch[1]) {
            category = categoryMatch[1].replace(/=3D/g, '=').trim();
            break;
          }
        }
        
        // Look for like counts with multiple patterns
        const afterContext = content.substring(alphaMatch.index, Math.min(content.length, alphaMatch.index + 500));
        const likesPatterns = [
          /=E2=87=A7\s*([\d,]+)\s*Likes/,
          /⇧\s*([\d,]+)\s*Likes/,
          /(\d+)\s*Likes/
        ];
        
        let likes = '';
        for (const pattern of likesPatterns) {
          const likesMatch = afterContext.match(pattern);
          if (likesMatch && likesMatch[1]) {
            likes = likesMatch[1].trim();
            break;
          }
        }
        
        // Check if we already have this URL to avoid duplicates
        const isDuplicate = items.some(item => {
          // Check for exact URL match
          if (item.url === url) {
            console.log(`Skipping duplicate URL: ${url}`);
            return true;
          }
          
          // Check for URL with the same Alpha Signal code
          if (item.url.includes('link.alphasignal.ai/') && url.includes('link.alphasignal.ai/')) {
            const itemCode = item.url.match(/link\.alphasignal\.ai\/([A-Za-z0-9]+)/);
            const urlCode = url.match(/link\.alphasignal\.ai\/([A-Za-z0-9]+)/);
            if (itemCode && urlCode && itemCode[1] === urlCode[1]) {
              console.log(`Skipping duplicate Alpha Signal code: ${itemCode[1]}`);
              return true;
            }
          }
          
          // Check for exact title match
          if (item.title === title) {
            console.log(`Skipping duplicate title: "${title}"`);
            return true;
          }
          
          return false;
        });
        
        if (title && url && !isDuplicate) {
          console.log(`Adding Alpha Signal item: URL=${url}, Title="${title}", Category=${category || 'N/A'}`);
          items.push({
            title,
            url,
            category,
            likes
          });
        }
      }
    }
    
    // Add the extracted items to the sections object
    if (items.length > 0) {
      sections.extractedItems = items;
      console.log(`Total extracted items: ${items.length}`);
    }
    
    // Also try the old method as a fallback
    if (Object.keys(sections).length <= 1 && items.length === 0) {
      console.log('Falling back to traditional section extraction method');
      
      // Try to extract individual items from each section
      Object.keys(sections).forEach(sectionKey => {
        const sectionContent = sections[sectionKey];
        const sectionItems = [];
        
        // Look for patterns like titles followed by descriptions
        // Updated pattern to better match Alpha Signal format
        const itemMatches = sectionContent.match(/([A-Z][^\n]+)\n([^⇧]+)⇧/g) || 
                           sectionContent.match(/([A-Z][^\n]+)\n([^=]+)=/g) ||
                           sectionContent.match(/<h3[^>]*>([^<]+)<\/h3>.*?<p[^>]*>([^<]+)<\/p>/g);
        
        if (itemMatches) {
          itemMatches.forEach(item => {
            let title = '';
            let description = '';
            
            if (item.includes('<h3')) {
              const titleMatch = item.match(/<h3[^>]*>([^<]+)<\/h3>/);
              title = titleMatch ? titleMatch[1].trim() : '';
              
              const descMatch = item.match(/<p[^>]*>([^<]+)<\/p>/);
              description = descMatch ? descMatch[1].trim() : '';
            } else {
              const titleMatch = item.match(/([A-Z][^\n]+)\n/);
              title = titleMatch ? titleMatch[1].trim() : '';
              
              const descMatch = item.match(/\n([^⇧=]+)[⇧=]/);
              description = descMatch ? descMatch[1].trim() : '';
            }
            
            if (title && description) {
              sectionItems.push({ title, description });
            }
          });
        }
        
        if (sectionItems.length > 0) {
          sections[sectionKey + 'Items'] = sectionItems;
        }
      });
    }
    
    return sections;
  } catch (error) {
    console.error('Error extracting Alpha Signal sections:', error);
    return { extractedItems: items }; // Return any items we found even if there was an error
  }
}

/**
 * Extract sections from Superhuman newsletter
 * @param {string} content - The newsletter content
 * @returns {Object} - Extracted sections
 */
function extractSuperhumanSections(content) {
  const sections = {};
  
  try {
    // Extract TODAY IN AI section
    const todayInAiMatch = content.match(/TODAY IN AI([\s\S]*?)(?:FROM THE FRONTIER|PRESENTED BY|$)/i);
    if (todayInAiMatch && todayInAiMatch[1]) {
      sections.todayInAi = todayInAiMatch[1].trim();
    }
    
    // Extract FROM THE FRONTIER section
    const frontierMatch = content.match(/FROM THE FRONTIER([\s\S]*?)(?:THE AI ACADEMY|PRESENTED BY|$)/i);
    if (frontierMatch && frontierMatch[1]) {
      sections.frontier = frontierMatch[1].trim();
    }
    
    // Extract AI & TECH NEWS section
    const techNewsMatch = content.match(/AI & TECH NEWS([\s\S]*?)(?:PRODUCTIVITY|PRESENTED BY|$)/i);
    if (techNewsMatch && techNewsMatch[1]) {
      sections.techNews = techNewsMatch[1].trim();
    }
    
    // Extract PRODUCTIVITY section
    const productivityMatch = content.match(/PRODUCTIVITY([\s\S]*?)(?:PROMPT OF THE DAY|SOCIAL SIGNALS|$)/i);
    if (productivityMatch && productivityMatch[1]) {
      sections.productivity = productivityMatch[1].trim();
    }
    
    // Extract SOCIAL SIGNALS section
    const socialSignalsMatch = content.match(/SOCIAL SIGNALS([\s\S]*?)(?:AI-GENERATED IMAGES|$)/i);
    if (socialSignalsMatch && socialSignalsMatch[1]) {
      sections.socialSignals = socialSignalsMatch[1].trim();
    }
    
    // Try to extract individual news items from each section
    Object.keys(sections).forEach(sectionKey => {
      const sectionContent = sections[sectionKey];
      const items = [];
      
      // Look for numbered items (e.g., "1. New model can clone...")
      const numberedItems = sectionContent.match(/\d+\.\s+([^\n]+)[\s\S]*?(?=\d+\.\s+|$)/g);
      
      if (numberedItems) {
        numberedItems.forEach(item => {
          const titleMatch = item.match(/\d+\.\s+([^\n]+)/);
          const title = titleMatch ? titleMatch[1].trim() : '';
          
          // Get the rest of the content as description
          const description = item.replace(/\d+\.\s+([^\n]+)/, '').trim();
          
          if (title) {
            items.push({ 
              title, 
              description: description || 'No description available' 
            });
          }
        });
      } else {
        // Try to extract items with emoji bullets (e.g., "✅ MindPal:")
        const emojiItems = sectionContent.match(/[✅🦎♟️🤝📊🎮💰✍️🛒🧑‍💻🔮⚙️]\s+([^:]+):[^✅🦎♟️🤝📊🎮💰✍️🛒🧑‍💻🔮⚙️]*/g);
        
        if (emojiItems) {
          emojiItems.forEach(item => {
            const titleMatch = item.match(/[✅🦎♟️🤝📊🎮💰✍️🛒🧑‍💻🔮⚙️]\s+([^:]+):/);
            const title = titleMatch ? titleMatch[1].trim() : '';
            
            // Get the rest of the content as description
            const description = item.replace(/[✅🦎♟️🤝📊🎮💰✍️🛒🧑‍💻🔮⚙️]\s+([^:]+):/, '').trim();
            
            if (title) {
              items.push({ 
                title, 
                description: description || 'No description available' 
              });
            }
          });
        }
      }
      
      if (items.length > 0) {
        sections[sectionKey + 'Items'] = items;
      }
    });
    
    return sections;
  } catch (error) {
    console.error('Error extracting Superhuman sections:', error);
    return {};
  }
}

module.exports = {
  checkEmailsForUser,
  scheduleEmailChecks,
  runImmediateCheck,
  processNewsletterContent,
  extractAlphaSignalSections,
  extractSuperhumanSections
};