# AI Agent Tracker

A web application that uses OpenAI's Agent API to monitor advancements in specific domains and provide personalized recommendations.

## Features

- **Project Management**: Create and manage projects with specific goals and interests
- **Automated Monitoring**: Schedule regular searches for relevant tools and advancements
- **Personalized Recommendations**: Get tailored suggestions based on your project needs
- **Progress Tracking**: Keep track of your journey and discoveries

## Tech Stack

### Backend
- Node.js with Express
- MongoDB for data storage
- OpenAI Agent API for intelligent monitoring
- JWT for authentication

### Frontend
- React with TypeScript
- Material-UI for components
- React Router for navigation
- React Query for data fetching

## Getting Started

### Prerequisites
- Node.js (v14+)
- MongoDB
- OpenAI API key

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/ai-agent-tracker.git
cd ai-agent-tracker
```

2. Install backend dependencies
```bash
npm install
```

3. Install frontend dependencies
```bash
cd client
npm install
```

4. Create a `.env` file in the root directory with the following variables:
```
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ai-agent-tracker
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_jwt_secret
JWT_EXPIRY=24h

# Optional: Enable OpenAI's web search capability (requires gpt-4o-search-preview access)
ENABLE_OPENAI_WEB_SEARCH=true

# Optional: Enable OpenAI's Assistants API with web search (recommended)
ENABLE_OPENAI_ASSISTANTS=true

# Optional: Google Search fallback (only used as a last resort if both OpenAI methods fail)
# GOOGLE_SEARCH_API_KEY=your_google_search_api_key
# GOOGLE_SEARCH_CX=your_google_search_cx
```

5. Create a `.env` file in the client directory:
```
REACT_APP_API_BASE_URL=http://localhost:3000/api
```

### Running the Application

1. Start the backend server
```bash
npm run dev
```

2. In a separate terminal, start the frontend
```bash
cd client
npm start
```

3. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Register an account or login
2. Create a new project with your goals and interests
3. Set up automated schedules for monitoring
4. Explore discoveries and recommendations
5. Provide feedback to improve future recommendations

## Search Capabilities

The application supports three methods for searching the web, with automatic fallback:

### OpenAI Assistants API (Recommended)

If you have access to OpenAI's Assistants API, you can enable this feature by setting `ENABLE_OPENAI_ASSISTANTS=true` in your `.env` file. This provides:

- Dedicated AI assistants for each project
- Persistent threads for ongoing conversations
- Web search via function calling
- Advanced reasoning and analysis of search results
- Automatic categorization and relevance scoring
- Focus on recent content from the past 3 months

### OpenAI Web Search (Alternative)

If you have access to OpenAI's `gpt-4o-search-preview` model but not the Assistants API, you can enable this feature by setting `ENABLE_OPENAI_WEB_SEARCH=true` in your `.env` file. This provides:

- Real-time web search results from the internet
- Automatic citation of sources
- Higher quality, more relevant results
- Focus on recent content from the past 3 months

### Google-it (Last Resort Only)

The system will only use the `google-it` package as a last resort if:
1. Both OpenAI methods fail AND
2. Google Search is explicitly enabled in the configuration

This fallback method:
- Scrapes Google search results
- Validates all URLs before processing
- Filters out invalid or inaccessible links
- Adds time constraints to focus on recent content

By default, this fallback is disabled to prioritize OpenAI's more reliable search capabilities.

## License

This project is licensed under the MIT License - see the LICENSE file for details.