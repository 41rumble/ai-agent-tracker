const axios = require('axios');
const apiConfig = require('../config/apiConfig');
const Discovery = require('../models/Discovery');
const openaiService = require('./openaiService');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: apiConfig.openai.apiKey
});

const searchService = {
  performWebSearch: async (query) => {
    try {
      // This would be replaced with your actual search API implementation
      const response = await axios.get(apiConfig.search.baseUrl, {
        params: {
          q: query,
          key: apiConfig.search.apiKey
        }
      });
      
      return response.data.results.map(result => ({
        title: result.title,
        description: result.snippet,
        source: result.link
      }));
    } catch (error) {
      console.error(`Search API error: ${error}`);
      throw new Error('Failed to perform search');
    }
  },
  
  performProjectSearch: async (project) => {
    try {
      // Generate search queries based on project
      const queries = await openaiService.generateSearchQueries(project._id, project);
      
      let allResults = [];
      
      // Perform searches for each query
      for (const query of queries) {
        try {
          const results = await searchService.performWebSearch(query);
          allResults = [...allResults, ...results];
        } catch (searchError) {
          console.error(`Error searching for query "${query}":`, searchError);
          // Continue with other queries
        }
      }
      
      // Process and filter results
      const processedResults = await searchService.processSearchResults(project, allResults);
      
      // Store relevant discoveries
      for (const result of processedResults) {
        if (result.relevanceScore >= 5) { // Only store relevant results
          try {
            await searchService.storeDiscovery(project._id, result);
          } catch (storeError) {
            console.error('Error storing discovery:', storeError);
          }
        }
      }
      
      return processedResults;
    } catch (error) {
      console.error('Project search error:', error);
      throw new Error('Failed to perform project search');
    }
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
                Format your response as JSON: {"relevanceScore": number, "categories": ["category1", "category2"]}`
              }
            ]
          });
          
          const content = completion.choices[0].message.content;
          const evaluation = JSON.parse(content);
          
          processedResults.push({
            ...result,
            relevanceScore: evaluation.relevanceScore,
            categories: evaluation.categories
          });
        } catch (evaluationError) {
          console.error('Result evaluation error:', evaluationError);
          // Add with default values if evaluation fails
          processedResults.push({
            ...result,
            relevanceScore: 5,
            categories: []
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
      
      if (existingDiscovery) {
        // Update existing discovery if relevance score is higher
        if (result.relevanceScore > existingDiscovery.relevanceScore) {
          existingDiscovery.relevanceScore = result.relevanceScore;
          existingDiscovery.categories = result.categories;
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
        categories: result.categories
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