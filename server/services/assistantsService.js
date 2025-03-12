const { OpenAI } = require('openai');
const apiConfig = require('../config/apiConfig');
const Project = require('../models/Project');
const Discovery = require('../models/Discovery');
const { URL } = require('url');
const axios = require('axios');

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

const openai = new OpenAI({
  apiKey: apiConfig.openai.apiKey
});

/**
 * Service for managing OpenAI Assistants
 */
const assistantsService = {
  /**
   * Create or update an assistant for a project
   */
  createOrUpdateAssistant: async (project) => {
    try {
      // Check if the project already has an assistant
      if (project.assistantId) {
        // Update existing assistant
        console.log(`Updating assistant ${project.assistantId} for project ${project._id}`);
        
        const assistant = await openai.beta.assistants.update(
          project.assistantId,
          {
            name: `${project.name} Assistant`,
            instructions: `You are an AI assistant that helps find information about ${project.domain} related to the project goals: ${project.goals.join(', ')}. 
            The project is interested in: ${project.interests.join(', ')}.
            Your job is to search for and analyze developments, tools, and research in this field.
            
            IMPORTANT: When using search functions, DO NOT include any dates, years, or time references in your search queries.
            DO NOT use terms like "recent", "latest", "new", etc. in your search queries.
            Focus on the core topics and technologies without time references.
            
            Provide concise summaries and explain why each finding is relevant to the project.`,
            model: "gpt-4o",
            tools: [
              {
                "type": "function",
                "function": {
                  "name": "search_web",
                  "description": "Search the web for information",
                  "parameters": {
                    "type": "object",
                    "properties": {
                      "query": {
                        "type": "string",
                        "description": "The search query"
                      }
                    },
                    "required": ["query"]
                  }
                }
              }
            ]
          }
        );
        
        return assistant;
      } else {
        // Create new assistant
        console.log(`Creating new assistant for project ${project._id}`);
        
        const assistant = await openai.beta.assistants.create({
          name: `${project.name} Assistant`,
          instructions: `You are an AI assistant that helps find information about ${project.domain} related to the project goals: ${project.goals.join(', ')}. 
          The project is interested in: ${project.interests.join(', ')}.
          Your job is to search for and analyze developments, tools, and research in this field.
          
          IMPORTANT: When using search functions, DO NOT include any dates, years, or time references in your search queries.
          DO NOT use terms like "recent", "latest", "new", etc. in your search queries.
          Focus on the core topics and technologies without time references.
          
          Provide concise summaries and explain why each finding is relevant to the project.`,
          model: "gpt-4o",
          tools: [
            {
              "type": "function",
              "function": {
                "name": "search_web",
                "description": "Search the web for information",
                "parameters": {
                  "type": "object",
                  "properties": {
                    "query": {
                      "type": "string",
                      "description": "The search query"
                    }
                  },
                  "required": ["query"]
                }
              }
            }
          ]
        });
        
        // Update project with assistant ID
        await Project.findByIdAndUpdate(project._id, { assistantId: assistant.id });
        
        return assistant;
      }
    } catch (error) {
      console.error('Error creating/updating assistant:', error);
      throw new Error('Failed to create or update assistant');
    }
  },
  
  /**
   * Create a thread for a project
   */
  createThread: async () => {
    try {
      const thread = await openai.beta.threads.create();
      return thread;
    } catch (error) {
      console.error('Error creating thread:', error);
      throw new Error('Failed to create thread');
    }
  },
  
  /**
   * Add a message to a thread
   */
  addMessageToThread: async (threadId, content, role = 'user') => {
    try {
      const message = await openai.beta.threads.messages.create(
        threadId,
        {
          role: role,
          content: content
        }
      );
      return message;
    } catch (error) {
      console.error('Error adding message to thread:', error);
      throw new Error('Failed to add message to thread');
    }
  },
  
  /**
   * Run an assistant on a thread
   */
  runAssistant: async (threadId, assistantId, instructions = '') => {
    try {
      const run = await openai.beta.threads.runs.create(
        threadId,
        {
          assistant_id: assistantId,
          instructions: instructions
        }
      );
      return run;
    } catch (error) {
      console.error('Error running assistant:', error);
      throw new Error('Failed to run assistant');
    }
  },
  
  /**
   * Get the status of a run
   */
  getRunStatus: async (threadId, runId) => {
    try {
      const run = await openai.beta.threads.runs.retrieve(
        threadId,
        runId
      );
      return run;
    } catch (error) {
      console.error('Error getting run status:', error);
      throw new Error('Failed to get run status');
    }
  },
  
  /**
   * Wait for a run to complete
   */
  waitForRunCompletion: async (threadId, runId, maxAttempts = 180, delayMs = 2000) => {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const run = await assistantsService.getRunStatus(threadId, runId);
      
      if (run.status === 'completed') {
        return run;
      } else if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
        throw new Error(`Run ${runId} ended with status: ${run.status}`);
      } else if (run.status === 'requires_action') {
        // Handle function calling
        if (run.required_action && run.required_action.type === 'submit_tool_outputs') {
          const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
          const toolOutputs = [];
          
          for (const toolCall of toolCalls) {
            if (toolCall.function.name === 'search_web') {
              try {
                // Parse the function arguments
                const args = JSON.parse(toolCall.function.arguments);
                let query = args.query;
                
                // Clean the query to remove any date or time references
                // Remove years (2020-2029)
                query = query.replace(/\b20(2\d|1\d)\b/g, '');
                
                // Remove month names
                query = query.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi, '');
                
                // Remove time reference words
                query = query.replace(/\b(recent|latest|new|current|today|upcoming|modern|emerging|this year|past|last)\b/gi, '');
                
                // Remove "in the past X" phrases
                query = query.replace(/\bin the past\s+\w+\b/gi, '');
                
                // Clean up any double spaces and trim
                query = query.replace(/\s+/g, ' ').trim();
                
                console.log(`Assistant requested search for: "${args.query}"`);
                console.log(`Cleaned search query: "${query}"`);
                
                // Perform a web search using the OpenAI chat completions API with web search capability
                let searchResults;
                
                try {
                  // First try with the web search model
                  console.log(`Attempting web search with model gpt-4o-search-preview for: ${query}`);
                  const completion = await openai.chat.completions.create({
                    model: "gpt-4o-search-preview",
                    web_search_options: {
                      search_context_size: "medium"
                    },
                    messages: [
                      {
                        role: "system",
                        content: "You are a helpful assistant that searches the web for information. Provide comprehensive and accurate information from reputable sources."
                      },
                      {
                        role: "user",
                        content: `Search for information about: ${query}
                        
                        Please provide:
                        1. A summary of the most relevant information
                        2. Links to the sources you used
                        3. Brief explanations of why each source is relevant`
                      }
                    ]
                  });
                  
                  console.log(`Web search successful with ${completion.choices[0].message.annotations?.length || 0} citations`);
                  searchResults = completion.choices[0].message.content;
                } catch (searchError) {
                  console.log(`Web search model failed, falling back to standard model: ${searchError.message}`);
                  
                  // Fall back to standard model if web search model fails
                  try {
                    const fallbackCompletion = await openai.chat.completions.create({
                      model: "gpt-4o",
                      messages: [
                        {
                          role: "system",
                          content: "You are a helpful assistant that provides information about topics. Provide comprehensive and accurate information based on your knowledge."
                        },
                        {
                          role: "user",
                          content: `Provide information about: ${query}
                          
                          Please include:
                          1. A summary of key concepts and technologies
                          2. Examples of tools or techniques in this area
                          3. How this relates to visual effects and animation workflows`
                        }
                      ]
                    });
                    
                    console.log(`Fallback to standard model successful`);
                    searchResults = fallbackCompletion.choices[0].message.content;
                  } catch (fallbackError) {
                    console.error(`Fallback model also failed: ${fallbackError.message}`);
                    searchResults = `Error performing search for "${query}". Please try a different query.`;
                  }
                }
                
                // Add the tool output
                toolOutputs.push({
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({
                    results: searchResults
                  })
                });
              } catch (error) {
                console.error('Error performing web search for assistant:', error);
                toolOutputs.push({
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({
                    error: "Failed to perform web search",
                    message: error.message
                  })
                });
              }
            }
          }
          
          // Submit the tool outputs
          if (toolOutputs.length > 0) {
            try {
              await openai.beta.threads.runs.submitToolOutputs(
                threadId,
                runId,
                { tool_outputs: toolOutputs }
              );
              
              // Continue waiting for completion
              await new Promise(resolve => setTimeout(resolve, delayMs));
              attempts++;
              continue;
            } catch (error) {
              console.error('Error submitting tool outputs:', error);
              throw new Error(`Failed to submit tool outputs: ${error.message}`);
            }
          }
        }
      }
      
      // Log status periodically
      if (attempts % 10 === 0) {
        console.log(`Waiting for run ${runId} to complete. Current status: ${run.status}. Attempt ${attempts}/${maxAttempts}`);
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, delayMs));
      attempts++;
    }
    
    throw new Error(`Run ${runId} did not complete within the expected time (${maxAttempts * delayMs / 1000} seconds)`);
  },
  
  /**
   * Get messages from a thread
   */
  getThreadMessages: async (threadId) => {
    try {
      const messages = await openai.beta.threads.messages.list(
        threadId
      );
      return messages.data;
    } catch (error) {
      console.error('Error getting thread messages:', error);
      throw new Error('Failed to get thread messages');
    }
  },
  
  /**
   * Perform a search using the assistant
   */
  performAssistantSearch: async (project, query) => {
    try {
      // Create or update the assistant
      const assistant = await assistantsService.createOrUpdateAssistant(project);
      
      // Create a thread
      const thread = await assistantsService.createThread();
      
      // Add the search query as a message
      await assistantsService.addMessageToThread(
        thread.id, 
        `Search for information about ${project.domain} related to: ${query}. 
        
        Use your search_web function to find relevant information.
        
        IMPORTANT: When using the search_web function, DO NOT include any dates, years, or time references in your search queries.
        
        Specifically look for:
        1. Information about ${project.domain}
        2. Tools, techniques, or research related to ${project.interests.join(', ')}
        3. Industry trends and technologies
        
        For each result, please provide:
        - A clear title
        - A concise description
        - The source URL
        - Why it's relevant to this project
        - A categorization (Article, Tool, Research, etc.)`
      );
      
      // Run the assistant
      const run = await assistantsService.runAssistant(
        thread.id,
        assistant.id,
        `IMPORTANT INSTRUCTIONS:
        
        1. When using the search_web function, DO NOT include any dates, years, or time references in your search queries.
        2. DO NOT use terms like "recent", "latest", "new", etc. in your search queries.
        3. Focus on the core topics and technologies without time references.
        
        For each result, provide:
        1. A clear title
        2. A concise description
        3. The source URL
        4. Why it's relevant to the project goals: ${project.goals.join(', ')}
        5. Categorize each result as: Article, Discussion, News, Research, Tool, or Other`
      );
      
      // Wait for the run to complete
      await assistantsService.waitForRunCompletion(thread.id, run.id);
      
      // Get the messages
      const messages = await assistantsService.getThreadMessages(thread.id);
      
      // Process the assistant's response
      const assistantMessages = messages.filter(msg => msg.role === 'assistant');
      if (assistantMessages.length === 0) {
        throw new Error('No response from assistant');
      }
      
      // Get the latest assistant message
      const latestMessage = assistantMessages[0];
      
      // Extract the content and annotations (citations)
      const content = latestMessage.content[0].text.value;
      const annotations = latestMessage.content[0].text.annotations || [];
      
      // Process the results
      const results = [];
      
      // Extract URLs from annotations
      const citations = annotations
        .filter(annotation => annotation.type === 'file_citation' || annotation.type === 'file_path')
        .map(annotation => {
          if (annotation.type === 'file_citation') {
            return {
              text: content.substring(annotation.start_index, annotation.end_index),
              url: annotation.file_citation.source || ''
            };
          } else {
            return {
              text: content.substring(annotation.start_index, annotation.end_index),
              url: annotation.file_path.source || ''
            };
          }
        });
      
      // Use AI to parse the content into structured results
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that extracts structured information from search results."
          },
          {
            role: "user",
            content: `Extract the search results from the following text into a structured JSON format. 
            Each result should have: title, description, source (URL), relevanceScore (1-10), type (Article, Discussion, News, Research, Tool, or Other), and categories (array of strings).
            
            Search results:
            ${content}
            
            Citations:
            ${JSON.stringify(citations)}
            
            Return ONLY a JSON array of results without any explanation or markdown.`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      // Parse the structured results
      const parsedResults = JSON.parse(completion.choices[0].message.content);
      
      // Process each result without URL validation to speed up processing
      for (const result of parsedResults.results || []) {
        try {
          // Check if source is a URL
          const isUrl = result.source && result.source.match(/^https?:\/\//i);
          
          // Add all results regardless of URL validity
          results.push({
            title: result.title,
            description: result.description,
            source: isUrl ? result.source : (result.source || "AI-generated content"),
            relevanceScore: result.relevanceScore || 5,
            categories: result.categories || [],
            type: result.type || 'Other',
            date: result.date || new Date().toISOString().split('T')[0]
          });
        } catch (error) {
          console.error(`Error processing result:`, error);
          // Skip this result
        }
      }
      
      // If no results were found, create a single result with the content
      if (results.length === 0) {
        console.log("No structured results found, using content as a single result");
        results.push({
          title: `Information about ${query}`,
          description: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
          source: "AI-generated content",
          relevanceScore: 5,
          categories: ["Information"],
          type: "Other",
          date: new Date().toISOString().split('T')[0]
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error performing assistant search:', error);
      throw new Error('Failed to perform assistant search');
    }
  }
};

module.exports = assistantsService;