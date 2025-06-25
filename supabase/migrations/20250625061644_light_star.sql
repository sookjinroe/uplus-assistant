/*
  # Add playground data columns to chat_sessions table

  1. New Columns
    - `playground_main_prompt_content` (text, nullable) - Stores the main prompt content used in this session
    - `playground_knowledge_base_snapshot` (jsonb, nullable) - Stores the knowledge base items snapshot as JSON array

  2. Purpose
    - Allow administrators to save playground configurations per chat session
    - Enable tracking of which prompt/knowledge base was used for each conversation
    - Support debugging and analysis of different prompt configurations

  3. Indexes
    - Add performance index for playground data queries
*/

-- Add playground_main_prompt_content column
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS playground_main_prompt_content text;

-- Add playground_knowledge_base_snapshot column
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS playground_knowledge_base_snapshot jsonb;

-- Add index for playground data queries (for performance)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_playground_data 
ON chat_sessions(playground_main_prompt_content) 
WHERE playground_main_prompt_content IS NOT NULL;

-- Add index for updated_at column for better session ordering performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at 
ON chat_sessions(updated_at DESC);

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'chat_sessions'
ORDER BY ordinal_position;