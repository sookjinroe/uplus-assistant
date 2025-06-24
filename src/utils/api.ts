// Claude Sonnet 4 API integration via Edge Function proxy
export interface ApiOptions {
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface StreamCallback {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export const generateResponse = async (
  messages: Array<{role: 'user' | 'assistant', content: string}>,
  options: ApiOptions = {}
): Promise<string> => {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Claude API key not found. Please set VITE_CLAUDE_API_KEY in your environment variables.'
    );
  }

  try {
    // Use the Edge Function proxy instead of direct API call
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`;
    
    const requestBody = {
      messages,
      apiKey,
      stream: options.stream || false,
    };

    console.log('Claude Sonnet 4 API Request:', {
      messageCount: messages.length,
      streaming: options.stream || false
    });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Proxy request failed: ${response.status} ${response.statusText}. ${errorData.error || ''}`);
    }

    const data = await response.json();
    
    // 토큰 사용량 로깅 (개발 환경에서만)
    if (import.meta.env.DEV && data.usage) {
      console.log('Claude Sonnet 4 Token Usage:', {
        input: data.usage.input_tokens,
        output: data.usage.output_tokens,
        total: data.usage.input_tokens + data.usage.output_tokens,
        model: data.model
      });
    }
    
    return data.content;
  } catch (error) {
    console.error('Claude Sonnet 4 API Error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to get response from Claude Sonnet 4 API');
  }
};

// Helper function to check if an error is an abort error
const isAbortError = (error: any): boolean => {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    error.name === 'AbortError' ||
    error.message === 'Request was aborted' ||
    error.message?.toLowerCase().includes('aborted') ||
    error.message?.toLowerCase().includes('bodystreamBuffer was aborted')
  );
};

// 스트리밍 응답을 위한 함수 (AbortSignal 지원)
export const generateStreamingResponse = async (
  messages: Array<{role: 'user' | 'assistant', content: string}>,
  callback: StreamCallback,
  signal?: AbortSignal
): Promise<void> => {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;

  if (!apiKey) {
    callback.onError(new Error('Claude API key not found. Please set VITE_CLAUDE_API_KEY in your environment variables.'));
    return;
  }

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`;
    
    const requestBody = {
      messages,
      apiKey,
      stream: true,
    };

    console.log('Claude Sonnet 4 Streaming Request:', {
      messageCount: messages.length
    });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal, // AbortSignal 추가
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      callback.onError(new Error(`Proxy request failed: ${response.status} ${response.statusText}. ${errorData.error || ''}`));
      return;
    }

    if (!response.body) {
      callback.onError(new Error('No response body received'));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        // AbortSignal 체크
        if (signal?.aborted) {
          console.log('Request was aborted by user');
          callback.onComplete();
          break;
        }

        const { done, value } = await reader.read();
        
        if (done) {
          callback.onComplete();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              callback.onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                callback.onChunk(parsed.delta.text);
              }
            } catch (parseError) {
              // JSON 파싱 에러는 무시 (일부 이벤트는 파싱할 필요 없음)
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    // AbortError는 사용자가 의도적으로 중단한 것이므로 에러로 처리하지 않음
    if (isAbortError(error)) {
      console.log('Request was aborted by user');
      callback.onComplete();
      return;
    }
    
    console.error('Claude Sonnet 4 Streaming Error:', error);
    callback.onError(error instanceof Error ? error : new Error('Failed to get streaming response from Claude Sonnet 4 API'));
  }
};

// 시스템 프롬프트를 가져오는 함수 (에러 처리 개선)
export const fetchSystemPrompt = async (): Promise<string> => {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-system-prompt`;
    
    console.log('Fetching system prompt...');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`System prompt request failed: ${response.status} ${response.statusText}. ${errorData.error || ''}`);
    }

    const data = await response.json();
    
    console.log('System prompt fetched:', {
      length: data.promptLength,
      timestamp: data.timestamp
    });
    
    return data.systemPrompt;
  } catch (error) {
    console.error('System Prompt Fetch Error:', error);
    
    // 네트워크 오류나 서버 오류 시 기본 프롬프트 반환
    if (error instanceof Error && (
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('500') ||
      error.message.includes('502') ||
      error.message.includes('503')
    )) {
      console.log('🔧 네트워크 오류로 인해 기본 프롬프트 사용');
      return "You are Claude, a helpful AI assistant created by Anthropic. Please respond naturally and helpfully to the user's questions.";
    }
    
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch system prompt');
  }
};