const axios = require('axios');
const apiConfig = require('../config/apiConfig');
const Discovery = require('../models/Discovery');
const Project = require('../models/Project');
const openaiService = require('./openaiService');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: apiConfig.openai.apiKey
});

const searchService = {
  performWebSearch: async (query) => {
    try {
      console.log(`Performing web search for query: "${query}"`);
      
      // Use OpenAI to simulate web search results
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that simulates search engine results. Your task is to provide realistic search results for the given query as if you were a search engine. Focus on RECENT content from the past 3 months only."
          },
          {
            role: "user",
            content: `Generate search results for the query: "${query}".
            
            IMPORTANT: Focus ONLY on content from the past 3 months. All results should be from recent sources (December 2023 to March 2024).
            
            Provide realistic titles, descriptions, and URLs. Include the publication date in the description (e.g., "Published on February 15, 2024").
            
            Return the results in the following JSON format:
            {
              "results": [
                {
                  "title": "Result title",
                  "description": "Brief description or summary of the result",
                  "source": "URL of the source",
                  "date": "YYYY-MM-DD" (publication date)
                }
              ]
            }
            
            Provide 5-7 relevant results with realistic URLs. All dates must be within the last 3 months.`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const content = completion.choices[0].message.content;
      console.log(`Raw search response: ${content}`);
      
      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        console.error('Raw content:', content);
        throw new Error('Failed to parse search results');
      }
      
      const results = parsedContent.results || [];
      console.log(`Parsed ${results.length} search results`);
      
      // Process results to ensure they have dates and are recent
      const processedResults = results.map(result => {
        // If no date is provided, assign a recent random date
        if (!result.date) {
          const now = new Date();
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(now.getMonth() - 3);
          
          const randomDate = new Date(
            threeMonthsAgo.getTime() + Math.random() * (now.getTime() - threeMonthsAgo.getTime())
          );
          
          result.date = randomDate.toISOString().split('T')[0];
          result.description = `[Published on ${result.date}] ${result.description}`;
        }
        
        return result;
      });
      
      return processedResults;
    } catch (error) {
      console.error(`OpenAI search error: ${error}`);
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
    for (const result of processedResults) {
      if (result.relevanceScore >= 5) { // Only store relevant results
        try {
          await searchService.storeDiscovery(project._id, result);
          storedCount++;
        } catch (storeError) {
          console.error('Error storing discovery:', storeError);
          console.error('Store error details:', storeError.stack || storeError);
        }
      }
    }
    
    console.log(`Stored ${storedCount} relevant discoveries for project ${project._id}`);
    
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
                Also classify this result into one of these types: Article, Discussion, News, Research, Tool, or Other.
                
                Format your response as JSON: {
                  "relevanceScore": number, 
                  "categories": ["category1", "category2"],
                  "type": "Article|Discussion|News|Research|Tool|Other"
                }`
              }
            ]
          });
          
          const content = completion.choices[0].message.content;
          const evaluation = JSON.parse(content);
          
          processedResults.push({
            ...result,
            relevanceScore: evaluation.relevanceScore,
            categories: evaluation.categories,
            type: evaluation.type || 'Article'
          });
        } catch (evaluationError) {
          console.error('Result evaluation error:', evaluationError);
          // Add with default values if evaluation fails
          processedResults.push({
            ...result,
            relevanceScore: 5,
            categories: [],
            type: 'Other'
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
      
      if (existingDiscovery) {
        // Update existing discovery if relevance score is higher
        if (result.relevanceScore > existingDiscovery.relevanceScore) {
          existingDiscovery.relevanceScore = result.relevanceScore;
          existingDiscovery.categories = result.categories;
          
          // Update type if available
          if (result.type) {
            existingDiscovery.type = result.type;
          }
          
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
        type: result.type || 'Article',
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