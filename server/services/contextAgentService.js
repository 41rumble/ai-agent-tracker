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
      
      console.log(`Adding user response for project ${projectId}, questionId: ${questionId}`);
      console.log(`Context entries: ${context.contextEntries.length}`);
      
      // Find the question in context entries
      let questionEntry = null;
      let questionContent = '';
      
      // Try to find the question by ID
      if (questionId) {
        questionEntry = context.contextEntries.find(entry => 
          entry.type === 'agent_question' && entry._id.toString() === questionId
        );
        
        if (questionEntry) {
          questionContent = questionEntry.content;
          console.log(`Found question by ID: ${questionContent}`);
        } else {
          console.log(`Question with ID ${questionId} not found, looking for most recent question`);
          
          // If not found by ID, get the most recent question
          const questions = context.contextEntries.filter(entry => entry.type === 'agent_question');
          if (questions.length > 0) {
            questionEntry = questions[questions.length - 1];
            questionContent = questionEntry.content;
            questionId = questionEntry._id.toString();
            console.log(`Using most recent question instead: ${questionContent}`);
          } else {
            console.log('No questions found in context, treating as general update');
          }
        }
      }
      
      // Add the response
      context.contextEntries.push({
        type: 'user_response',
        content: response,
        metadata: {
          ...metadata,
          questionId: questionId || 'general',
          questionContent: questionContent || 'General response'
        },
        timestamp: new Date()
      });
      
      console.log(`Added user response: ${response}`);
      
      // Update project phase and progress based on response
      const updatedContext = await contextAgentService.updateProjectProgress(context, response);
      
      // Generate a follow-up question
      const followUpQuestion = await contextAgentService.generateFollowUpQuestion(updatedContext);
      
      return { context: updatedContext, followUpQuestion };
    } catch (error) {
      console.error('Error adding user response:', error);
      console.error('Error stack:', error.stack);
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
      console.log(`Generating follow-up question for project ${context.projectId}`);
      
      // Get project details
      const project = await Project.findById(context.projectId);
      if (!project) {
        throw new Error(`Project not found with ID: ${context.projectId}`);
      }
      
      // Get recent discoveries for this project
      const recentDiscoveries = await Discovery.find({ 
        projectId: context.projectId
      }).sort({ discoveredAt: -1 }).limit(5);
      
      console.log(`Found ${recentDiscoveries.length} recent discoveries`);
      
      // Get user feedback on discoveries
      const userFeedback = await Discovery.find({
        projectId: context.projectId,
        'userFeedback.useful': true
      }).limit(3);
      
      // Check if we've asked a question recently (within the last 24 hours)
      const lastDayEntries = context.contextEntries.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        return entry.type === 'agent_question' && entryDate > oneDayAgo;
      });
      
      // Get the most recent user response, if any
      const recentUserResponses = context.contextEntries.filter(entry => 
        entry.type === 'user_response'
      ).slice(-3);
      
      // Use OpenAI to generate a relevant follow-up question
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that helps users track their progress on projects in ${project.domain}.
            Your task is to generate a relevant, insightful follow-up question based on the project context, recent discoveries, and user feedback.
            The question should help understand where the user is in their project journey and what they need next.
            
            Guidelines for generating questions:
            1. If the user has recently responded to questions, build on those responses
            2. If there are new discoveries, ask about their relevance or usefulness
            3. If the user has marked certain discoveries as useful, ask about implementation or application
            4. If the project is in early phases, focus on planning and requirements
            5. If the project is in middle phases, focus on progress and challenges
            6. If the project is in late phases, focus on outcomes and next steps
            7. Avoid asking the same question repeatedly
            8. Make questions specific and actionable
            9. Occasionally ask about technical challenges or implementation details
            10. Sometimes ask about project timeline and milestones`
          },
          {
            role: "user",
            content: `Generate a follow-up question based on this project context:
            
            Project name: ${project.name}
            Project domain: ${project.domain}
            Project goals: ${project.goals.join(', ')}
            Project phase: ${context.currentPhase}
            Progress: ${context.progressPercentage}%
            
            Recent context entries:
            ${context.contextEntries.slice(-5).map(entry => `${entry.type}: ${entry.content}`).join('\n')}
            
            Recent user responses:
            ${recentUserResponses.map(entry => entry.content).join('\n')}
            
            Recent discoveries:
            ${recentDiscoveries.map(d => `- ${d.title}: ${d.description.substring(0, 100)}...`).join('\n')}
            
            Discoveries marked as useful:
            ${userFeedback.map(d => `- ${d.title}`).join('\n')}
            
            Number of questions asked in the last 24 hours: ${lastDayEntries.length}
            
            The question should be specific, helpful, and focused on understanding the user's current needs or progress.
            If many questions have been asked recently, make this one particularly insightful and valuable.`
          }
        ]
      });
      
      const question = completion.choices[0].message.content;
      console.log(`Generated question: ${question}`);
      
      // Add the question to context
      context.contextEntries.push({
        type: 'agent_question',
        content: question,
        metadata: {
          projectPhase: context.currentPhase,
          progressPercentage: context.progressPercentage,
          recentDiscoveriesCount: recentDiscoveries.length,
          usefulDiscoveriesCount: userFeedback.length
        },
        timestamp: new Date()
      });
      
      await context.save();
      
      // Get the ID of the newly added question
      const newQuestionId = context.contextEntries[context.contextEntries.length - 1]._id;
      console.log(`Added question to context with ID: ${newQuestionId}`);
      
      return {
        questionId: newQuestionId.toString(),
        question
      };
    } catch (error) {
      console.error('Error generating follow-up question:', error);
      console.error('Error stack:', error.stack);
      
      // Create a default question based on the context phase if available
      try {
        let defaultQuestion = 'What is your current progress on this project?';
        
        if (context.currentPhase) {
          // Tailor the default question based on the project phase
          switch(context.currentPhase.toLowerCase()) {
            case 'initial':
            case 'planning':
              defaultQuestion = 'What are your initial goals and requirements for this project?';
              break;
            case 'development':
            case 'implementation':
              defaultQuestion = 'What challenges are you facing in the current development phase?';
              break;
            case 'testing':
              defaultQuestion = 'How is the testing process going, and what issues have you identified?';
              break;
            case 'deployment':
            case 'launch':
              defaultQuestion = 'What are your plans for deployment and launch?';
              break;
            case 'maintenance':
            case 'completed':
              defaultQuestion = 'What outcomes have you achieved, and what are your next steps?';
              break;
          }
        }
        
        console.log(`Using default question based on phase '${context.currentPhase}': ${defaultQuestion}`);
        
        // Add the default question to context
        context.contextEntries.push({
          type: 'agent_question',
          content: defaultQuestion,
          timestamp: new Date()
        });
        
        await context.save();
        
        // Get the ID of the newly added question
        const newQuestionId = context.contextEntries[context.contextEntries.length - 1]._id;
        console.log(`Added default question to context with ID: ${newQuestionId}`);
        
        return {
          questionId: newQuestionId.toString(),
          question: defaultQuestion
        };
      } catch (saveError) {
        console.error('Error saving default question:', saveError);
        return {
          questionId: null,
          question: 'What is your current progress on this project?'
        };
      }
    }
  },
  
  /**
   * Add feedback about a discovery to the project context
   */
  addFeedbackToContext: async (projectId, discoveryId, discoveryTitle, feedbackType, notes = '') => {
    try {
      const context = await contextAgentService.getProjectContext(projectId);
      
      // Add feedback entry to context
      context.contextEntries.push({
        type: 'feedback',
        content: `${feedbackType === 'positive' ? 'Positive' : 'Negative'} feedback on discovery: "${discoveryTitle}"${notes ? ` - Notes: ${notes}` : ''}`,
        metadata: {
          discoveryId,
          feedbackType,
          notes
        },
        timestamp: new Date()
      });
      
      await context.save();
      
      console.log(`Added ${feedbackType} feedback for discovery ${discoveryId} to context`);
      return context;
    } catch (error) {
      console.error('Error adding feedback to context:', error);
      throw new Error('Failed to add feedback to context');
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
      const positiveUserFeedback = await Discovery.find({
        projectId,
        'userFeedback.useful': true
      }).limit(5);
      
      // Get negative feedback as well
      const negativeUserFeedback = await Discovery.find({
        projectId,
        'userFeedback.notUseful': true
      }).limit(5);
      
      // Get recent feedback entries from context
      const recentFeedback = context.contextEntries
        .filter(entry => entry.type === 'feedback')
        .slice(-5);
      
      // Use OpenAI to generate contextual search queries
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that generates search queries based on a project's context and user feedback.
            Your task is to create targeted search queries that will find information relevant to the user's current project phase and needs.
            Focus on the core topics and technologies without any time references.
            
            Pay special attention to user feedback on previous discoveries to understand what information is most valuable to them.`
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
            
            Recent feedback:
            ${recentFeedback.map(entry => entry.content).join('\n')}
            
            User found these discoveries useful:
            ${positiveUserFeedback.map(d => `- ${d.title}`).join('\n')}
            
            User did NOT find these discoveries useful:
            ${negativeUserFeedback.map(d => `- ${d.title}`).join('\n')}
            
            CRITICAL REQUIREMENTS:
            1. DO NOT include ANY dates, years, or time references (like "2023", "2024", etc.)
            2. DO NOT use words like "recent", "latest", "new", "current", etc.
            3. Focus ONLY on the core topics and technologies
            4. Keep queries simple and focused on specific concepts
            5. Learn from the user's feedback - focus on topics similar to what they found useful
            6. Avoid topics similar to what they found not useful
            
            Return the queries as a JSON array: {"queries": ["query1", "query2", ..."]}`
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
      
      console.log('Generated contextual queries:', queries);
      
      return queries;
    } catch (error) {
      console.error('Error generating contextual search queries:', error);
      throw new Error('Failed to generate contextual search queries');
    }
  }
};

module.exports = contextAgentService;