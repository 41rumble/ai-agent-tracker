import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  Card,
  CardContent,
  LinearProgress
} from '@mui/material';
import { apiService } from '../../services/api';

interface ContextEntry {
  _id: string;
  type: 'user_update' | 'agent_question' | 'user_response' | 'milestone' | 'feedback';
  content: string;
  metadata: any;
  timestamp: string;
}

interface ProjectContextData {
  _id: string;
  projectId: string;
  currentPhase: string;
  progressPercentage: number;
  contextEntries: ContextEntry[];
  lastUpdated: string;
}

interface ProjectContextProps {
  projectId: string;
}

const ProjectContext: React.FC<ProjectContextProps> = ({ projectId }) => {
  const [context, setContext] = useState<ProjectContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userInput, setUserInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<{ questionId: string, question: string } | null>(null);

  useEffect(() => {
    fetchProjectContext();
  }, [projectId]);

  const fetchProjectContext = async () => {
    try {
      setLoading(true);
      const response = await apiService.getProjectContext(projectId);
      setContext(response.data.context);
      
      // Find the most recent agent question
      const entries = response.data.context.contextEntries;
      const lastQuestion = [...entries].reverse().find(entry => entry.type === 'agent_question');
      
      if (lastQuestion) {
        setCurrentQuestion({
          questionId: lastQuestion._id,
          question: lastQuestion.content
        });
      }
      
      setError('');
    } catch (err: any) {
      setError('Failed to load project context. Please try again.');
      console.error('Error fetching project context:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitUpdate = async () => {
    if (!userInput.trim()) return;
    
    try {
      setSubmitting(true);
      
      if (currentQuestion && currentQuestion.questionId) {
        console.log(`Submitting response to question ID: ${currentQuestion.questionId}`);
        // Submit as a response to the current question
        const response = await apiService.addUserResponse(
          projectId, 
          currentQuestion.questionId, 
          userInput
        );
        
        setContext(response.data.context);
        
        // Update current question
        if (response.data.followUpQuestion) {
          setCurrentQuestion(response.data.followUpQuestion);
        } else {
          setCurrentQuestion(null);
        }
      } else {
        console.log('Submitting as general update');
        // Submit as a general update
        const response = await apiService.addUserUpdate(projectId, userInput);
        setContext(response.data.context);
        
        // Set new question if available
        if (response.data.followUpQuestion) {
          setCurrentQuestion(response.data.followUpQuestion);
        } else {
          setCurrentQuestion(null);
        }
      }
      
      setUserInput('');
      setError('');
    } catch (err: any) {
      setError('Failed to submit update. Please try again.');
      console.error('Error submitting update:', err);
      console.error('Error details:', err.response?.data || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateQuestion = async () => {
    try {
      setSubmitting(true);
      const response = await apiService.generateProjectQuestion(projectId);
      
      if (response.data.question) {
        setCurrentQuestion(response.data.question);
      }
      
      setError('');
    } catch (err: any) {
      setError('Failed to generate question. Please try again.');
      console.error('Error generating question:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getEntryColor = (type: string) => {
    switch (type) {
      case 'agent_question': return 'primary.main';
      case 'user_response': return 'text.primary';
      case 'user_update': return 'text.primary';
      case 'milestone': return 'success.main';
      case 'feedback': return 'secondary.main';
      default: return 'text.primary';
    }
  };

  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'agent_question': return '🤖';
      case 'user_response': return '👤';
      case 'user_update': return '📝';
      case 'milestone': return '🏆';
      case 'feedback': return '👍';
      default: return '📌';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Project Context
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {context && (
          <>
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">
                    Current Phase: {context.currentPhase}
                  </Typography>
                  <Chip 
                    label={`${context.progressPercentage}% Complete`} 
                    color={
                      context.progressPercentage >= 75 ? 'success' :
                      context.progressPercentage >= 25 ? 'primary' : 'default'
                    }
                  />
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={context.progressPercentage} 
                  sx={{ height: 10, borderRadius: 5, mb: 2 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Last updated: {new Date(context.lastUpdated).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {currentQuestion ? 'Agent Question:' : 'Update Your Progress:'}
              </Typography>
              
              {currentQuestion && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {currentQuestion.question}
                </Alert>
              )}
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder={currentQuestion 
                    ? "Type your response to the agent's question..." 
                    : "Share an update on your project progress..."
                  }
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  disabled={submitting}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    variant="contained"
                    onClick={handleSubmitUpdate}
                    disabled={!userInput.trim() || submitting}
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </Button>
                  
                  {!currentQuestion && (
                    <Button
                      variant="outlined"
                      onClick={handleGenerateQuestion}
                      disabled={submitting}
                    >
                      Get Question
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="h6" gutterBottom>
              Conversation History
            </Typography>
            
            <List>
              {context.contextEntries.slice().reverse().map((entry) => (
                <ListItem key={entry._id} alignItems="flex-start" sx={{ py: 1 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography component="span">
                          {getEntryIcon(entry.type)}
                        </Typography>
                        <Typography 
                          component="span" 
                          sx={{ 
                            fontWeight: entry.type === 'agent_question' ? 'bold' : 'normal',
                            color: getEntryColor(entry.type)
                          }}
                        >
                          {entry.type === 'agent_question' ? 'Agent' : 
                           entry.type === 'user_response' ? 'You' : 
                           entry.type === 'user_update' ? 'Your Update' : 
                           entry.type === 'milestone' ? 'Milestone' : 'Feedback'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(entry.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.primary"
                        sx={{ display: 'block', mt: 1, whiteSpace: 'pre-wrap' }}
                      >
                        {entry.content}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
              
              {context.contextEntries.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary="No conversation history yet"
                    secondary="Start by sharing an update or answering the agent's questions"
                  />
                </ListItem>
              )}
            </List>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default ProjectContext;