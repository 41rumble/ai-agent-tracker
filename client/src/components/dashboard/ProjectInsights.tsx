import React from 'react';
import { Box, Paper, Typography, Button, Divider, Chip, CircularProgress } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';

interface ProjectInsightsProps {
  summary: any;
  project: any;
  onRefresh: () => void;
  isGenerating?: boolean;
}

const ProjectInsights: React.FC<ProjectInsightsProps> = ({ 
  summary, 
  project, 
  onRefresh,
  isGenerating = false
}) => {
  if (!project) return null;
  
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Project Insights</Typography>
        <Button 
          startIcon={isGenerating ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />} 
          onClick={onRefresh}
          disabled={isGenerating}
          variant="outlined"
          size="small"
        >
          {isGenerating ? 'Generating...' : 'Refresh Insights'}
        </Button>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {/* Summary Content */}
      <Box sx={{
        '& a': { color: 'primary.main' },
        '& h1, & h2, & h3, & h4, & h5, & h6': {
          mt: 2,
          mb: 1,
          fontWeight: 'bold',
          fontFamily: 'inherit'
        },
        '& p': { mb: 1.5 },
        '& ul, & ol': { pl: 2, mb: 1.5 }
      }}>
        <ReactMarkdown>
          {summary?.summary || "No insights available yet. Click 'Refresh Insights' to generate insights based on your project's discoveries."}
        </ReactMarkdown>
      </Box>
      
      {/* Key Recommendations */}
      {summary?.recommendations && summary.recommendations.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>Key Recommendations</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {summary.recommendations.map((rec: string, index: number) => (
              <Box key={index} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body1">{rec}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
      
      {/* Referenced Discoveries */}
      {summary?.discoveries && summary.discoveries.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>Referenced Discoveries</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {summary.discoveries.slice(0, 5).map((discovery: any) => (
              <Chip 
                key={discovery._id}
                label={discovery.title}
                onClick={() => window.open(discovery.source, '_blank')}
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default ProjectInsights;