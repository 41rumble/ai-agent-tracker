const { OpenAI } = require('openai');
const apiConfig = require('../config/apiConfig');

const openai = new OpenAI({
  apiKey: apiConfig.openai.apiKey
});

const openaiService = {
  /**
   * Evaluate the relevance of pre-extracted discoveries
   * @param {Array} discoveries - Array of discovery objects
   * @param {Object} context - Context information about the project
   * @returns {Promise<Object>} - Evaluated discoveries with relevance scores
   */
  evaluateDiscoveriesRelevance: async (discoveries, context) => {
    try {
      console.log(`Evaluating relevance of ${discoveries.length} pre-extracted discoveries`);
      
      // Create a system prompt focused on relevance evaluation
      const systemPrompt = `You are an AI assistant that evaluates the relevance of content items to a specific project.
      The project is about ${context.projectDomain} with a focus on ${context.projectGoals.join(', ')} and interests in ${context.projectInterests.join(', ')}.
      
      Your task is to evaluate each item for its relevance to the project and provide a relevance score and improved description.`;
      
      // Create a user prompt with the discoveries to evaluate
      const userPrompt = `I have a set of content items from an AI newsletter that I need you to evaluate for relevance to my project.
      
      Project details:
      - Name: ${context.projectName}
      - Description: ${context.projectDescription}
      - Domain: ${context.projectDomain}
      - Goals: ${context.projectGoals.join(', ')}
      - Interests: ${context.projectInterests.join(', ')}
      
      For each item, please:
      1. Evaluate its relevance to the project on a scale of 1-10
      2. Provide a more detailed description that explains why it's relevant
      3. Assign appropriate categories
      4. Determine the correct content type
      
      Here are the items to evaluate:
      ${JSON.stringify(discoveries, null, 2)}
      
      Return the evaluated items in the same format, but with updated relevance scores, descriptions, categories, and types.
      
      Format your response as a JSON object with an array of discoveries.
      
      Example format:
      {
        "discoveries": [
          {
            "title": "Item Title",
            "description": "Improved description explaining relevance",
            "source": "https://example.com",
            "relevanceScore": 8,
            "categories": ["AI", "Relevant Category", "Another Category"],
            "type": "Tool"
          }
        ]
      }`;
      
      // Make the API call
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5
      });
      
      const responseContent = completion.choices[0].message.content;
      
      try {
        console.log('Parsing relevance evaluation response');
        const parsedResponse = JSON.parse(responseContent);
        
        if (!parsedResponse.discoveries || !Array.isArray(parsedResponse.discoveries)) {
          console.error('Invalid evaluation response format:', parsedResponse);
          return { discoveries: discoveries }; // Return original discoveries if evaluation fails
        }
        
        console.log(`Successfully evaluated ${parsedResponse.discoveries.length} discoveries`);
        
        // Ensure we preserve the original URLs
        parsedResponse.discoveries.forEach((evaluatedDiscovery, index) => {
          if (index < discoveries.length) {
            // Always preserve the original source URL
            evaluatedDiscovery.source = discoveries[index].source;
          }
        });
        
        return parsedResponse;
      } catch (parseError) {
        console.error('Error parsing evaluation response:', parseError);
        return { discoveries: discoveries }; // Return original discoveries if parsing fails
      }
    } catch (error) {
      console.error('Discovery relevance evaluation error:', error);
      return { discoveries: discoveries }; // Return original discoveries if evaluation fails
    }
  },
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
      
      // Truncate content if it's too long, but ensure we keep the most important parts
      let truncatedContent = content;
      
      // Check if content is too long
      if (content.length > 15000) {
        console.log(`Newsletter content is too long (${content.length} chars), truncating...`);
        
        // Extract the important sections first
        const alphaSignalItemsMatch = content.match(/### ALPHA SIGNAL CONTENT ITEMS ###[\s\S]*?(?=###|$)/);
        const extractedLinksMatch = content.match(/### EXTRACTED LINKS ###[\s\S]*?(?=###|$)/);
        const extractedSectionsMatch = content.match(/### EXTRACTED SECTIONS ###[\s\S]*?(?=###|$)/);
        
        // Start with a smaller portion of the original content
        let baseContent = content.substring(0, 5000);
        
        // Add the important sections if they exist
        let importantSections = '';
        if (alphaSignalItemsMatch) {
          importantSections += alphaSignalItemsMatch[0] + "\n\n";
        }
        if (extractedLinksMatch) {
          importantSections += extractedLinksMatch[0] + "\n\n";
        }
        if (extractedSectionsMatch) {
          // Only include a portion of the extracted sections to save space
          const extractedSections = extractedSectionsMatch[0];
          importantSections += extractedSections.substring(0, Math.min(extractedSections.length, 5000)) + "\n\n";
        }
        
        // Combine the base content with important sections, ensuring we don't exceed the limit
        truncatedContent = baseContent + "\n\n" + importantSections;
        
        // Final truncation if still too long
        if (truncatedContent.length > 15000) {
          truncatedContent = truncatedContent.substring(0, 15000) + '...(content truncated)';
        }
        
        console.log(`Truncated content to ${truncatedContent.length} chars, preserving important sections`);
      }
      
      // Special handling for known newsletter sources
      let systemPrompt = `You are an AI assistant that analyzes newsletter content to extract relevant information for a project. 
      The project is about ${context.projectDomain} with a focus on ${context.projectGoals.join(', ')} and interests in ${context.projectInterests.join(', ')}.
      
      Your task is to identify distinct pieces of information in the newsletter that are relevant to the project and format them as structured discoveries.
      
      IMPORTANT GUIDELINES:
      1. Focus on SUBSTANTIVE content only - ignore advertisements, promotional content, and generic announcements
      2. Extract information about new tools, technologies, research papers, and advancements that are directly or indirectly related to the project's domain and goals
      3. Prioritize content that represents actual technological advancements, not marketing material
      4. For each item, evaluate its relevance to the project based on how it might help achieve the project's goals or align with its interests
      5. Only include items with genuine informational value - skip generic news or promotional content
      6. Focus on extracting factual information about tools, technologies, and research`;
      
      // Add special instructions for specific newsletters
      if (context.newsletterName.includes('alphasignal.ai')) {
        systemPrompt += `\n\nThis is an AlphaSignal newsletter which typically contains AI news and research updates organized in sections like "TOP NEWS", "TRENDING SIGNALS", "TOP TUTORIALS", and "HOW TO". 
        
        Pay special attention to:
        1. New AI models, tools, and APIs (like OpenAI's Responses API, Atla AI's Selene, etc.)
        2. AI development frameworks and SDKs
        3. AI tools for creative work, coding, and automation
        4. Tutorials and guides for AI developers
        5. Research papers and technical advancements
        6. Open source projects and libraries
        
        The newsletter has a structured format with multiple sections. Each section contains multiple items with titles, descriptions, and often links. Extract ONLY the substantive, informative items as separate discoveries.
        
        CRITICAL: Focus on the actual content of each item, not just its title or category. Evaluate each item based on:
        1. Does it contain specific information about a tool, technology, or research advancement?
        2. Is it relevant to the project's domain and goals?
        3. Does it provide actionable information or insights?
        4. Is it a substantive piece of content rather than just promotional material?
        
        Only include items that pass these criteria. Skip generic news, announcements, or purely promotional content.
        
        IMPORTANT: Look for the "### ALPHA SIGNAL CONTENT ITEMS ###" and "### EXTRACTED LINKS ###" sections in the content. These contain pre-extracted items and links from the newsletter that you should prioritize. Each item in the ALPHA SIGNAL CONTENT ITEMS section includes a title, URL, category, and popularity information.
        
        For each item in the "ALPHA SIGNAL CONTENT ITEMS" section:
        1. FIRST, evaluate if the item contains substantive information relevant to the project - skip promotional or generic content
        2. For items that pass this evaluation, create a separate discovery entry
        3. Use the provided URL as the source - IMPORTANT: Alpha Signal uses special shortened URLs like "https://link.alphasignal.ai/WsvN56" - these are valid and should be preserved exactly as they appear
        4. Use the title as provided
        5. Generate a detailed description that explains:
           - What specific technology, tool, or advancement is being discussed
           - How it relates to the project's domain and goals
           - What potential value or application it might have for the project
        6. Assign a relevance score based on:
           - Direct relevance to project goals (7-10)
           - Indirect relevance that could still be valuable (4-6)
           - Tangential relevance that might provide inspiration (1-3)
           - No relevance (skip entirely)
        
        SPECIAL NOTE ABOUT ALPHA SIGNAL URLS: Alpha Signal uses a URL shortener with links like "https://link.alphasignal.ai/WsvN56". These are valid URLs that redirect to the actual content. DO NOT modify these URLs or consider them invalid. They are the correct source URLs for the content. ALWAYS preserve the exact format of these URLs (https://link.alphasignal.ai/XXXXX) without any modifications.
        
        CRITICAL INSTRUCTION: When you see a section labeled "# IMPORTANT ALPHA SIGNAL LINKS - USE THESE EXACT URLS:" in the "### EXTRACTED LINKS ###" section, you MUST use those exact URLs as the source for your discoveries. These URLs have been directly extracted from the email and are guaranteed to be correct. DO NOT attempt to modify, clean, or replace these URLs with anything else.
        
        If there are additional items in the newsletter content that weren't pre-extracted, create discoveries for those as well.
        
        Be sure to extract any URLs that point to original research papers, articles, or tools. If URLs aren't explicitly visible, check the "### EXTRACTED LINKS ###" section for relevant links.
        
        For each item in the newsletter, create a separate discovery with a high level of detail.`;
      }
      
      if (context.newsletterName.includes('joinsuperhuman.ai')) {
        systemPrompt += `\n\nThis is a Superhuman newsletter which contains curated AI news and developments organized in sections like "TODAY IN AI", "FROM THE FRONTIER", "AI & TECH NEWS", "PRODUCTIVITY", and "SOCIAL SIGNALS".
        
        Pay special attention to:
        1. New AI models and their capabilities (like voice cloning models, image generators)
        2. AI tools for productivity and business applications
        3. Updates from major AI companies (OpenAI, Anthropic, Meta, etc.)
        4. AI agents and their applications in various domains
        5. AI development tools and platforms
        
        The newsletter has a structured format with multiple sections. Each section contains multiple news items with titles, descriptions, and often links. Extract ALL of these as separate discoveries.
        
        Extract all URLs that link to original sources, research papers, or tools mentioned in the newsletter. If URLs aren't explicitly visible, infer them from the context (e.g., product names, company mentions).
        
        For each news item in the newsletter, create a separate discovery with a high level of detail.`;
      }
      
      // Log the project details to help with debugging
      console.log('Project details for relevance evaluation:');
      console.log(`- Name: ${context.projectName}`);
      console.log(`- Domain: ${context.projectDomain}`);
      console.log(`- Goals: ${context.projectGoals.join(', ')}`);
      console.log(`- Interests: ${context.projectInterests.join(', ')}`);
      
      // Check if we have Alpha Signal content items
      const hasAlphaSignalItems = truncatedContent.includes('### ALPHA SIGNAL CONTENT ITEMS ###');
      console.log(`Newsletter contains Alpha Signal content items: ${hasAlphaSignalItems}`);
      
      // Check if we have extracted links
      const hasExtractedLinks = truncatedContent.includes('### EXTRACTED LINKS ###');
      console.log(`Newsletter contains extracted links: ${hasExtractedLinks}`);
      
      // Create a more focused user prompt
      const userPrompt = `Analyze the following newsletter content from "${context.newsletterName}" with subject "${context.newsletterSubject}" and extract relevant information for my project.
      
      Project details:
      - Name: ${context.projectName}
      - Description: ${context.projectDescription}
      - Domain: ${context.projectDomain}
      - Goals: ${context.projectGoals.join(', ')}
      - Interests: ${context.projectInterests.join(', ')}
      
      IMPORTANT: This newsletter contains information about AI tools, technologies, and advancements. Your task is to identify items that are relevant to the project and create structured discoveries for them.
      
      ${hasAlphaSignalItems ? 'This newsletter contains pre-extracted Alpha Signal content items that you should prioritize.' : ''}
      ${hasExtractedLinks ? 'This newsletter contains pre-extracted links that you should use as sources.' : ''}
      
      Newsletter content:
      ${truncatedContent}
      
      For each relevant piece of information, create a structured discovery with:
      1. Title: A concise, descriptive title
      2. Description: A summary of the information and why it's relevant to the project
      3. Source: The original source URL if mentioned in the newsletter, otherwise use the newsletter name
      4. Relevance Score: A number from 1-10 indicating how relevant this is to the project
      5. Categories: 2-5 categories that this information falls under
      6. Type: One of [Article, Discussion, News, Research, Tool, Other]
      
      IMPORTANT INSTRUCTIONS:
      - Focus ONLY on substantive, informative content - ignore advertisements and generic announcements
      - Extract URLs mentioned in the newsletter that point to relevant tools, technologies, or research
      - Create separate discovery entries for EACH distinct item that contains valuable information
      - For newsletters with sections like "TOP NEWS", "TRENDING SIGNALS", etc., evaluate each item individually
      - For research papers, include the paper title, authors, and key findings in the description
      - For tools, include information about capabilities, use cases, and how they relate to the project
      - For AI models and APIs, extract detailed capabilities and potential applications for the project
      - Pay special attention to AI development tools, frameworks, and SDKs that could be directly useful
      - EVALUATE each item for its relevance to the project before including it
      - SKIP items that are purely promotional or lack substantive information
      - CRITICAL: Always check the "### EXTRACTED LINKS ###" section first for URLs to include
      - When you see "# IMPORTANT ALPHA SIGNAL LINKS - USE THESE EXACT URLS:" in the extracted links section, you MUST use those exact URLs as they are directly extracted from the email and guaranteed to be correct
      - For Alpha Signal newsletters, prioritize items in the "### ALPHA SIGNAL CONTENT ITEMS ###" section
      - For each item in the ALPHA SIGNAL CONTENT ITEMS section, create a separate discovery using the provided URL, title, and category
      - IMPORTANT: Alpha Signal uses special shortened URLs like "https://link.alphasignal.ai/WsvN56" - these are valid URLs and should be preserved exactly as they appear. DO NOT modify these URLs in any way - they must be kept in their original format to work correctly.
      - DO NOT rely on your own URL extraction for Alpha Signal links - always use the ones provided in the "# IMPORTANT ALPHA SIGNAL LINKS" section.
      
      YOU MUST RETURN AT LEAST 3 DISCOVERIES if they are present in the newsletter and relevant to the project.
      
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
      }`;
      
      // Log a sample of the user prompt for debugging
      console.log('User prompt sample (first 500 chars):');
      console.log(userPrompt.substring(0, 500) + '...');
      
      // Make the API call with more specific parameters
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,  // Add some creativity
        max_tokens: 4000,  // Ensure we have enough tokens for a detailed response
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });

      const responseContent = completion.choices[0].message.content;
      
      try {
        console.log('Attempting to parse OpenAI response as JSON');
        const parsedResponse = JSON.parse(responseContent);
        
        // Validate the response structure
        if (!parsedResponse.discoveries) {
          console.error('OpenAI response missing discoveries array:', parsedResponse);
          // Try to fix the response if possible
          if (Array.isArray(parsedResponse)) {
            console.log('Response is an array, wrapping in discoveries object');
            return { discoveries: parsedResponse };
          }
          
          // If we have Alpha Signal items but no discoveries, try to create some basic ones
          if (hasAlphaSignalItems) {
            console.log('No discoveries found but Alpha Signal items exist - creating fallback discoveries');
            return createFallbackDiscoveries(truncatedContent, context);
          }
          
          return { discoveries: [] };
        }
        
        if (!Array.isArray(parsedResponse.discoveries)) {
          console.error('OpenAI discoveries is not an array:', parsedResponse.discoveries);
          
          // If we have Alpha Signal items but no discoveries, try to create some basic ones
          if (hasAlphaSignalItems) {
            console.log('Invalid discoveries format but Alpha Signal items exist - creating fallback discoveries');
            return createFallbackDiscoveries(truncatedContent, context);
          }
          
          return { discoveries: [] };
        }
        
        console.log(`Successfully extracted ${parsedResponse.discoveries.length} discoveries from newsletter`);
        
        // Log the first discovery to verify format
        if (parsedResponse.discoveries.length > 0) {
          console.log('Sample discovery from OpenAI:', JSON.stringify(parsedResponse.discoveries[0], null, 2));
        }
        
        // If we have Alpha Signal items but no discoveries, try to create some basic ones
        if (parsedResponse.discoveries.length === 0 && hasAlphaSignalItems) {
          console.log('Empty discoveries array but Alpha Signal items exist - creating fallback discoveries');
          return createFallbackDiscoveries(truncatedContent, context);
        }
        
        return parsedResponse;
      } catch (parseError) {
        console.error('Error parsing OpenAI JSON response:', parseError);
        console.log('Raw response:', responseContent);
        
        // Try to extract JSON from the response if it's embedded in text
        try {
          const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            console.log('Attempting to extract JSON from response text');
            const extractedJson = jsonMatch[0];
            const parsedJson = JSON.parse(extractedJson);
            console.log('Successfully extracted JSON from response text');
            return parsedJson;
          }
        } catch (extractError) {
          console.error('Failed to extract JSON from response text:', extractError);
        }
        
        return { discoveries: [] };
      }
    } catch (error) {
      console.error('Newsletter processing error:', error);
      throw new Error('Failed to process newsletter content');
    }
  }
};

