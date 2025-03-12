import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { apiService } from '../../services/api';

interface Schedule {
  _id: string;
  projectId: string;
  taskType: 'search' | 'summarize' | 'update';
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  lastRun: string | null;
  nextRun: string;
  active: boolean;
  parameters: Record<string, any>;
  createdAt: string;
}

interface ScheduleListProps {
  projectId: string;
}

const ScheduleList: React.FC<ScheduleListProps> = ({ projectId }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [taskType, setTaskType] = useState<'search' | 'summarize' | 'update'>('search');
  const [frequency, setFrequency] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    fetchSchedules();
  }, [projectId]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const response = await apiService.getSchedules(projectId);
      setSchedules(response.data);
      setError('');
    } catch (err: any) {
      setError('Failed to load schedules. Please try again.');
      console.error('Error fetching schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (scheduleId: string, currentActive: boolean) => {
    try {
      await apiService.updateSchedule(scheduleId, { active: !currentActive });
      setSchedules(schedules.map(schedule => 
        schedule._id === scheduleId 
          ? { ...schedule, active: !currentActive } 
          : schedule
      ));
    } catch (err: any) {
      setError('Failed to update schedule. Please try again.');
      console.error('Error updating schedule:', err);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      await apiService.deleteSchedule(scheduleId);
      setSchedules(schedules.filter(schedule => schedule._id !== scheduleId));
    } catch (err: any) {
      setError('Failed to delete schedule. Please try again.');
      console.error('Error deleting schedule:', err);
    }
  };

  const handleOpenDialog = (schedule?: Schedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setTaskType(schedule.taskType);
      setFrequency(schedule.frequency);
    } else {
      setEditingSchedule(null);
      setTaskType('search');
      setFrequency('daily');
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSchedule(null);
  };

  const handleTaskTypeChange = (event: SelectChangeEvent) => {
    setTaskType(event.target.value as 'search' | 'summarize' | 'update');
  };

  const handleFrequencyChange = (event: SelectChangeEvent) => {
    setFrequency(event.target.value as 'hourly' | 'daily' | 'weekly' | 'monthly');
  };

  const handleSaveSchedule = async () => {
    try {
      const scheduleData = {
        projectId,
        taskType,
        frequency,
        parameters: {}
      };
      
      if (editingSchedule) {
        await apiService.updateSchedule(editingSchedule._id, scheduleData);
        setSchedules(schedules.map(schedule => 
          schedule._id === editingSchedule._id 
            ? { ...schedule, ...scheduleData } 
            : schedule
        ));
      } else {
        const response = await apiService.createSchedule(scheduleData);
        setSchedules([...schedules, response.data]);
      }
      
      handleCloseDialog();
    } catch (err: any) {
      setError('Failed to save schedule. Please try again.');
      console.error('Error saving schedule:', err);
    }
  };

  const getTaskTypeLabel = (type: string) => {
    switch (type) {
      case 'search': return 'Search for Updates';
      case 'summarize': return 'Generate Summary';
      case 'update': return 'Update Project Status';
      default: return type;
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'hourly': return 'Every Hour';
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      default: return freq;
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
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">
            Scheduled Tasks
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Schedule
          </Button>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {schedules.length === 0 ? (
          <Alert severity="info">
            No scheduled tasks found. Create a schedule to automate searches and updates.
          </Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Task Type</TableCell>
                  <TableCell>Frequency</TableCell>
                  <TableCell>Next Run</TableCell>
                  <TableCell>Last Run</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule._id}>
                    <TableCell>{getTaskTypeLabel(schedule.taskType)}</TableCell>
                    <TableCell>{getFrequencyLabel(schedule.frequency)}</TableCell>
                    <TableCell>{new Date(schedule.nextRun).toLocaleString()}</TableCell>
                    <TableCell>
                      {schedule.lastRun ? new Date(schedule.lastRun).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={schedule.active}
                        onChange={() => handleToggleActive(schedule._id, schedule.active)}
                        color="primary"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        onClick={() => handleOpenDialog(schedule)}
                        aria-label="edit"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDelete(schedule._id)}
                        aria-label="delete"
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      
      <Dialog open={dialogOpen} onClose={handleCloseDialog}>
        <DialogTitle>
          {editingSchedule ? 'Edit Schedule' : 'Create Schedule'}
        </DialogTitle>
        <DialogContent sx={{ minWidth: 400 }}>
          <Box sx={{ mt: 1 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="task-type-label">Task Type</InputLabel>
              <Select
                labelId="task-type-label"
                id="task-type"
                value={taskType}
                label="Task Type"
                onChange={handleTaskTypeChange}
              >
                <MenuItem value="search">Search for Updates</MenuItem>
                <MenuItem value="summarize">Generate Summary</MenuItem>
                <MenuItem value="update">Update Project Status</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth margin="normal">
              <InputLabel id="frequency-label">Frequency</InputLabel>
              <Select
                labelId="frequency-label"
                id="frequency"
                value={frequency}
                label="Frequency"
                onChange={handleFrequencyChange}
              >
                <MenuItem value="hourly">Every Hour</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveSchedule} 
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScheduleList;