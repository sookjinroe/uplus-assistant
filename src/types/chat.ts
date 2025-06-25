export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export interface KnowledgeBaseItem {
  id: string;
  name: string;
  content: string;
  order_index: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  playgroundMainPromptContent?: string;
  playgroundKnowledgeBaseSnapshot?: KnowledgeBaseItem[];
}

export interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  isStreamingContent: boolean;
  error: string | null;
}

// 데이터베이스 타입 정의
export interface DbChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  playground_main_prompt_content?: string;
  playground_knowledge_base_snapshot?: KnowledgeBaseItem[];
}

export interface DbChatMessage {
  id: string;
  session_id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
}