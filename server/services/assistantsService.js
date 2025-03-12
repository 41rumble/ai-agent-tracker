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
            instructions: `You are an AI assistant that helps track advancements in ${project.domain} related to the project goals: ${project.goals.join(', ')}. 
            The project is interested in: ${project.interests.join(', ')}.
            Your job is to search for and analyze recent developments, tools, and research in this field.
            Focus on content from the past 3 months to ensure the information is current.
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
          instructions: `You are an AI assistant that helps track advancements in ${project.domain} related to the project goals: ${project.goals.join(', ')}. 
          The project is interested in: ${project.interests.join(', ')}.
          Your job is to search for and analyze recent developments, tools, and research in this field.
          Focus on content from the past 3 months to ensure the information is current.
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
                const query = args.query;
                
                console.log(`Assistant is requesting web search for: "${query}"`);
                
                // Perform a web search using the OpenAI chat completions API
                const completion = await openai.chat.completions.create({
                  model: "gpt-4o",
                  messages: [
                    {
                      role: "system",
                      content: "You are a helpful assistant that provides search results. Return 5-7 relevant results with titles, descriptions, and URLs."
                    },
                    {
                      role: "user",
                      content: `Search the web for: ${query}\n\nFocus on recent content from the past 3 months.`
                    }
                  ]
                });
                
                // Add the tool output
                toolOutputs.push({
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({
                    results: completion.choices[0].message.content
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
        `Search for recent advancements in ${project.domain} related to: ${query}. 
        
        Please focus on content from the past 3 months and use your search_web function to find the most relevant information.
        
        Specifically look for:
        1. Recent developments in ${project.domain}
        2. New tools, techniques, or research related to ${project.interests.join(', ')}
        3. Industry trends and emerging technologies
        
        For each result, please provide:
        - A clear title
        - A concise description
        - The source URL
        - Why it's relevant to this project
        - A categorization (Article, Tool, Research, etc.)
        
        Please ensure all sources are from reputable websites and are recent (within the past 3 months).`
      );
      
      // Run the assistant
      const run = await assistantsService.runAssistant(
        thread.id,
        assistant.id,
        `Focus on finding the most recent and relevant information from the past 3 months. 
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
      
      // Validate and process each result
      for (const result of parsedResults.results || []) {
        try {
          // Validate the URL
          const urlValidation = await validateUrl(result.source);
          if (urlValidation.isValid) {
            results.push({
              title: result.title,
              description: result.description,
              source: result.source,
              relevanceScore: result.relevanceScore || 5,
              categories: result.categories || [],
              type: result.type || 'Other',
              date: result.date || new Date().toISOString().split('T')[0]
            });
          } else {
            console.log(`Skipping invalid URL ${result.source}: ${urlValidation.reason}`);
          }
        } catch (error) {
          console.error(`Error processing result:`, error);
          // Skip this result
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error performing assistant search:', error);
      throw new Error('Failed to perform assistant search');
    }
  }
};

module.exports = assistantsService;