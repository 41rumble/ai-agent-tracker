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

## License

This project is licensed under the MIT License - see the LICENSE file for details.