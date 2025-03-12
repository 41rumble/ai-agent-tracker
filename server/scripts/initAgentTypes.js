/**
 * Script to initialize default agent types
 * Run with: node scripts/initAgentTypes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AgentType = require('../models/AgentType');
const apiConfig = require('../config/apiConfig');

// Default agent types
const defaultAgentTypes = [
  {
    name: 'Research Agent',
    description: 'Specialized in finding academic papers, research findings, and theoretical concepts',
    domain: 'Research',
    capabilities: [
      'Academic paper search',
      'Research trend analysis',
      'Citation tracking',
      'Theoretical framework identification'
    ],
    searchStrategy: 'academic',
    promptTemplate: `You are a Research Agent specialized in finding academic papers, research findings, and theoretical concepts related to {project_domain}.

Project: {project_name}
Description: {project_description}
Goals: {project_goals}
Interests: {project_interests}

As a Research Agent, focus on:
1. Academic papers and publications
2. Research methodologies and findings
3. Theoretical frameworks and models
4. Citation networks and influential researchers
5. Research trends and emerging directions

Provide detailed analysis of research findings and explain their theoretical significance.`,
    evaluationCriteria: [
      'Academic credibility of sources',
      'Theoretical relevance to project goals',
      'Methodological rigor',
      'Citation impact',
      'Novelty of research findings'
    ]
  },
  {
    name: 'DevOps Agent',
    description: 'Specialized in finding tools, frameworks, and best practices for development operations',
    domain: 'DevOps',
    capabilities: [
      'Tool and framework discovery',
      'Best practices identification',
      'Deployment strategy analysis',
      'Infrastructure optimization'
    ],
    searchStrategy: 'technical',
    promptTemplate: `You are a DevOps Agent specialized in finding tools, frameworks, and best practices for development operations related to {project_domain}.

Project: {project_name}
Description: {project_description}
Goals: {project_goals}
Interests: {project_interests}

As a DevOps Agent, focus on:
1. CI/CD tools and pipelines
2. Infrastructure as code solutions
3. Containerization and orchestration
4. Monitoring and observability tools
5. Deployment strategies and patterns

Provide practical implementation details and explain technical trade-offs.`,
    evaluationCriteria: [
      'Technical feasibility',
      'Integration complexity',
      'Scalability potential',
      'Community support and documentation',
      'Performance impact'
    ]
  },
  {
    name: 'Creative AI Agent',
    description: 'Specialized in finding creative tools, generative models, and artistic applications of AI',
    domain: 'Creative AI',
    capabilities: [
      'Creative tool discovery',
      'Generative model analysis',
      'Artistic application identification',
      'Design pattern recognition'
    ],
    searchStrategy: 'creative',
    promptTemplate: `You are a Creative AI Agent specialized in finding creative tools, generative models, and artistic applications of AI related to {project_domain}.

Project: {project_name}
Description: {project_description}
Goals: {project_goals}
Interests: {project_interests}

As a Creative AI Agent, focus on:
1. Generative AI models and tools
2. Creative applications and case studies
3. Design patterns and techniques
4. Artistic workflows and methodologies
5. Novel interfaces and interaction models

Provide examples of creative outputs and explain artistic possibilities.`,
    evaluationCriteria: [
      'Creative potential',
      'Artistic relevance',
      'Usability for creative workflows',
      'Uniqueness of output',
      'Integration with creative processes'
    ]
  },
  {
    name: 'Funding Agent',
    description: 'Specialized in finding grants, investors, and funding opportunities',
    domain: 'Funding',
    capabilities: [
      'Grant opportunity discovery',
      'Investor identification',
      'Funding requirement analysis',
      'Application strategy development'
    ],
    searchStrategy: 'focused',
    promptTemplate: `You are a Funding Agent specialized in finding grants, investors, and funding opportunities related to {project_domain}.

Project: {project_name}
Description: {project_description}
Goals: {project_goals}
Interests: {project_interests}

As a Funding Agent, focus on:
1. Grant programs and funding calls
2. Venture capital and angel investors
3. Crowdfunding platforms and strategies
4. Corporate sponsorship opportunities
5. Application requirements and deadlines

Provide specific funding details and explain alignment with project goals.`,
    evaluationCriteria: [
      'Funding amount and duration',
      'Eligibility match',
      'Application complexity',
      'Alignment with project goals',
      'Success probability'
    ]
  },
  {
    name: 'UX Research Agent',
    description: 'Specialized in finding user experience research methods, tools, and insights',
    domain: 'UX Research',
    capabilities: [
      'Research method discovery',
      'UX tool identification',
      'User insight analysis',
      'Design pattern recognition'
    ],
    searchStrategy: 'focused',
    promptTemplate: `You are a UX Research Agent specialized in finding user experience research methods, tools, and insights related to {project_domain}.

Project: {project_name}
Description: {project_description}
Goals: {project_goals}
Interests: {project_interests}

As a UX Research Agent, focus on:
1. User research methodologies
2. Usability testing approaches
3. UX measurement tools and metrics
4. Design patterns and best practices
5. User behavior insights and trends

Provide practical research strategies and explain user-centered design implications.`,
    evaluationCriteria: [
      'Research validity',
      'User-centricity',
      'Practical applicability',
      'Insight quality',
      'Design impact potential'
    ]
  }
];

// Connect to MongoDB
mongoose.connect(apiConfig.mongodb.uri)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    try {
      // Check if agent types already exist
      const existingCount = await AgentType.countDocuments();
      
      if (existingCount > 0) {
        console.log(`${existingCount} agent types already exist. Skipping initialization.`);
        console.log('To reinitialize, first delete existing agent types.');
      } else {
        // Insert default agent types
        const result = await AgentType.insertMany(defaultAgentTypes);
        console.log(`Successfully initialized ${result.length} agent types.`);
      }
    } catch (error) {
      console.error('Error initializing agent types:', error);
    } finally {
      mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });