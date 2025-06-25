/*
  # Initialize main prompt

  1. New Records
    - Insert default main prompt record if it doesn't exist
  
  2. Purpose
    - Ensures the application has a main prompt to work with
    - Prevents "no rows returned" errors when fetching main prompt
*/

-- Insert default main prompt if it doesn't exist
INSERT INTO prompts_and_knowledge_base (name, content, type, order_index)
SELECT 
  'main_prompt',
  'You are Claude, a helpful AI assistant created by Anthropic. Please respond naturally and helpfully to the user''s questions.',
  'main_prompt',
  0
WHERE NOT EXISTS (
  SELECT 1 FROM prompts_and_knowledge_base 
  WHERE type = 'main_prompt' AND name = 'main_prompt'
);