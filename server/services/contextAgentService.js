const { OpenAI } = require('openai');
const apiConfig = require('../config/apiConfig');
const ProjectContext = require('../models/ProjectContext');
const Project = require('../models/Project');
const Discovery = require('../models/Discovery');

const openai = new OpenAI({
  apiKey: apiConfig.openai.apiKey
});

const contextAgentService = {
  /**
   * Initialize or retrieve project context
   */
  getProjectContext: async (projectId) => {
    try {
      // Check if context exists for this project
      let context = await ProjectContext.findOne({ projectId });
      
      // If not, create a new context
      if (!context) {
        const project = await Project.findById(projectId);
        if (!project) {
          throw new Error(`Project not found with ID: ${projectId}`);
        }
        
        context = new ProjectContext({
          projectId,
          currentPhase: 'initial',
          progressPercentage: 0,
          contextEntries: [{
            type: 'agent_question',
            content: 'What is your current progress on this project?'
          }]
        });
        
        await context.save();
      }
      
      return context;
    } catch (error) {
      console.error('Error getting project context:', error);
      throw new Error('Failed to get project context');
    }
  },
  
  /**
   * Add a user update to the project context
   */
  addUserUpdate: async (projectId, content, metadata = {}) => {
    try {
      const context = await contextAgentService.getProjectContext(projectId);
      
      context.contextEntries.push({
        type: 'user_update',
        content,
        metadata,
        timestamp: new Date()
      });
      
      context.lastUpdated = new Date();
      await context.save();
      
      // Generate a follow-up question based on the update
      const followUpQuestion = await contextAgentService.generateFollowUpQuestion(context);
      
      return { context, followUpQuestion };
    } catch (error) {
      console.error('Error adding user update:', error);
      throw new Error('Failed to add user update');
    }
  },
  
  /**
   * Add a user response to an agent question
   */
  addUserResponse: async (projectId, questionId, response, metadata = {}) => {
    try {
      const context = await contextAgentService.getProjectContext(projectId);
      
      // Find the question in context entries
      const questionEntry = context.contextEntries.find(entry => 
        entry.type === 'agent_question' && entry._id.toString() === questionId
      );
      
      if (!questionEntry) {
        throw new Error('Question not found in context');
      }
      
      // Add the response
      context.contextEntries.push({
        type: 'user_response',
        content: response,
        metadata: {
          ...metadata,
          questionId,
          questionContent: questionEntry.content
        },
        timestamp: new Date()
      });
      
      // Update project phase and progress based on response
      const updatedContext = await contextAgentService.updateProjectProgress(context, response);
      
      // Generate a follow-up question
      const followUpQuestion = await contextAgentService.generateFollowUpQuestion(updatedContext);
      
      return { context: updatedContext, followUpQuestion };
    } catch (error) {
      console.error('Error adding user response:', error);
      throw new Error('Failed to add user response');
    }
  },
  
  /**
   * Update project progress based on user responses
   */
  updateProjectProgress: async (context, latestResponse) => {
    try {
      // Use OpenAI to analyze the response and determine project progress
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that analyzes project progress based on user responses. 
            Your task is to determine the current phase of the project and estimate a progress percentage (0-100).`
          },
          {
            role: "user",
            content: `Based on the following user response, determine the current project phase and progress percentage.
            
            Project context: ${context.contextEntries.map(entry => `${entry.type}: ${entry.content}`).join('\n')}
            
            Latest response: ${latestResponse}
            
            Current phase: ${context.currentPhase}
            Current progress: ${context.progressPercentage}%
            
            Return your analysis as JSON: {"phase": "string", "progressPercentage": number, "reasoning": "string"}`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const analysisText = completion.choices[0].message.content;
      let analysis;
      
      try {
        analysis = JSON.parse(analysisText);
      } catch (parseError) {
        console.error('Error parsing progress analysis:', parseError);
        console.error('Raw content:', analysisText);
        throw new Error('Failed to parse progress analysis');
      }
      
      // Update context with new phase and progress
      context.currentPhase = analysis.phase;
      context.progressPercentage = analysis.progressPercentage;
      
      // Add a milestone entry if significant progress was made
      if (Math.abs(analysis.progressPercentage - context.progressPercentage) >= 10) {
        context.contextEntries.push({
          type: 'milestone',
          content: `Project reached ${analysis.progressPercentage}% completion in the ${analysis.phase} phase.`,
          metadata: {
            phase: analysis.phase,
            progressPercentage: analysis.progressPercentage,
            reasoning: analysis.reasoning
          },
          timestamp: new Date()
        });
      }
      
      context.lastUpdated = new Date();
      await context.save();
      
      // Also update the main project
      const project = await Project.findById(context.projectId);
      if (project) {
        project.currentState.progress = analysis.progressPercentage >= 100 ? 'Completed' : 
                                        analysis.progressPercentage > 0 ? 'In Progress' : 'Not Started';
        project.currentState.lastUpdated = new Date();
        
        // Add as a milestone if it doesn't exist
        const milestoneExists = project.currentState.milestones.some(
          m => m.description.includes(analysis.phase)
        );
        
        if (!milestoneExists) {
          project.currentState.milestones.push({
            description: `Entered ${analysis.phase} phase`,
            achieved: true,
            date: new Date()
          });
        }
        
        await project.save();
      }
      
      return context;
    } catch (error) {
      console.error('Error updating project progress:', error);
      throw new Error('Failed to update project progress');
    }
  },
  
  /**
   * Generate a follow-up question based on context
   */
  generateFollowUpQuestion: async (context) => {
    try {
      // Get recent discoveries for this project
      const recentDiscoveries = await Discovery.find({ 
        projectId: context.projectId,
        presented: true
      }).sort({ discoveredAt: -1 }).limit(5);
      
      // Use OpenAI to generate a relevant follow-up question
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that helps users track their progress on projects.
            Your task is to generate a relevant follow-up question based on the project context and recent discoveries.
            The question should help understand where the user is in their project journey and what they need next.`
          },
          {
            role: "user",
            content: `Generate a follow-up question based on this project context:
            
            Project phase: ${context.currentPhase}
            Progress: ${context.progressPercentage}%
            
            Recent context:
            ${context.contextEntries.slice(-5).map(entry => `${entry.type}: ${entry.content}`).join('\n')}
            
            Recent discoveries:
            ${recentDiscoveries.map(d => `- ${d.title}: ${d.description.substring(0, 100)}...`).join('\n')}
            
            The question should be specific, helpful, and focused on understanding the user's current needs or progress.`
          }
        ]
      });
      
      const question = completion.choices[0].message.content;
      
      // Add the question to context
      context.contextEntries.push({
        type: 'agent_question',
        content: question,
        timestamp: new Date()
      });
      
      await context.save();
      
      return {
        questionId: context.contextEntries[context.contextEntries.length - 1]._id,
        question
      };
    } catch (error) {
      console.error('Error generating follow-up question:', error);
      return {
        questionId: null,
        question: 'What is your current progress on this project?'
      };
    }
  },
  
  /**
   * Generate search queries based on project context
   */
  generateContextualSearchQueries: async (projectId) => {
    try {
      const context = await contextAgentService.getProjectContext(projectId);
      const project = await Project.findById(projectId);
      
      if (!project) {
        throw new Error(`Project not found with ID: ${projectId}`);
      }
      
      // Get user feedback on discoveries
      const userFeedback = await Discovery.find({
        projectId,
        'userFeedback.useful': true
      }).limit(5);
      
      // Use OpenAI to generate contextual search queries
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that generates search queries based on a project's context and user feedback.
            Your task is to create targeted search queries that will find information relevant to the user's current project phase and needs.`
          },
          {
            role: "user",
            content: `Generate 5 search queries for a project with the following details:
            
            Project domain: ${project.domain}
            Project goals: ${project.goals.join(', ')}
            Project interests: ${project.interests.join(', ')}
            
            Current phase: ${context.currentPhase}
            Progress: ${context.progressPercentage}%
            
            Recent context:
            ${context.contextEntries.slice(-5).map(entry => `${entry.type}: ${entry.content}`).join('\n')}
            
            User liked these discoveries:
            ${userFeedback.map(d => `- ${d.title}`).join('\n')}
            
            Return the queries as a JSON array: ["query1", "query2", ...]`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const queriesText = completion.choices[0].message.content;
      let queries;
      
      try {
        queries = JSON.parse(queriesText).queries || [];
      } catch (parseError) {
        console.error('Error parsing search queries:', parseError);
        console.error('Raw content:', queriesText);
        // Fallback to simple extraction
        queries = queriesText.match(/"([^"]+)"/g)?.map(q => q.replace(/"/g, '')) || [];
      }
      
      return queries;
    } catch (error) {
      console.error('Error generating contextual search queries:', error);
      throw new Error('Failed to generate contextual search queries');
    }
  }
};

module.exports = contextAgentService;