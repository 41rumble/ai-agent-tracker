const AgentType = require('../models/AgentType');

const agentTypeController = {
  /**
   * Get all agent types
   */
  getAgentTypes: async (req, res) => {
    try {
      const agentTypes = await AgentType.find({ active: true });
      res.json(agentTypes);
    } catch (error) {
      console.error('Error getting agent types:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  /**
   * Get agent type by ID
   */
  getAgentTypeById: async (req, res) => {
    try {
      const agentType = await AgentType.findById(req.params.id);
      if (!agentType) {
        return res.status(404).json({ message: 'Agent type not found' });
      }
      res.json(agentType);
    } catch (error) {
      console.error('Error getting agent type:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  /**
   * Create a new agent type
   */
  createAgentType: async (req, res) => {
    try {
      const { name, description, domain, capabilities, searchStrategy, promptTemplate, evaluationCriteria } = req.body;

      // Check if agent type with the same name already exists
      const existingAgentType = await AgentType.findOne({ name });
      if (existingAgentType) {
        return res.status(400).json({ message: 'Agent type with this name already exists' });
      }

      const newAgentType = new AgentType({
        name,
        description,
        domain,
        capabilities,
        searchStrategy,
        promptTemplate,
        evaluationCriteria
      });

      const agentType = await newAgentType.save();
      res.status(201).json(agentType);
    } catch (error) {
      console.error('Error creating agent type:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  /**
   * Update an agent type
   */
  updateAgentType: async (req, res) => {
    try {
      const { name, description, domain, capabilities, searchStrategy, promptTemplate, evaluationCriteria, active } = req.body;

      // Check if agent type exists
      const agentType = await AgentType.findById(req.params.id);
      if (!agentType) {
        return res.status(404).json({ message: 'Agent type not found' });
      }

      // Update fields
      if (name) agentType.name = name;
      if (description) agentType.description = description;
      if (domain) agentType.domain = domain;
      if (capabilities) agentType.capabilities = capabilities;
      if (searchStrategy) agentType.searchStrategy = searchStrategy;
      if (promptTemplate) agentType.promptTemplate = promptTemplate;
      if (evaluationCriteria) agentType.evaluationCriteria = evaluationCriteria;
      if (active !== undefined) agentType.active = active;

      const updatedAgentType = await agentType.save();
      res.json(updatedAgentType);
    } catch (error) {
      console.error('Error updating agent type:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  /**
   * Delete an agent type
   */
  deleteAgentType: async (req, res) => {
    try {
      const agentType = await AgentType.findById(req.params.id);
      if (!agentType) {
        return res.status(404).json({ message: 'Agent type not found' });
      }

      await agentType.remove();
      res.json({ message: 'Agent type removed' });
    } catch (error) {
      console.error('Error deleting agent type:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = agentTypeController;