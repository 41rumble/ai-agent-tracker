import React, { useState } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Divider,
  List, ListItem, ListItemText, Alert, CircularProgress
} from '@mui/material';

interface ContextPanelProps {
  context: any;
  onSubmitUpdate: (update: string) => void;
  isSubmitting?: boolean;
}

const ContextPanel: React.FC<ContextPanelProps> = ({ 
  context, 
  onSubmitUpdate,
  isSubmitting = false
}) => {
  const [userInput, setUserInput] = useState('');
  
  if (!context) return null;
  
  // Get the most recent question if any
  const recentQuestion = context.contextEntries
    ?.filter((entry: any) => entry.type === 'agent_question')
    ?.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" gutterBottom>Project Context</Typography>
      
      <Divider sx={{ mb: 2 }} />
      
      {/* Current Phase and Progress */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          Current Phase: {context.currentPhase || 'Initial'}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Progress: {context.progressPercentage || 0}% complete
        </Typography>
      </Box>
      
      {/* Agent Question (if any) */}
      {recentQuestion && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Agent Question:</Typography>
          {recentQuestion.content}
        </Alert>
      )}
      
      {/* User Input */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          placeholder={recentQuestion 
            ? "Type your response to the agent's question..." 
            : "Share an update on your project progress..."
          }
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          sx={{ mb: 1 }}
          disabled={isSubmitting}
        />
        <Button 
          variant="contained" 
          disabled={!userInput.trim() || isSubmitting}
          onClick={() => {
            onSubmitUpdate(userInput);
            setUserInput('');
          }}
          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : undefined}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Update'}
        </Button>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {/* Recent Context Entries */}
      <Typography variant="subtitle1" gutterBottom>Recent Updates</Typography>
      
      <List sx={{ maxHeight: 300, overflow: 'auto' }}>
        {context.contextEntries
          ?.slice()
          ?.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          ?.slice(0, 5)
          ?.map((entry: any) => (
            <ListItem key={entry._id} alignItems="flex-start" sx={{ px: 0 }}>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography component="span">
                      {entry.type === 'agent_question' ? '🤖' : 
                       entry.type === 'user_response' ? '👤' : 
                       entry.type === 'user_update' ? '📝' : 
                       entry.type === 'milestone' ? '🏆' : '👍'}
                    </Typography>
                    <Typography 
                      component="span" 
                      sx={{ 
                        fontWeight: entry.type === 'agent_question' ? 'bold' : 'normal',
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
                    {entry.content.length > 100 
                      ? `${entry.content.substring(0, 100)}...` 
                      : entry.content}
                  </Typography>
                }
              />
            </ListItem>
          ))}
          
        {(!context.contextEntries || context.contextEntries.length === 0) && (
          <ListItem>
            <ListItemText
              primary="No updates yet"
              secondary="Start by sharing an update or answering the agent's questions"
            />
          </ListItem>
        )}
      </List>
    </Paper>
  );
};

export default ContextPanel;