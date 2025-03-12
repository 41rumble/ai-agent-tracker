import React from 'react';
import {
  Box, Paper, Typography, Divider
} from '@mui/material';
import {
  Timeline, TimelineItem, TimelineSeparator, 
  TimelineConnector, TimelineContent, TimelineDot,
  TimelineOppositeContent
} from '@mui/lab';

interface ProjectTimelineProps {
  milestones: any[];
  discoveries: any[];
  contextEntries: any[];
}

// Define the TimelineItem interface
interface TimelineItemType {
  type: 'milestone' | 'discovery' | 'context';
  title: string;
  date: Date;
  achieved?: boolean;
  contextType?: string;
  data: any;
}

// Helper function to combine and sort timeline items
const createTimelineItems = (milestones: any[], discoveries: any[], contextEntries: any[]): TimelineItemType[] => {
  const items: TimelineItemType[] = [];
  
  // Add milestones
  if (milestones && Array.isArray(milestones)) {
    milestones.forEach(milestone => {
      if (milestone.date) {
        items.push({
          type: 'milestone',
          title: milestone.description,
          date: new Date(milestone.date),
          achieved: milestone.achieved,
          data: milestone
        });
      }
    });
  }
  
  // Add key discoveries (top 5 by relevance)
  if (discoveries && Array.isArray(discoveries)) {
    discoveries
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5)
      .forEach(discovery => {
        items.push({
          type: 'discovery',
          title: discovery.title,
          date: new Date(discovery.discoveredAt),
          data: discovery
        });
      });
  }
  
  // Add important context entries (milestones, feedback)
  if (contextEntries && Array.isArray(contextEntries)) {
    contextEntries
      .filter(entry => ['milestone', 'feedback'].includes(entry.type))
      .forEach(entry => {
        items.push({
          type: 'context',
          title: entry.content.substring(0, 50) + (entry.content.length > 50 ? '...' : ''),
          date: new Date(entry.timestamp),
          contextType: entry.type,
          data: entry
        });
      });
  }
  
  // Sort by date
  return items.sort((a, b) => b.date.getTime() - a.date.getTime());
};

const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ 
  milestones = [], 
  discoveries = [], 
  contextEntries = [] 
}) => {
  const timelineItems = createTimelineItems(milestones, discoveries, contextEntries);
  
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Project Timeline</Typography>
      
      <Divider sx={{ mb: 2 }} />
      
      <Timeline position="right">
        {timelineItems.map((item, index) => (
          <TimelineItem key={index}>
            <TimelineOppositeContent sx={{ flex: 0.2 }}>
              <Typography variant="caption" color="text.secondary">
                {item.date.toLocaleDateString()}
              </Typography>
            </TimelineOppositeContent>
            <TimelineSeparator>
              <TimelineDot 
                color={
                  item.type === 'milestone' 
                    ? (item.achieved ? 'success' : 'grey') 
                    : item.type === 'discovery' 
                      ? 'primary' 
                      : 'secondary'
                }
                variant={item.type === 'milestone' && !item.achieved ? 'outlined' : 'filled'}
              />
              {index < timelineItems.length - 1 && <TimelineConnector />}
            </TimelineSeparator>
            <TimelineContent>
              <Typography variant="body2" component="span" fontWeight="bold">
                {item.type === 'milestone' ? '🏆 ' : 
                 item.type === 'discovery' ? '🔍 ' : 
                 item.contextType === 'feedback' ? '👍 ' : '📝 '}
                {item.title}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                {item.type === 'milestone' ? 'Milestone' : 
                 item.type === 'discovery' ? `Discovery (${item.data.type})` : 
                 item.contextType === 'feedback' ? 'Feedback' : 'Update'}
              </Typography>
            </TimelineContent>
          </TimelineItem>
        ))}
        
        {timelineItems.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No timeline events yet. Add milestones or trigger searches to populate the timeline.
          </Typography>
        )}
      </Timeline>
    </Paper>
  );
};

export default ProjectTimeline;