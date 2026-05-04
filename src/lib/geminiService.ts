import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

export interface HandoutMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ContextSource {
  title: string;
  content: string;
  type: 'handout' | 'quiz';
  subject?: string;
}

export async function askHandoutAssistant(
  query: string,
  sources: ContextSource[],
  history: HandoutMessage[] = []
) {
  // Client-side execution: Proxy through backend
  if (typeof window !== 'undefined') {
    const response = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, sources, history })
    });
    
    if (!response.ok) {
      let errorMsg = `Neural synchronization failed (${response.status})`;
      let detailedReason = '';
      
      try {
        const clonedResponse = response.clone();
        const errorData = await clonedResponse.json();
        detailedReason = errorData.details || '';
        errorMsg = errorData.error ? `${errorData.error}` : errorMsg;
      } catch (e) {
        // If JSON parsing fails, try to get raw text from the original response
        const text = await response.text().catch(() => '');
        if (text) {
          detailedReason = text.substring(0, 300);
          // If the text contains information about missing keys, bubble it up
          if (text.includes("BRAIN_REPS_API_KEY")) {
            errorMsg = "Neural Core Configuration Missing";
          }
        }
      }
      
      const fullError = detailedReason ? `${errorMsg} [Detail: ${detailedReason}]` : errorMsg;
      console.error("[Gemini Client] Sync Error:", fullError);
      throw new Error(fullError);
    }
    
    const data = await response.json();
    return data.text;
  }

  // Server-side execution: Direct call to Gemini
  const HARDCODED_API_KEY = ''; 
  const apiKey = HARDCODED_API_KEY || process.env.BRAIN_REPS_API_KEY;
  
  if (!apiKey) {
    console.error("[Neural Core] Critical: No API Key found in process.env.BRAIN_REPS_API_KEY and HARDCODED_API_KEY is empty.");
    throw new Error("Neural Core initialization failed: API Key missing. Please ensure BRAIN_REPS_API_KEY is set in your environment variables/secrets.");
  }

  // Ensure we are using a fresh instance if it's the first time or key changed
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }

  // Standard model selection
  // Note: gemini-2.5-flash does not exist. Use gemini-1.5-flash or gemini-2.0-flash
  const model = "gemini-2.5-flash"; 
  
  // Format context from sources
  const context = sources.map(s => `[${s.type.toUpperCase()}: ${s.title}]: ${s.content}`).join('\n');

  console.log(`[Neural Core] Generating content. Model: ${model}. Query: ${query.substring(0, 50)}...`);

  if (!apiKey || apiKey.length < 5) {
    console.error("[Neural Core] Critical: No BRAIN_REPS_API_KEY set.");
    throw new Error("Neural Core Configuration Missing: BRAIN_REPS_API_KEY environment variable is not set. If on Vercel, check Project Settings -> Environment Variables.");
  }

  const systemInstruction = `
    You are the BrainReps Neural Assistant. 
    
    CONTEXT (Filtered Knowledge Sources):
    ${context}
    
    STRICT GUIDELINES:
    1. Be highly concise. Answer in 1-3 sentences maximum.
    2. Only elaborate if the student explicitly asks to "explain in detail" or "elaborate".
    3. Use the provided CONTEXT as your primary source of truth.
    4. If the question is about specific quiz questions or handouts in the context, refer to them explicitly.
    5. Format: Use bold for key terms. Avoid long intros or outros.
  `;

  const contents = [
    ...history.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    })),
    {
      role: 'user',
      parts: [{ text: query }]
    }
  ];

  try {
    const modelInstance = genAI.getGenerativeModel({ 
      model,
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemInstruction }]
      }
    });

    const result = await modelInstance.generateContent({
      contents,
      generationConfig: {
        temperature: 0.7,
      }
    });

    const response = await result.response;
    const text = response.text();

    console.log(`[Neural Core] Generation successful. Character count: ${text?.length || 0}`);

    if (!text) {
      console.warn("[Neural Core] Response received but text field is empty.");
      return "I was unable to synchronize with the neural core. Please try again.";
    }

    return text;
  } catch (error: any) {
    console.error("[Neural Core] Detailed Sync Failure:", {
      message: error.message,
      stack: error.stack,
      status: error.status,
      model: model,
      apiKeyPrefix: apiKey ? `${apiKey.substring(0, 5)}...` : 'None'
    });
    
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes("model") || errorMsg.includes("404")) {
      throw new Error(`Neural core rejected model '${model}'. It may be restricted or incorrectly identified. Error: ${errorMsg}`);
    }
    
    if (errorMsg.includes("API key")) {
      throw new Error("Invalid BrainReps API Key detected by neural core. Please verify your secrets.");
    }

    throw new Error(`Neural sync failed: ${errorMsg}`);
  }
}
