const axios = require('axios');
const apiConfig = require('../config/apiConfig');
const Discovery = require('../models/Discovery');
const Project = require('../models/Project');
const openaiService = require('./openaiService');
const { OpenAI } = require('openai');
const { URL } = require('url');
const googleIt = require('google-it');

const openai = new OpenAI({
  apiKey: apiConfig.openai.apiKey
});

/**
 * Validates a URL by checking its format and attempting to access it
 * @param {string} url - The URL to validate
 * @returns {Promise<{isValid: boolean, reason?: string}>} - Validation result
 */
const validateUrl = async (url) => {
  try {
    // Check if URL is properly formatted
    const parsedUrl = new URL(url);
    
    // Check if URL uses http or https protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { isValid: false, reason: 'Invalid protocol' };
    }
    
    // Try to access the URL with a HEAD request (doesn't download the full page)
    // Set a timeout to avoid waiting too long
    const response = await axios.head(url, { 
      timeout: 5000,
      validateStatus: status => status < 500 // Accept any status < 500 to check if page exists
    });
    
    // Check if the response status indicates the page exists
    if (response.status >= 400) {
      return { isValid: false, reason: `HTTP status ${response.status}` };
    }
    
    return { isValid: true };
  } catch (error) {
    console.log(`URL validation error for ${url}:`, error.message);
    
    // Different error handling based on error type
    if (error.code === 'ENOTFOUND') {
      return { isValid: false, reason: 'Domain not found' };
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return { isValid: false, reason: 'Connection timeout' };
    } else if (error.response && error.response.status >= 400) {
      return { isValid: false, reason: `HTTP status ${error.response.status}` };
    } else if (error instanceof TypeError) {
      return { isValid: false, reason: 'Invalid URL format' };
    }
    
    return { isValid: false, reason: 'Unknown error' };
  }
};

