import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  Card,
  CardContent,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { apiService } from '../../services/api';

interface ProjectSummaryProps {
  projectId: string;
}

const ProjectSummary: React.FC<ProjectSummaryProps> = ({ projectId }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [discoveries, setDiscoveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [projectId]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await apiService.getRecommendations(projectId);
      
      if (response.data && response.data.summary) {
        setSummary(response.data.summary);
        setDiscoveries(response.data.discoveries || []);
      } else {
        setSummary(null);
      }
      
      setError('');
    } catch (err: any) {
      setError('Failed to load summary. Please try again.');
      console.error('Error fetching summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    try {
      setGenerating(true);
      setError('');
      
      // First trigger a search to find new discoveries
      const searchResponse = await apiService.triggerSearch(projectId);
      
      // Show a message that the search is running in the background
      setSummary(prev => {
        const backgroundMessage = `
## 🔍 Search triggered successfully! 

The system is now searching for new information related to your project. This process runs in the background and may take a few minutes to complete.

${prev ? '\n\n### Previous summary:\n' + prev : ''}`;
        return backgroundMessage;
      });
      
      // Then generate a new summary
      const response = await apiService.getRecommendations(projectId);
      
      if (response.data && response.data.summary) {
        setSummary(response.data.summary);
        setDiscoveries(response.data.discoveries || []);
      } else {
        setSummary(`
## 🔍 Search in progress...

The system is currently searching for new information related to your project. This process runs in the background and may take a few minutes to complete.

Check back later to see the results, or refresh this page.`);
      }
    } catch (err: any) {
      setError('Failed to generate summary. Please try again.');
      console.error('Error generating summary:', err);
    } finally {
      setGenerating(false);
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">
            Project Summary
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={generateSummary}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate New Summary'}
          </Button>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {!summary ? (
          <Alert severity="info">
            No summary available yet. Click "Generate New Summary" to create one based on the latest discoveries.
          </Alert>
        ) : (
          <>
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="h6" gutterBottom>
                    Latest Insights
                  </Typography>
                  <Tooltip title="This summary is generated based on the most relevant discoveries for your project">
                    <IconButton size="small">
                      <InfoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box sx={{ 
                  '& a': { color: 'primary.main' },
                  '& h1, & h2, & h3, & h4, & h5, & h6': { 
                    mt: 2, 
                    mb: 1,
                    fontWeight: 'bold',
                    fontFamily: 'inherit'
                  },
                  '& p': { mb: 1.5 },
                  '& ul, & ol': { pl: 2, mb: 1.5 },
                  '& blockquote': { 
                    borderLeft: '4px solid #ddd', 
                    pl: 2, 
                    fontStyle: 'italic',
                    my: 1.5
                  },
                  '& code': {
                    fontFamily: 'monospace',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    p: 0.5,
                    borderRadius: 1
                  }
                }}>
                  <ReactMarkdown components={{
                    // Customize how different markdown elements are rendered
                    h1: ({node, ...props}) => <Typography variant="h4" gutterBottom {...props} />,
                    h2: ({node, ...props}) => <Typography variant="h5" gutterBottom {...props} />,
                    h3: ({node, ...props}) => <Typography variant="h6" gutterBottom {...props} />,
                    h4: ({node, ...props}) => <Typography variant="subtitle1" gutterBottom fontWeight="bold" {...props} />,
                    h5: ({node, ...props}) => <Typography variant="subtitle2" gutterBottom fontWeight="bold" {...props} />,
                    h6: ({node, ...props}) => <Typography variant="subtitle2" gutterBottom fontWeight="bold" {...props} />,
                    p: ({node, ...props}) => <Typography variant="body1" paragraph {...props} />,
                    ul: ({node, ...props}) => <Box component="ul" sx={{ pl: 2, mb: 2 }} {...props} />,
                    ol: ({node, ...props}) => <Box component="ol" sx={{ pl: 2, mb: 2 }} {...props} />,
                    li: ({node, ...props}) => <Box component="li" sx={{ mb: 0.5 }} {...props} />,
                    a: ({node, ...props}) => {
                      // Extract href from props
                      const { href, ...otherProps } = props;
                      return (
                        <Typography 
                          component="a" 
                          href={href} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                          {...otherProps} 
                        />
                      );
                    },
                    blockquote: ({node, ...props}) => (
                      <Box component="blockquote" sx={{ borderLeft: '4px solid #ddd', pl: 2, py: 1, my: 2, fontStyle: 'italic' }} {...props} />
                    ),
                    code: (props) => {
                      // Use a simpler approach - just render all code with the same styling
                      return (
                        <Typography 
                          component="code" 
                          sx={{ 
                            fontFamily: 'monospace', 
                            backgroundColor: 'rgba(0, 0, 0, 0.05)', 
                            px: 0.5, 
                            py: 0.25, 
                            borderRadius: 0.5,
                            wordBreak: 'break-word'
                          }} 
                          {...props} 
                        />
                      );
                    },
                    pre: (props) => {
                      // Handle code blocks (pre tags)
                      return (
                        <Box 
                          component="pre" 
                          sx={{ 
                            fontFamily: 'monospace', 
                            backgroundColor: 'rgba(0, 0, 0, 0.05)', 
                            p: 1.5, 
                            borderRadius: 1, 
                            overflowX: 'auto',
                            maxWidth: '100%'
                          }} 
                          {...props} 
                        />
                      );
                    }
                  }}>
                    {summary}
                  </ReactMarkdown>
                </Box>
              </CardContent>
            </Card>
            
            {discoveries.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom>
                  Key Discoveries
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {discoveries.slice(0, 3).map((discovery) => (
                    <Card key={discovery._id} variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Typography variant="subtitle1" component="h3" gutterBottom>
                            {discovery.title}
                          </Typography>
                          <Chip 
                            label={discovery.type} 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {discovery.description.length > 200 
                            ? `${discovery.description.substring(0, 200)}...` 
                            : discovery.description}
                        </Typography>
                        <Button 
                          size="small" 
                          href={discovery.source}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View Source
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
};

export default ProjectSummary;