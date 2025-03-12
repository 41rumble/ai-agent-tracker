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
      // Get current date and calculate relative dates for the past 3 months
      const now = new Date();
      const currentMonth = now.toLocaleString('default', { month: 'long' });
      const currentYear = now.getFullYear();
      
      // Calculate previous months
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(now.getMonth() - 1);
      const oneMonthAgoName = oneMonthAgo.toLocaleString('default', { month: 'long' });
      const oneMonthAgoYear = oneMonthAgo.getFullYear();
      
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(now.getMonth() - 2);
      const twoMonthsAgoName = twoMonthsAgo.toLocaleString('default', { month: 'long' });
      const twoMonthsAgoYear = twoMonthsAgo.getFullYear();
      
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      const threeMonthsAgoName = threeMonthsAgo.toLocaleString('default', { month: 'long' });
      const threeMonthsAgoYear = threeMonthsAgo.getFullYear();
      
      // Create a date range string for the prompt
      const dateRangeText = `${threeMonthsAgoName} ${threeMonthsAgoYear} to ${currentMonth} ${currentYear}`;
      
      console.log(`Generating search queries for date range: ${dateRangeText}`);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that generates search queries to find the latest advancements in ${project.domain} related to specific project goals and interests. 
            Focus on recent content from the past 3 months (${dateRangeText}).`
          },
          {
            role: "user",
            content: `Generate 5 search queries to find the MOST RECENT advancements in ${project.domain} related to the project goals: ${project.goals.join(', ')} and interests: ${project.interests.join(', ')}.
            
            IMPORTANT: Use THESE EXACT time references in your queries:
            - Current month: "${currentMonth} ${currentYear}"
            - Last month: "${oneMonthAgoName} ${oneMonthAgoYear}"
            - Two months ago: "${twoMonthsAgoName} ${twoMonthsAgoYear}"
            - Three months ago: "${threeMonthsAgoName} ${threeMonthsAgoYear}"
            - Or use general terms like "past 3 months", "recent", "latest", etc.
            
            DO NOT use specific months from previous years. Only use the months and years provided above.
            Format each query to specifically target content from the past 3 months.`
          }
        ]
      });

      const content = completion.choices[0].message.content;
      const queries = content.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^\d+\.\s*/, '').trim());
      
      // Add time constraints to queries that don't already have them
      const timeConstrainedQueries = queries.map(query => {
        // Check if query already has a time constraint
        const hasTimeConstraint = new RegExp(
          `recent|latest|new|${currentYear}|${oneMonthAgoYear}|${currentMonth}|${oneMonthAgoName}|${twoMonthsAgoName}|this month|last month|past \\d+ (days|weeks|months)`,
          'i'
        ).test(query);
        
        if (!hasTimeConstraint) {
          return `${query} (past 3 months)`;
        }
        return query;
      });
      
      console.log('Generated time-constrained queries:', timeConstrainedQueries);
      
      return timeConstrainedQueries;
    } catch (error) {
      console.error('Query generation error:', error);
      throw new Error('Failed to generate search queries');
    }
  }
};

module.exports = openaiService;