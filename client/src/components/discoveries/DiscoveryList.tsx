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
  Divider,
  Tabs,
  Tab,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
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
  type: 'Article' | 'Discussion' | 'News' | 'Research' | 'Tool' | 'Other';
  discoveredAt: string;
  publicationDate?: string;
  userFeedback?: {
    useful?: boolean;
    notes: string;
  };
}

interface DiscoveryListProps {
  projectId: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`discovery-tabpanel-${index}`}
      aria-labelledby={`discovery-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const DiscoveryList: React.FC<DiscoveryListProps> = ({ projectId }) => {
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDiscovery, setSelectedDiscovery] = useState<Discovery | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [feedbackUseful, setFeedbackUseful] = useState<boolean | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
                ...(feedbackUseful !== null ? { useful: feedbackUseful } : {}), 
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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setPage(0); // Reset to first page when changing tabs
  };
  
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const handleSelectRowsPerPage = (event: SelectChangeEvent<number>) => {
    setRowsPerPage(Number(event.target.value));
    setPage(0);
  };

  // Get unique discovery types
  const discoveryTypes = ['All', 'Article', 'Discussion', 'News', 'Research', 'Tool', 'Other'];
  
  // Filter discoveries by type and search term
  const filteredDiscoveries = discoveries.filter(discovery => {
    const matchesSearch = 
      discovery.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      discovery.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      discovery.categories.some(category => category.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // If "All" tab is selected or the discovery type matches the selected tab
    const matchesType = tabValue === 0 || discovery.type === discoveryTypes[tabValue];
    
    return matchesSearch && matchesType;
  });
  
  // Get paginated discoveries for the current tab
  const paginatedDiscoveries = filteredDiscoveries.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  
  // Group discoveries by type for the "All" tab
  const groupedDiscoveries = discoveryTypes.slice(1).map(type => {
    const typeDiscoveries = discoveries.filter(d => 
      d.type === type && 
      (d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
       d.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
       d.categories.some(category => category.toLowerCase().includes(searchTerm.toLowerCase())))
    );
    
    return {
      type,
      items: typeDiscoveries, // Store all items, we'll slice when rendering
      totalCount: typeDiscoveries.length
    };
  }).filter(group => group.items.length > 0);

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
        
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="scrollable"
          scrollButtons="auto"
          aria-label="discovery type tabs"
          sx={{ mb: 2 }}
        >
          {discoveryTypes.map((type, index) => (
            <Tab key={type} label={type} id={`discovery-tab-${index}`} aria-controls={`discovery-tabpanel-${index}`} />
          ))}
        </Tabs>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {discoveries.length === 0 ? (
          <Alert severity="info">
            No discoveries found yet. Try triggering a search to find relevant tools and resources.
          </Alert>
        ) : (
          <>
            {/* All Tab */}
            <TabPanel value={tabValue} index={0}>
              {groupedDiscoveries.length === 0 ? (
                <Alert severity="info">
                  No discoveries match your search criteria.
                </Alert>
              ) : (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
                      <InputLabel id="rows-per-page-label">Items per category</InputLabel>
                      <Select
                        labelId="rows-per-page-label"
                        value={rowsPerPage}
                        onChange={handleSelectRowsPerPage}
                        label="Items per category"
                      >
                        <MenuItem value={3}>3</MenuItem>
                        <MenuItem value={5}>5</MenuItem>
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={20}>20</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  
                  {groupedDiscoveries.map((group) => (
                    <Box key={group.type} sx={{ mb: 4 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="h6" component="h2">
                          {group.type}
                        </Typography>
                        {group.totalCount > rowsPerPage && (
                          <Button 
                            size="small" 
                            onClick={() => setTabValue(discoveryTypes.indexOf(group.type))}
                          >
                            View All ({group.totalCount})
                          </Button>
                        )}
                      </Box>
                      <Grid container spacing={3}>
                        {group.items.slice(0, rowsPerPage).map((discovery) => (
                          <Grid item xs={12} md={4} key={discovery._id}>
                            <Card variant="outlined">
                              <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <Typography variant="h6" component="h2" gutterBottom>
                                    {discovery.title}
                                  </Typography>
                                </Box>
                                
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                  <Rating
                                    value={discovery.relevanceScore / 2}
                                    precision={0.5}
                                    readOnly
                                    size="small"
                                    max={5}
                                  />
                                </Box>
                                
                                <Typography variant="body2" color="text.secondary" paragraph>
                                  {discovery.description.length > 150 
                                    ? `${discovery.description.substring(0, 150)}...` 
                                    : discovery.description}
                                </Typography>
                                
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                                  {discovery.categories.slice(0, 2).map((category, index) => (
                                    <Chip key={index} label={category} size="small" />
                                  ))}
                                </Box>
                                
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {new Date(discovery.discoveredAt).toLocaleDateString()}
                                  </Typography>
                                </Box>
                              </CardContent>
                              <CardActions>
                                <Button 
                                  size="small" 
                                  onClick={() => window.open(discovery.source, '_blank')}
                                  endIcon={<OpenInNewIcon />}
                                >
                                  View Source
                                </Button>
                                <Button 
                                  size="small" 
                                  onClick={() => handleFeedbackClick(discovery)}
                                >
                                  Provide Feedback
                                </Button>
                              </CardActions>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  ))}
                </>
              )}
            </TabPanel>
            
            {/* Type-specific tabs */}
            {discoveryTypes.slice(1).map((type, index) => (
              <TabPanel key={type} value={tabValue} index={index + 1}>
                {filteredDiscoveries.length === 0 ? (
                  <Alert severity="info">
                    No {type.toLowerCase()} discoveries match your search criteria.
                  </Alert>
                ) : (
                  <>
                    <Grid container spacing={3}>
                      {paginatedDiscoveries.map((discovery) => (
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
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Discovered: {new Date(discovery.discoveredAt).toLocaleDateString()}
                              </Typography>
                              
                              {discovery.publicationDate && (
                                <Chip 
                                  label={`Published: ${new Date(discovery.publicationDate).toLocaleDateString()}`}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem' }}
                                />
                              )}
                            </Box>
                            
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
                    
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                      <TablePagination
                        component="div"
                        count={filteredDiscoveries.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        labelRowsPerPage="Discoveries per page:"
                      />
                    </Box>
                  </>
                )}
              </TabPanel>
            ))}
          </>
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