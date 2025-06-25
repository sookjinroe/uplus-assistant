/*
  # Add playground data columns to chat_sessions table

  1. New Columns
    - `playground_main_prompt_content` (text, nullable) - Stores the main prompt content used in this session
    - `playground_knowledge_base_snapshot` (jsonb, nullable) - Stores the knowledge base items snapshot as JSON array

  2. Purpose
    - Allow administrators to save playground configurations per chat session
    - Enable tracking of which prompt/knowledge base was used for each conversation
    - Support debugging and analysis of different prompt configurations
*/

-- Add playground data columns to chat_sessions table
DO $$
BEGIN
  -- Add playground_main_prompt_content column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_sessions' 
    AND column_name = 'playground_main_prompt_content'
  ) THEN
    ALTER TABLE chat_sessions 
    ADD COLUMN playground_main_prompt_content text;
  END IF;

  -- Add playground_knowledge_base_snapshot column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chat_sessions' 
    AND column_name = 'playground_knowledge_base_snapshot'
  ) THEN
    ALTER TABLE chat_sessions 
    ADD COLUMN playground_knowledge_base_snapshot jsonb;
  END IF;
END $$;

-- Add index for playground data queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_playground_data 
ON chat_sessions(playground_main_prompt_content) 
WHERE playground_main_prompt_content IS NOT NULL;