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
  Tooltip,
  Badge
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Notifications as NotificationsIcon
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newDiscoveriesCount, setNewDiscoveriesCount] = useState(0);
  const [summaryAge, setSummaryAge] = useState<number>(0); // Age in hours

  useEffect(() => {
    // Only fetch summary on initial load
    if (loading) {
      fetchSummary();
    }
  }, [projectId]);

  // Check for new discoveries periodically without regenerating the summary
  useEffect(() => {
    const checkForNewDiscoveries = async () => {
      try {
        // Get the latest discoveries
        const response = await apiService.getDiscoveries(projectId);
        const latestDiscoveries = response.data || [];
        
        // If we have a last updated timestamp, count discoveries newer than that
        if (lastUpdated && latestDiscoveries.length > 0) {
          const newCount = latestDiscoveries.filter(
            (d: any) => new Date(d.discoveredAt) > lastUpdated
          ).length;
          
          setNewDiscoveriesCount(newCount);
        }
      } catch (error) {
        console.error('Error checking for new discoveries:', error);
      }
    };

    // Check for new discoveries when the component mounts
    if (!loading && lastUpdated) {
      checkForNewDiscoveries();
    }
  }, [projectId, lastUpdated, loading]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const response = await apiService.getRecommendations(projectId);
      
      if (response.data && response.data.summary) {
        setSummary(response.data.summary);
        setDiscoveries(response.data.discoveries || []);
        
        // Store the current time as the last updated time
        const now = new Date();
        setLastUpdated(now);
        
        // Reset new discoveries count
        setNewDiscoveriesCount(0);
        
        // Set summary age to 0 (fresh)
        setSummaryAge(0);
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

  // Calculate if summary needs refresh (older than 24 hours or has new discoveries)
  const needsRefresh = summaryAge > 24 || newDiscoveriesCount > 0;

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
      
      // Wait a moment to allow the search to start processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Then generate a new summary
      const response = await apiService.getRecommendations(projectId);
      
      if (response.data && response.data.summary) {
        setSummary(response.data.summary);
        setDiscoveries(response.data.discoveries || []);
        
        // Store the current time as the last updated time
        const now = new Date();
        setLastUpdated(now);
        
        // Reset new discoveries count
        setNewDiscoveriesCount(0);
        
        // Set summary age to 0 (fresh)
        setSummaryAge(0);
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

  // Calculate time since last update
  useEffect(() => {
    if (lastUpdated) {
      const interval = setInterval(() => {
        const now = new Date();
        const hoursSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60));
        setSummaryAge(hoursSinceUpdate);
      }, 60000); // Check every minute
      
      // Initial calculation
      const now = new Date();
      const hoursSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60));
      setSummaryAge(hoursSinceUpdate);
      
      return () => clearInterval(interval);
    }
  }, [lastUpdated]);

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5">
              Project Summary
            </Typography>
            {newDiscoveriesCount > 0 && (
              <Badge badgeContent={newDiscoveriesCount} color="error" sx={{ ml: 1 }}>
                <NotificationsIcon color="action" />
              </Badge>
            )}
          </Box>
          <Box>
            {lastUpdated && (
              <Typography variant="body2" color="text.secondary" sx={{ mr: 2, display: 'inline-block' }}>
                Last updated: {lastUpdated.toLocaleString()}
                {needsRefresh && (
                  <Tooltip title="New discoveries available or summary is outdated">
                    <Chip 
                      label="Update available" 
                      color="primary" 
                      size="small" 
                      sx={{ ml: 1 }} 
                    />
                  </Tooltip>
                )}
              </Typography>
            )}
            <Button
              variant={needsRefresh ? "contained" : "outlined"}
              startIcon={<RefreshIcon />}
              onClick={generateSummary}
              disabled={generating}
              color={needsRefresh ? "primary" : "inherit"}
            >
              {generating ? 'Generating...' : needsRefresh ? 'Update Summary' : 'Generate New Summary'}
            </Button>
          </Box>
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