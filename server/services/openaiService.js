const { OpenAI } = require('openai');
const apiConfig = require('../config/apiConfig');

const openai = new OpenAI({
  apiKey: apiConfig.openai.apiKey
});

const openaiService = {
  createProjectAgent: async (projectData) => {
    try {
      const agent = await openai.beta.assistants.create({
        name: `${projectData.name} Assistant`,
        description: `Agent to monitor advancements in ${projectData.domain} based on project goals and interests.`,
        model: "gpt-4-turbo",
        instructions: `You are an agent that monitors advancements in ${projectData.domain}. 
        The project goals are: ${projectData.goals.join(', ')}. 
        Areas of interest include: ${projectData.interests.join(', ')}.
        Your job is to find relevant tools, techniques, and resources that align with these goals and interests.
        Provide concise summaries and explain why each finding is relevant to the project.`,
        tools: [
          {
            type: "function",
            function: {
              name: "search_web",
              description: "Search the web for information",
              parameters: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "The search query"
                  }
                },
                required: ["query"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "store_discovery",
              description: "Store a relevant discovery in the database",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  source: { type: "string" },
                  relevanceScore: { type: "number" },
                  categories: { type: "array", items: { type: "string" } }
                },
                required: ["title", "description", "source", "relevanceScore"]
              }
            }
          }
        ]
      });
      
      return agent;
    } catch (error) {
      console.error('OpenAI agent creation error:', error);
      throw new Error('Failed to create agent');
    }
  },

  updateProjectAgent: async (agentId, projectData) => {
    try {
      const agent = await openai.beta.assistants.update(
        agentId,
        {
          name: `${projectData.name} Assistant`,
          description: `Agent to monitor advancements in ${projectData.domain} based on project goals and interests.`,
          instructions: `You are an agent that monitors advancements in ${projectData.domain}. 
          The project goals are: ${projectData.goals.join(', ')}. 
          Areas of interest include: ${projectData.interests.join(', ')}.
          Your job is to find relevant tools, techniques, and resources that align with these goals and interests.
          Provide concise summaries and explain why each finding is relevant to the project.`
        }
      );
      
      return agent;
    } catch (error) {
      console.error('OpenAI agent update error:', error);
      throw new Error('Failed to update agent');
    }
  },

  deleteProjectAgent: async (agentId) => {
    try {
      await openai.beta.assistants.del(agentId);
      return true;
    } catch (error) {
      console.error('OpenAI agent deletion error:', error);
      throw new Error('Failed to delete agent');
    }
  },

  createThread: async () => {
    try {
      const thread = await openai.beta.threads.create();
      return thread;
    } catch (error) {
      console.error('OpenAI thread creation error:', error);
      throw new Error('Failed to create thread');
    }
  },

  addMessageToThread: async (threadId, content) => {
    try {
      const message = await openai.beta.threads.messages.create(
        threadId,
        {
          role: "user",
          content
        }
      );
      return message;
    } catch (error) {
      console.error('OpenAI message creation error:', error);
      throw new Error('Failed to add message to thread');
    }
  },

  runAssistant: async (threadId, assistantId) => {
    try {
      const run = await openai.beta.threads.runs.create(
        threadId,
        {
          assistant_id: assistantId
        }
      );
      return run;
    } catch (error) {
      console.error('OpenAI run creation error:', error);
      throw new Error('Failed to run assistant');
    }
  },

  getRunStatus: async (threadId, runId) => {
    try {
      const run = await openai.beta.threads.runs.retrieve(
        threadId,
        runId
      );
      return run;
    } catch (error) {
      console.error('OpenAI run status error:', error);
      throw new Error('Failed to get run status');
    }
  },

  getThreadMessages: async (threadId) => {
    try {
      const messages = await openai.beta.threads.messages.list(
        threadId
      );
      return messages.data;
    } catch (error) {
      console.error('OpenAI messages retrieval error:', error);
      throw new Error('Failed to get thread messages');
    }
  },

  generateSearchQueries: async (projectId, project) => {
    try {
      console.log(`Generating search queries for project: ${project.name}`);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that generates search queries to find information in ${project.domain} related to specific project goals and interests. NEVER include any dates, years, or time references in your queries.`
          },
          {
            role: "user",
            content: `Generate 5 search queries to find information about ${project.domain} related to the project goals: ${project.goals.join(', ')} and interests: ${project.interests.join(', ')}.
            
            CRITICAL REQUIREMENTS:
            1. DO NOT include ANY dates, years, or time references (like "2023", "2024", etc.)
            2. DO NOT use words like "recent", "latest", "new", "current", etc.
            3. Focus ONLY on the core topics and technologies
            4. Keep queries simple and focused on specific concepts
            5. Make each query distinct to cover different aspects of the project
            
            Example of good queries:
            - "AI animation tools for filmmaking"
            - "Visual effects pipeline optimization techniques"
            - "Machine learning in character animation"
            
            Example of BAD queries (DO NOT use):
            - "Latest AI animation tools 2023" (contains date)
            - "Recent advancements in visual effects" (contains time reference)
            - "New AI research in animation" (contains time reference)`
          }
        ]
      });

      const content = completion.choices[0].message.content;
      const queries = content.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^\d+\.\s*/, '').trim());
      
      // Additional cleaning to remove ANY date or time references
      const cleanedQueries = queries.map(query => {
        // Remove years (2020-2029)
        let cleaned = query.replace(/\b20(2\d|1\d)\b/g, '');
        
        // Remove time reference words
        cleaned = cleaned.replace(/\b(recent|latest|new|current|today|upcoming|modern|emerging|this year)\b/gi, '');
        
        // Remove "in the past X" phrases
        cleaned = cleaned.replace(/\bin the past\s+\w+\b/gi, '');
        
        // Clean up any double spaces and trim
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        
        return cleaned;
      });
      
      console.log('Generated search queries:', cleanedQueries);
      
      return cleanedQueries;
    } catch (error) {
      console.error('Query generation error:', error);
      throw new Error('Failed to generate search queries');
    }
  },

  /**
   * Process newsletter content to extract discoveries
   * @param {string} content - The newsletter content
   * @param {Object} context - Context information about the project
   * @returns {Promise<Object>} - Processed discoveries
   */
  processNewsletterContent: async (content, context) => {
    try {
      console.log('Processing newsletter content with OpenAI');
      
      // Truncate content if it's too long
      const truncatedContent = content.length > 15000 
        ? content.substring(0, 15000) + '...(content truncated)'
        : content;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that analyzes newsletter content to extract relevant information for a project. 
            The project is about ${context.projectDomain} with a focus on ${context.projectGoals.join(', ')} and interests in ${context.projectInterests.join(', ')}.
            
            Your task is to identify distinct pieces of information in the newsletter that are relevant to the project and format them as structured discoveries.`
          },
          {
            role: "user",
            content: `Analyze the following newsletter content from "${context.newsletterName}" with subject "${context.newsletterSubject}" and extract relevant information for my project.
            
            Project details:
            - Name: ${context.projectName}
            - Description: ${context.projectDescription}
            - Domain: ${context.projectDomain}
            - Goals: ${context.projectGoals.join(', ')}
            - Interests: ${context.projectInterests.join(', ')}
            
            Newsletter content:
            ${truncatedContent}
            
            For each relevant piece of information, create a structured discovery with:
            1. Title: A concise, descriptive title
            2. Description: A summary of the information and why it's relevant to the project
            3. Source: The original source if mentioned, otherwise use the newsletter name
            4. Relevance Score: A number from 1-10 indicating how relevant this is to the project
            5. Categories: 2-5 categories that this information falls under
            6. Type: One of [Article, Discussion, News, Research, Tool, Other]
            
            Format your response as a JSON object with an array of discoveries. Only include information that is actually relevant to the project.
            
            Example format:
            {
              "discoveries": [
                {
                  "title": "New AI-Powered Animation Tool Released",
                  "description": "Studio XYZ has released a new tool that uses machine learning to automate character animation. This is relevant because it aligns with the project's interest in AI for animation pipelines.",
                  "source": "https://example.com/tool-announcement",
                  "relevanceScore": 8,
                  "categories": ["AI", "Animation", "Tools", "Character Animation"],
                  "type": "Tool"
                }
              ]
            }`
          }
        ],
        response_format: { type: "json_object" }
      });

      const responseContent = completion.choices[0].message.content;
      
      try {
        const parsedResponse = JSON.parse(responseContent);
        console.log(`Extracted ${parsedResponse.discoveries?.length || 0} discoveries from newsletter`);
        return parsedResponse;
      } catch (parseError) {
        console.error('Error parsing OpenAI JSON response:', parseError);
        console.log('Raw response:', responseContent);
        return { discoveries: [] };
      }
    } catch (error) {
      console.error('Newsletter processing error:', error);
      throw new Error('Failed to process newsletter content');
    }
  }
};

module.exports = openaiService;