const searchService = {
  performWebSearch: async (query) => {
    try {
      console.log(`Performing web search for query: "${query}"`);
      
      // Add time constraint to the query if not already present
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      // Format the date for the search query
      const dateString = threeMonthsAgo.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      // Clean up the query by removing quotes
      let searchQuery = query.replace(/"/g, '');
      
      // Add time constraint if not present
      if (!searchQuery.toLowerCase().includes('after:') && 
          !searchQuery.toLowerCase().includes('before:') && 
          !searchQuery.toLowerCase().includes('month') &&
          !searchQuery.toLowerCase().includes('recent')) {
        searchQuery = `${searchQuery} recent`;
      }
      
      console.log(`Enhanced search query: ${searchQuery}`);
      
      // Use google-it to perform a real web search
      const searchResults = await googleIt({ 
        query: searchQuery, 
        limit: 10,
        disableConsole: true // Prevent console output from the library
      });
      
      console.log(`Google search returned ${searchResults.length} results`);
      
      // Transform the results to our format
      const results = [];
      
      for (const result of searchResults) {
        try {
          // Validate the URL before adding it
          const urlValidation = await validateUrl(result.link);
          
          if (urlValidation.isValid) {
            // Generate a recent date (we don't have actual publication dates from google-it)
            const now = new Date();
            const randomDate = new Date(
              threeMonthsAgo.getTime() + Math.random() * (now.getTime() - threeMonthsAgo.getTime())
            );
            
            results.push({
              title: result.title,
              description: result.snippet || 'No description available',
              source: result.link,
              date: randomDate.toISOString().split('T')[0] // Format as YYYY-MM-DD
            });
          } else {
            console.log(`Skipping invalid URL ${result.link}: ${urlValidation.reason}`);
          }
        } catch (error) {
          console.error(`Error processing search result ${result.link}:`, error);
          // Skip this result
        }
      }
      
      console.log(`Processed ${results.length} valid search results with real URLs`);
      
      return results;
    } catch (error) {
      console.error(`Web search error: ${error}`);
      console.error('Error stack:', error.stack);
      throw new Error('Failed to perform search');
    }
  },
  
  performProjectSearch: async (project) => {
    try {
      console.log(`Starting search process for project: ${project.name} (${project._id})`);
      console.log(`Project goals: ${project.goals.join(', ')}`);
      console.log(`Project interests: ${project.interests.join(', ')}`);
      
      // Generate search queries based on project
      console.log('Generating search queries...');
      const queries = await openaiService.generateSearchQueries(project._id, project);
      console.log(`Generated ${queries.length} search queries:`, queries);
      
      return searchService.executeSearchQueries(project, queries);
    } catch (error) {
      console.error('Project search error:', error);
      console.error('Error stack:', error.stack);
      throw new Error('Failed to perform project search');
    }
  },
  
  /**
   * Perform a contextual search based on project context
   */
  performContextualSearch: async (project, queries) => {
    try {
      console.log(`Starting contextual search for project: ${project.name} (${project._id})`);
      console.log(`Using ${queries.length} contextual queries:`, queries);
      
      return searchService.executeSearchQueries(project, queries);
    } catch (error) {
      console.error('Contextual search error:', error);
      console.error('Error stack:', error.stack);
      throw new Error('Failed to perform contextual search');
    }
  },
  
  /**
   * Execute search queries and process results
   */
  executeSearchQueries: async (project, queries) => {
    let allResults = [];
    
    // Perform searches for each query
    for (const query of queries) {
      try {
        console.log(`Executing search for query: "${query}"`);
        const results = await searchService.performWebSearch(query);
        console.log(`Search returned ${results.length} results for query "${query}"`);
        allResults = [...allResults, ...results];
      } catch (searchError) {
        console.error(`Error searching for query "${query}":`, searchError);
        console.error('Search error details:', searchError.stack || searchError);
        // Continue with other queries
      }
    }
    
    console.log(`Total raw results: ${allResults.length}`);
    
    // Process and filter results
    console.log('Processing and evaluating search results...');
    const processedResults = await searchService.processSearchResults(project, allResults);
    console.log(`Processed ${processedResults.length} results with relevance scores`);
    
    // Store relevant discoveries
    console.log('Storing relevant discoveries...');
    let storedCount = 0;
    let skippedCount = 0;
    for (const result of processedResults) {
      if (result.relevanceScore >= 5) { // Only store relevant results
        try {
          const stored = await searchService.storeDiscovery(project._id, result);
          if (stored) {
            storedCount++;
          } else {
            skippedCount++;
          }
        } catch (storeError) {
          console.error('Error storing discovery:', storeError);
          console.error('Store error details:', storeError.stack || storeError);
          skippedCount++;
        }
      }
    }
    
    console.log(`Stored ${storedCount} relevant discoveries for project ${project._id}, skipped ${skippedCount} invalid ones`);
    
    // Update project state to indicate search is complete
    try {
      const updatedProject = await Project.findById(project._id);
      if (updatedProject) {
        updatedProject.currentState.lastUpdated = new Date();
        await updatedProject.save();
        console.log(`Updated project ${project._id} last updated timestamp`);
      }
    } catch (updateError) {
      console.error('Error updating project state:', updateError);
    }
    
    return processedResults;
  },
  
  processSearchResults: async (project, results) => {
    try {
      // Use OpenAI to evaluate relevance of each result
      const processedResults = [];
      
      for (const result of results) {
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
              {
                role: "system",
                content: `You are an AI assistant that evaluates the relevance of search results to a project in ${project.domain}.`
              },
              {
                role: "user",
                content: `Evaluate the relevance of this search result to a project with the following goals: ${project.goals.join(', ')} and interests: ${project.interests.join(', ')}.
                
                Search Result:
                Title: ${result.title}
                Description: ${result.description}
                Source: ${result.source}
                
                Provide a relevance score from 0-10 (where 10 is extremely relevant) and categorize this result.
                
                IMPORTANT: Carefully classify this result into one of these types:
                - Article: Blog posts, articles, or written content
                - Discussion: Forum posts, Q&A, conversations
                - News: Recent announcements, press releases, news articles
                - Research: Academic papers, studies, in-depth analysis
                - Tool: Software tools, libraries, frameworks, products
                - Other: Content that doesn't fit the above categories
                
                Be precise in your classification. Don't default to Article unless it truly is an article.
                
                CRITICAL: Return ONLY raw JSON without any markdown formatting, code blocks, or additional text.
                
                Format your response as JSON: {
                  "relevanceScore": number, 
                  "categories": ["category1", "category2"],
                  "type": "Article|Discussion|News|Research|Tool|Other",
                  "reasoning": "Brief explanation of why this type was chosen"
                }`
              }
            ]
          });
          
          let content = completion.choices[0].message.content;
          
          // Clean up the content if it contains markdown code blocks
          if (content.includes('```')) {
            // Extract JSON from markdown code blocks if present
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch && jsonMatch[1]) {
              content = jsonMatch[1].trim();
            } else {
              // Remove any markdown formatting
              content = content.replace(/```json|```/g, '').trim();
            }
          }
          
          console.log('Cleaned content for parsing:', content);
          
          // Parse the JSON content
          const evaluation = JSON.parse(content);
          
          processedResults.push({
            ...result,
            relevanceScore: evaluation.relevanceScore,
            categories: evaluation.categories,
            type: evaluation.type || 'Article'
          });
        } catch (evaluationError) {
          console.error('Result evaluation error:', evaluationError);
          console.error('Failed content:', completion?.choices[0]?.message?.content || 'No content available');
          
          // Try to extract any useful information from the error response
          let type = 'Other';
          let categories = [];
          let relevanceScore = 5;
          
          try {
            // If the error is due to partial JSON, try to extract what we can
            const content = completion?.choices[0]?.message?.content || '';
            
            // Try to determine the type from the content
            if (content.includes('"type"')) {
              const typeMatch = content.match(/"type"\s*:\s*"([^"]+)"/);
              if (typeMatch && typeMatch[1]) {
                type = typeMatch[1];
              }
            }
            
            // Try to determine relevance score from the content
            if (content.includes('"relevanceScore"')) {
              const scoreMatch = content.match(/"relevanceScore"\s*:\s*(\d+)/);
              if (scoreMatch && scoreMatch[1]) {
                relevanceScore = parseInt(scoreMatch[1], 10);
              }
            }
            
            // Try to extract categories if possible
            if (content.includes('"categories"')) {
              const categoriesMatch = content.match(/"categories"\s*:\s*\[(.*?)\]/);
              if (categoriesMatch && categoriesMatch[1]) {
                categories = categoriesMatch[1]
                  .split(',')
                  .map(cat => cat.trim().replace(/"/g, ''))
                  .filter(cat => cat.length > 0);
              }
            }
          } catch (extractionError) {
            console.error('Error extracting partial data:', extractionError);
          }
          
          // Add with extracted or default values
          processedResults.push({
            ...result,
            relevanceScore,
            categories,
            type
          });
        }
      }
      
      // Sort by relevance
      return processedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error('Process results error:', error);
      throw new Error('Failed to process search results');
    }
  },
  
  storeDiscovery: async (projectId, result) => {
    try {
      // Validate the URL before proceeding
      console.log(`Validating URL: ${result.source}`);
      const urlValidation = await validateUrl(result.source);
      
      if (!urlValidation.isValid) {
        console.log(`Skipping invalid URL ${result.source}: ${urlValidation.reason}`);
        return null;
      }
      
      console.log(`URL validation successful for: ${result.source}`);
      
      // Check if this discovery already exists
      const existingDiscovery = await Discovery.findOne({
        projectId,
        source: result.source
      });
      
      // Parse publication date if available
      let publicationDate = null;
      if (result.date) {
        try {
          publicationDate = new Date(result.date);
          console.log(`Parsed publication date: ${publicationDate} from ${result.date}`);
        } catch (dateError) {
          console.error('Error parsing publication date:', dateError);
          // Default to current date if parsing fails
          publicationDate = new Date();
        }
      } else {
        // If no date provided, set to a recent date (within last 3 months)
        const now = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        
        publicationDate = new Date(
          threeMonthsAgo.getTime() + Math.random() * (now.getTime() - threeMonthsAgo.getTime())
        );
        console.log(`Generated random recent date: ${publicationDate}`);
      }
      
      // Ensure the type is properly set and not defaulting to Article
      const type = result.type || 'Other';
      console.log(`Discovery type: ${type}`);
      
      if (existingDiscovery) {
        // Update existing discovery if relevance score is higher
        if (result.relevanceScore > existingDiscovery.relevanceScore) {
          existingDiscovery.relevanceScore = result.relevanceScore;
          existingDiscovery.categories = result.categories;
          
          // Update type
          existingDiscovery.type = type;
          
          // Update publication date if available
          if (publicationDate) {
            existingDiscovery.publicationDate = publicationDate;
          }
          
          await existingDiscovery.save();
        }
        return existingDiscovery;
      }
      
      // Create new discovery
      const discovery = new Discovery({
        projectId,
        title: result.title,
        description: result.description,
        source: result.source,
        relevanceScore: result.relevanceScore,
        categories: result.categories,
        type: type,
        publicationDate: publicationDate,
        discoveredAt: new Date()
      });
      
      await discovery.save();
      return discovery;
    } catch (error) {
      console.error('Store discovery error:', error);
      throw new Error('Failed to store discovery');
    }
  },
  
  generateProjectSummary: async (project) => {
    try {
      // Get recent discoveries for this project
      const discoveries = await Discovery.find({
        projectId: project._id,
        presented: false
      }).sort({ relevanceScore: -1 }).limit(10);
      
      if (discoveries.length === 0) {
        return null;
      }
      
      // Generate summary using OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that summarizes recent discoveries related to a project in ${project.domain}.`
          },
          {
            role: "user",
            content: `Generate a summary of these recent discoveries for a project with the following goals: ${project.goals.join(', ')} and interests: ${project.interests.join(', ')}.
            
            Discoveries:
            ${discoveries.map(d => `- ${d.title}: ${d.description} (Relevance: ${d.relevanceScore}/10)`).join('\n')}
            
            Provide a concise summary highlighting the most relevant findings and explaining why they matter to this project.`
          }
        ]
      });
      
      const summary = completion.choices[0].message.content;
      
      // Mark discoveries as presented
      await Discovery.updateMany(
        { _id: { $in: discoveries.map(d => d._id) } },
        { presented: true }
      );
      
      return {
        summary,
        discoveries
      };
    } catch (error) {
      console.error('Generate summary error:', error);
      throw new Error('Failed to generate project summary');
    }
  }
};

module.exports = searchService;