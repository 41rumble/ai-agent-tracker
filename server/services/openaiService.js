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
            content: `You are an AI assistant that generates search queries to find the latest advancements in ${project.domain} related to specific project goals and interests.`
          },
          {
            role: "user",
            content: `Generate 5 search queries to find relevant information about ${project.domain} related to the project goals: ${project.goals.join(', ')} and interests: ${project.interests.join(', ')}.
            
            IMPORTANT GUIDELINES:
            1. Keep queries simple and focused on the core topics
            2. Use terms like "recent" or "latest" to encourage newer results
            3. Focus on the specific technologies and concepts relevant to the project
            4. Make each query distinct to cover different aspects of the project
            5. Avoid overly complex queries with too many terms`
          }
        ]
      });

      const content = completion.choices[0].message.content;
      const queries = content.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^\d+\.\s*/, '').trim());
      
      console.log('Generated search queries:', queries);
      
      return queries;
    } catch (error) {
      console.error('Query generation error:', error);
      throw new Error('Failed to generate search queries');
    }
  }
};

module.exports = openaiService;