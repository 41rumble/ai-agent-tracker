import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Rating,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { apiService } from '../../services/api';

interface Discovery {
  _id: string;
  title: string;
  description: string;
  source: string;
  relevanceScore: number;
  categories: string[];
  discoveredAt: string;
  userFeedback?: {
    useful: boolean;
    notes: string;
  };
}

interface DiscoveryListProps {
  projectId: string;
}

const DiscoveryList: React.FC<DiscoveryListProps> = ({ projectId }) => {
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDiscovery, setSelectedDiscovery] = useState<Discovery | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [feedbackUseful, setFeedbackUseful] = useState<boolean | null>(null);

  useEffect(() => {
    fetchDiscoveries();
  }, [projectId]);

  const fetchDiscoveries = async () => {
    try {
      setLoading(true);
      const response = await apiService.getDiscoveries(projectId);
      setDiscoveries(response.data);
      setError('');
    } catch (err: any) {
      setError('Failed to load discoveries. Please try again.');
      console.error('Error fetching discoveries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackClick = (discovery: Discovery) => {
    setSelectedDiscovery(discovery);
    setFeedbackNotes(discovery.userFeedback?.notes || '');
    setFeedbackUseful(discovery.userFeedback?.useful !== undefined ? discovery.userFeedback.useful : null);
    setFeedbackDialogOpen(true);
  };

  const handleFeedbackSubmit = async () => {
    if (!selectedDiscovery) return;
    
    try {
      await apiService.updateDiscoveryFeedback(selectedDiscovery._id, {
        useful: feedbackUseful,
        notes: feedbackNotes
      });
      
      // Update local state
      setDiscoveries(discoveries.map(d => 
        d._id === selectedDiscovery._id 
          ? { 
              ...d, 
              userFeedback: { 
                useful: feedbackUseful !== null ? feedbackUseful : undefined, 
                notes: feedbackNotes 
              } 
            } 
          : d
      ));
      
      setFeedbackDialogOpen(false);
    } catch (err: any) {
      setError('Failed to save feedback. Please try again.');
      console.error('Error saving feedback:', err);
    }
  };

  const filteredDiscoveries = discoveries.filter(discovery => 
    discovery.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    discovery.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    discovery.categories.some(category => category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
            Discoveries
          </Typography>
          <TextField
            placeholder="Search discoveries..."
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ width: 250 }}
          />
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {discoveries.length === 0 ? (
          <Alert severity="info">
            No discoveries found yet. Try triggering a search to find relevant tools and resources.
          </Alert>
        ) : filteredDiscoveries.length === 0 ? (
          <Alert severity="info">
            No discoveries match your search criteria.
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {filteredDiscoveries.map((discovery) => (
              <Grid item xs={12} md={6} key={discovery._id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="h6" component="h2" gutterBottom>
                        {discovery.title}
                      </Typography>
                      <Rating 
                        value={discovery.relevanceScore / 2} 
                        precision={0.5} 
                        readOnly 
                        max={5}
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {discovery.description}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {discovery.categories.map((category, index) => (
                        <Chip key={index} label={category} size="small" />
                      ))}
                    </Box>
                    
                    <Typography variant="caption" color="text.secondary" display="block">
                      Discovered: {new Date(discovery.discoveredAt).toLocaleDateString()}
                    </Typography>
                    
                    {discovery.userFeedback?.useful !== undefined && (
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Your feedback:
                        </Typography>
                        {discovery.userFeedback.useful ? (
                          <Chip 
                            icon={<ThumbUpIcon fontSize="small" />} 
                            label="Useful" 
                            size="small" 
                            color="success" 
                            variant="outlined" 
                          />
                        ) : (
                          <Chip 
                            icon={<ThumbDownIcon fontSize="small" />} 
                            label="Not Useful" 
                            size="small" 
                            color="error" 
                            variant="outlined" 
                          />
                        )}
                      </Box>
                    )}
                  </CardContent>
                  
                  <Divider />
                  
                  <CardActions>
                    <Button 
                      size="small" 
                      startIcon={<OpenInNewIcon />}
                      href={discovery.source}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Source
                    </Button>
                    <Button 
                      size="small"
                      onClick={() => handleFeedbackClick(discovery)}
                    >
                      {discovery.userFeedback?.useful !== undefined ? 'Edit Feedback' : 'Add Feedback'}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
      
      <Dialog open={feedbackDialogOpen} onClose={() => setFeedbackDialogOpen(false)}>
        <DialogTitle>
          Provide Feedback
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle1" gutterBottom>
              Was this discovery useful?
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant={feedbackUseful === true ? "contained" : "outlined"}
                color="success"
                startIcon={<ThumbUpIcon />}
                onClick={() => setFeedbackUseful(true)}
              >
                Useful
              </Button>
              <Button
                variant={feedbackUseful === false ? "contained" : "outlined"}
                color="error"
                startIcon={<ThumbDownIcon />}
                onClick={() => setFeedbackUseful(false)}
              >
                Not Useful
              </Button>
            </Box>
            
            <TextField
              margin="normal"
              fullWidth
              multiline
              rows={4}
              label="Notes (optional)"
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeedbackDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleFeedbackSubmit} 
            variant="contained"
            disabled={feedbackUseful === null}
          >
            Save Feedback
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DiscoveryList;