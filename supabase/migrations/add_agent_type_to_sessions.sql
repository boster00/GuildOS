-- Add agent_type column to agent_sessions table
-- This allows all agents to use the same table, differentiated by type

ALTER TABLE agent_sessions 
ADD COLUMN IF NOT EXISTS agent_type TEXT DEFAULT 'general';

-- Create index for agent_type for better query performance
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_type ON agent_sessions(agent_type);

-- Update existing rows to have a default type
UPDATE agent_sessions SET agent_type = 'general' WHERE agent_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN agent_sessions.agent_type IS 'Type of agent using this session (e.g., clarification_questions, write_article, general)';