/**
 * Create fallback discoveries from Alpha Signal content items
 * @param {string} content - The newsletter content
 * @param {Object} context - Context information about the project
 * @returns {Object} - Fallback discoveries
 */
function createFallbackDiscoveries(content, context) {
  console.log('Creating fallback discoveries from Alpha Signal content items');
  
  try {
    const discoveries = [];
    
    // Extract Alpha Signal content items section
    const alphaSignalItemsMatch = content.match(/### ALPHA SIGNAL CONTENT ITEMS ###([\s\S]*?)(?=###|$)/);
    if (!alphaSignalItemsMatch || !alphaSignalItemsMatch[1]) {
      console.log('No Alpha Signal content items section found in fallback');
      return { discoveries: [] };
    }
    
    const alphaSignalItemsSection = alphaSignalItemsMatch[1];
    
    // Extract individual items
    const itemRegex = /\[Item (\d+)\] (.*?)\nURL: (.*?)(?:\nCategory: (.*?))?(?:\nPopularity: (.*?))?(?:\n\n|\n$)/g;
    let match;
    
    while ((match = itemRegex.exec(alphaSignalItemsSection)) !== null) {
      const itemNumber = match[1];
      const title = match[2].trim();
      const url = match[3].trim();
      const category = match[4] ? match[4].trim() : '';
      const popularity = match[5] ? match[5].trim() : '';
      
      // Only process items with both title and URL
      if (title && url) {
        console.log(`Creating fallback discovery for item ${itemNumber}: ${title}`);
        
        // Create a basic description
        let description = `This is an AI tool or technology mentioned in the Alpha Signal newsletter.`;
        if (category) {
          description += ` It falls under the category of ${category}.`;
        }
        description += ` This may be relevant to the project's focus on ${context.projectDomain} and interests in ${context.projectInterests.join(', ')}.`;
        
        // Create discovery object
        const discovery = {
          title,
          description,
          source: url,
          relevanceScore: 5, // Default middle relevance
          categories: category ? [category, 'AI', 'Technology'] : ['AI', 'Technology'],
          type: 'Tool' // Default type
        };
        
        discoveries.push(discovery);
      }
    }
    
    // Extract important Alpha Signal links
    if (discoveries.length === 0) {
      console.log('No items found in Alpha Signal content items, checking extracted links');
      
      // Look for the extracted links section
      const extractedLinksMatch = content.match(/### EXTRACTED LINKS ###([\s\S]*?)(?=###|$)/);
      if (extractedLinksMatch && extractedLinksMatch[1]) {
        const extractedLinksSection = extractedLinksMatch[1];
        
        // Look for Alpha Signal links specifically
        const alphaSignalLinksSection = extractedLinksSection.match(/# IMPORTANT ALPHA SIGNAL LINKS - USE THESE EXACT URLS:([\s\S]*?)(?=#|$)/);
        if (alphaSignalLinksSection && alphaSignalLinksSection[1]) {
          const alphaSignalLinks = alphaSignalLinksSection[1];
          
          // Extract individual links
          const linkRegex = /\[Alpha Signal Link (\d+)\] (https:\/\/link\.alphasignal\.ai\/[A-Za-z0-9]+)/g;
          let linkMatch;
          
          while ((linkMatch = linkRegex.exec(alphaSignalLinks)) !== null) {
            const linkNumber = linkMatch[1];
            const url = linkMatch[2].trim();
            
            console.log(`Creating fallback discovery for Alpha Signal link ${linkNumber}: ${url}`);
            
            // Create a basic discovery for each link
            const discovery = {
              title: `Alpha Signal Content Item ${linkNumber}`,
              description: `This is content from the Alpha Signal newsletter that may be relevant to the project's focus on ${context.projectDomain} and interests in ${context.projectInterests.join(', ')}.`,
              source: url,
              relevanceScore: 5, // Default middle relevance
              categories: ['AI', 'Technology'],
              type: 'Article' // Default type
            };
            
            discoveries.push(discovery);
          }
        }
      }
    }
    
    console.log(`Created ${discoveries.length} fallback discoveries`);
    return { discoveries };
  } catch (error) {
    console.error('Error creating fallback discoveries:', error);
    return { discoveries: [] };
  }
}

module.exports = openaiService;