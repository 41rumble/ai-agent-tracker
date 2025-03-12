const { OpenAI } = require('openai');
const apiConfig = require('../config/apiConfig');
const AgentType = require('../models/AgentType');
const Project = require('../models/Project');
const Discovery = require('../models/Discovery');
const assistantsService = require('./assistantsService');

const openai = new OpenAI({
  apiKey: apiConfig.openai.apiKey
});

/**
 * Service for specialized agent functionality
 */
const specializedAgentService = {
  /**
   * Get the appropriate agent type for a project
   */
  getAgentTypeForProject: async (projectId) => {
    try {
      const project = await Project.findById(projectId).populate('agentType');
      
      // If project has an agent type assigned, return it
      if (project.agentType) {
        return project.agentType;
      }
      
      // Otherwise, recommend an agent type based on project domain
      const domain = project.domain.toLowerCase();
      
      // Find agent types that match the domain
      const agentTypes = await AgentType.find({ active: true });
      
      // Try to find a direct match first
      const directMatch = agentTypes.find(type => 
        type.domain.toLowerCase() === domain
      );
      
      if (directMatch) {
        return directMatch;
      }
      
      // If no direct match, use AI to recommend the best agent type
      const recommendation = await specializedAgentService.recommendAgentType(project, agentTypes);
      return recommendation;
    } catch (error) {
      console.error('Error getting agent type for project:', error);
      throw new Error('Failed to get agent type for project');
    }
  },
  
  /**
   * Recommend an agent type for a project using AI
   */
  recommendAgentType: async (project, agentTypes) => {
    try {
      // Extract relevant information from agent types
      const agentTypeInfo = agentTypes.map(type => ({
        id: type._id,
        name: type.name,
        domain: type.domain,
        description: type.description,
        capabilities: type.capabilities
      }));
      
      // Use OpenAI to recommend the best agent type
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that recommends the most appropriate specialized agent type for a project.
            Your task is to analyze the project details and match it with the best agent type based on domain, goals, and interests.`
          },
          {
            role: "user",
            content: `Recommend the most appropriate agent type for this project:
            
            Project name: ${project.name}
            Project description: ${project.description}
            Project domain: ${project.domain}
            Project goals: ${project.goals.join(', ')}
            Project interests: ${project.interests.join(', ')}
            
            Available agent types:
            ${JSON.stringify(agentTypeInfo, null, 2)}
            
            Return your recommendation as JSON: {"agentTypeId": "id of recommended agent type", "reasoning": "explanation of why this agent type is the best match"}`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const recommendationText = completion.choices[0].message.content;
      let recommendation;
      
      try {
        recommendation = JSON.parse(recommendationText);
      } catch (parseError) {
        console.error('Error parsing agent type recommendation:', parseError);
        console.error('Raw content:', recommendationText);
        // Default to the first agent type if parsing fails
        return agentTypes[0];
      }
      
      // Find the recommended agent type
      const recommendedAgentType = agentTypes.find(type => 
        type._id.toString() === recommendation.agentTypeId
      );
      
      // If found, return it; otherwise return the first agent type
      return recommendedAgentType || agentTypes[0];
    } catch (error) {
      console.error('Error recommending agent type:', error);
      // Default to the first agent type if recommendation fails
      return agentTypes[0];
    }
  },
  
  /**
   * Create or update a specialized assistant for a project
   */
  createSpecializedAssistant: async (project) => {
    try {
      // Get the agent type for the project
      const agentType = await specializedAgentService.getAgentTypeForProject(project._id);
      
      // If no agent type found, use the default assistant creation
      if (!agentType) {
        return assistantsService.createOrUpdateAssistant(project);
      }
      
      console.log(`Creating specialized assistant for project ${project._id} with agent type ${agentType.name}`);
      
      // Check if the project already has an assistant
      if (project.assistantId) {
        // Update existing assistant with specialized instructions
        console.log(`Updating specialized assistant ${project.assistantId}`);
        
        const assistant = await openai.beta.assistants.update(
          project.assistantId,
          {
            name: `${project.name} ${agentType.name} Assistant`,
            instructions: specializedAgentService.generateSpecializedInstructions(project, agentType),
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
        // Create new specialized assistant
        console.log(`Creating new specialized assistant for project ${project._id}`);
        
        const assistant = await openai.beta.assistants.create({
          name: `${project.name} ${agentType.name} Assistant`,
          instructions: specializedAgentService.generateSpecializedInstructions(project, agentType),
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
        
        // Update project with assistant ID and agent type
        await Project.findByIdAndUpdate(project._id, { 
          assistantId: assistant.id,
          agentType: agentType._id
        });
        
        return assistant;
      }
    } catch (error) {
      console.error('Error creating specialized assistant:', error);
      // Fall back to regular assistant creation
      return assistantsService.createOrUpdateAssistant(project);
    }
  },
  
  /**
   * Generate specialized instructions based on agent type
   */
  generateSpecializedInstructions: (project, agentType) => {
    // Start with the agent type's prompt template
    let instructions = agentType.promptTemplate;
    
    // Replace placeholders with project-specific information
    instructions = instructions
      .replace(/\{project_name\}/g, project.name)
      .replace(/\{project_description\}/g, project.description)
      .replace(/\{project_domain\}/g, project.domain)
      .replace(/\{project_goals\}/g, project.goals.join(', '))
      .replace(/\{project_interests\}/g, project.interests.join(', '));
    
    // Add standard instructions for all specialized agents
    instructions += `\n\nIMPORTANT: When using search functions, DO NOT include any dates, years, or time references in your search queries.
    DO NOT use terms like "recent", "latest", "new", etc. in your search queries.
    Focus on the core topics and technologies without time references.
    
    Provide concise summaries and explain why each finding is relevant to the project.
    
    Use the evaluation criteria for this agent type to assess the relevance of your findings:
    ${agentType.evaluationCriteria.join('\n')}`;
    
    return instructions;
  },
  
  /**
   * Perform a specialized search for a project
   */
  performSpecializedSearch: async (project, query) => {
    try {
      // Get the agent type for the project
      const agentType = await specializedAgentService.getAgentTypeForProject(project._id);
      
      // Create or update the specialized assistant
      const assistant = await specializedAgentService.createSpecializedAssistant(project);
      
      // Create a thread
      const thread = await assistantsService.createThread();
      
      // Add the search query as a message with specialized context
      let searchPrompt = `Search for information about ${project.domain} related to: ${query}.`;
      
      // Add specialized search instructions based on agent type
      if (agentType) {
        searchPrompt += `\n\nAs a ${agentType.name} specialized agent, focus on ${agentType.domain} aspects.`;
        
        // Add search strategy based on agent type
        switch (agentType.searchStrategy) {
          case 'technical':
            searchPrompt += `\nFocus on technical details, implementation approaches, and code examples.`;
            break;
          case 'creative':
            searchPrompt += `\nFocus on creative applications, design patterns, and innovative approaches.`;
            break;
          case 'academic':
            searchPrompt += `\nFocus on research papers, academic findings, and theoretical foundations.`;
            break;
          case 'focused':
            searchPrompt += `\nFocus on specific tools, frameworks, and practical applications.`;
            break;
          default:
            searchPrompt += `\nProvide a broad overview of relevant information.`;
        }
      }
      
      searchPrompt += `\n\nUse your search_web function to find relevant information.
      
      IMPORTANT: When using the search_web function, DO NOT include any dates, years, or time references in your search queries.`;
      
      await assistantsService.addMessageToThread(thread.id, searchPrompt);
      
      // Run the assistant
      const run = await assistantsService.runAssistant(thread.id, assistant.id);
      
      // Wait for the run to complete
      await assistantsService.waitForRunCompletion(thread.id, run.id);
      
      // Get the messages from the thread
      const messages = await assistantsService.getThreadMessages(thread.id);
      
      // Process the assistant's response
      const assistantMessages = messages.filter(msg => msg.role === 'assistant');
      if (assistantMessages.length === 0) {
        throw new Error('No response from assistant');
      }
      
      // Get the most recent assistant message
      const latestMessage = assistantMessages[0];
      
      // Extract information from the message
      const messageContent = latestMessage.content[0].text.value;
      
      // Use OpenAI to extract structured results from the message
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that extracts structured information from search results.
            Your task is to identify distinct discoveries or findings from the search results and format them as structured data.`
          },
          {
            role: "user",
            content: `Extract structured information from these search results:
            
            ${messageContent}
            
            For each distinct discovery or finding, extract:
            1. A clear title
            2. A concise description
            3. The source URL (if available)
            4. The type of content (Article, Tool, Research, etc.)
            5. Relevance to the project (on a scale of 1-10)
            
            Return the results as a JSON array: [{"title": "...", "description": "...", "source": "...", "type": "...", "relevanceScore": 8}]`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const extractedText = completion.choices[0].message.content;
      let extractedResults;
      
      try {
        // Try to parse the JSON response
        const parsed = JSON.parse(extractedText);
        extractedResults = Array.isArray(parsed) ? parsed : (parsed.results || []);
      } catch (parseError) {
        console.error('Error parsing extracted results:', parseError);
        console.error('Raw content:', extractedText);
        // Return empty results if parsing fails
        return [];
      }
      
      // Format the results
      const formattedResults = extractedResults.map(result => ({
        title: result.title || 'Untitled Discovery',
        description: result.description || 'No description available',
        source: result.source || 'Unknown source',
        type: result.type || 'Article',
        relevanceScore: result.relevanceScore || 5
      }));
      
      return formattedResults;
    } catch (error) {
      console.error('Error performing specialized search:', error);
      throw new Error('Failed to perform specialized search');
    }
  }
};

module.exports = specializedAgentService;