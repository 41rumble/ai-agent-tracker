import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

// Get the API base URL from environment variables or construct it dynamically
let API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

// If not explicitly set, try to construct it based on the current window location
if (!API_BASE_URL && typeof window !== 'undefined') {
  // Default to the same host but with port 3000 (or whatever is configured)
  const serverPort = process.env.REACT_APP_SERVER_PORT || '3000';
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  API_BASE_URL = `${protocol}//${hostname}:${serverPort}/api`;
  
  console.log(`API base URL constructed dynamically: ${API_BASE_URL}`);
} else {
  // Fallback to localhost if all else fails
  API_BASE_URL = API_BASE_URL || 'http://localhost:3000/api';
  console.log(`Using configured API base URL: ${API_BASE_URL}`);
}

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  // Enable cookies and credentials for cross-origin requests
  withCredentials: true
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried to refresh token yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Redirect to login page
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// API endpoints
export const endpoints = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    profile: '/auth/profile',
  },
  projects: {
    base: '/projects',
    detail: (id: string) => `/projects/${id}`,
  },
  discoveries: {
    base: '/discoveries',
    byProject: (projectId: string) => `/discoveries/project/${projectId}`,
    detail: (id: string) => `/discoveries/${id}`,
  },
  schedules: {
    base: '/schedules',
    byProject: (projectId: string) => `/schedules/project/${projectId}`,
    detail: (id: string) => `/schedules/${id}`,
  },
  agent: {
    search: '/agent/search',
    recommendations: '/agent/recommendations',
  },
  contextAgent: {
    getContext: (projectId: string) => `/context-agent/project/${projectId}`,
    addUpdate: (projectId: string) => `/context-agent/project/${projectId}/update`,
    addResponse: (projectId: string, questionId: string) => `/context-agent/project/${projectId}/response/${questionId}`,
    getQuestion: (projectId: string) => `/context-agent/project/${projectId}/question`,
  },
};

// API service functions
export const apiService = {
  // Auth
  login: (email: string, password: string) => 
    api.post(endpoints.auth.login, { email, password }),
  
  register: (name: string, email: string, password: string) => 
    api.post(endpoints.auth.register, { name, email, password }),
  
  getProfile: () => 
    api.get(endpoints.auth.profile),
  
  // Projects
  getProjects: () => 
    api.get(endpoints.projects.base),
  
  getProject: (id: string) => 
    api.get(endpoints.projects.detail(id)),
  
  createProject: (projectData: any) => 
    api.post(endpoints.projects.base, projectData),
  
  updateProject: (id: string, projectData: any) => 
    api.put(endpoints.projects.detail(id), projectData),
  
  deleteProject: (id: string) => 
    api.delete(endpoints.projects.detail(id)),
  
  // Discoveries
  getDiscoveries: (projectId: string) => 
    api.get(endpoints.discoveries.byProject(projectId)),
  
  getDiscovery: (id: string) => 
    api.get(endpoints.discoveries.detail(id)),
  
  updateDiscoveryFeedback: (id: string, feedback: any) => 
    api.put(endpoints.discoveries.detail(id), { userFeedback: feedback }),
  
  // Schedules
  getSchedules: (projectId: string) => 
    api.get(endpoints.schedules.byProject(projectId)),
  
  createSchedule: (scheduleData: any) => 
    api.post(endpoints.schedules.base, scheduleData),
  
  updateSchedule: (id: string, scheduleData: any) => 
    api.put(endpoints.schedules.detail(id), scheduleData),
  
  deleteSchedule: (id: string) => 
    api.delete(endpoints.schedules.detail(id)),
  
  // Agent
  triggerSearch: (projectId: string) => 
    api.post(endpoints.agent.search, { projectId }),
  
  getRecommendations: (projectId: string) => 
    api.get(`${endpoints.agent.recommendations}?projectId=${projectId}`),
    
  // Context Agent
  getProjectContext: (projectId: string) => 
    api.get(endpoints.contextAgent.getContext(projectId)),
  
  addUserUpdate: (projectId: string, content: string, metadata = {}) => 
    api.post(endpoints.contextAgent.addUpdate(projectId), { content, metadata }),
  
  addUserResponse: (projectId: string, questionId: string, response: string, metadata = {}) => 
    api.post(endpoints.contextAgent.addResponse(projectId, questionId), { response, metadata }),
  
  generateProjectQuestion: (projectId: string) => 
    api.get(endpoints.contextAgent.getQuestion(projectId)),
};

export default api;