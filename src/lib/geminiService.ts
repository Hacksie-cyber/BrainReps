import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

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

/**
 * BrainReps Neural Core
 * Handles synchronization between educational materials and the generative assistant.
 * 
 * NOTE: Per user request, the model is prepared for "Gemini 2.5 Flash" but 
 * remains on the current stable version until explicit confirmation is received.
 */
export async function askHandoutAssistant(
  query: string,
  sources: ContextSource[],
  history: HandoutMessage[] = []
) {
  // Client-side execution: Proxy through backend to protect neural core keys
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
        const text = await response.text().catch(() => '');
        if (text) {
          detailedReason = text.substring(0, 300);
          if (text.includes("BRAIN_REPS_API_KEY")) {
            errorMsg = "Neural Core Configuration Missing";
          }
        }
      }
      
      const fullError = detailedReason ? `${errorMsg} [Detail: ${detailedReason}]` : errorMsg;
      console.error("[Neural Client] Sync Error:", fullError);
      throw new Error(fullError);
    }
    
    const data = await response.json();
    return data.text;
  }

  // Server-side execution: Direct interaction with Gemini
  const apiKey = process.env.BRAIN_REPS_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("[Neural Core] Critical: No API Key found.");
    throw new Error("Neural Core initialization failed: API Key missing. Please ensure BRAIN_REPS_API_KEY is set.");
  }

  // Lazy initialization of the GenAI client
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }

  /**
   * MODEL CONFIGURATION
   * Current: gemini-1.5-flash
   * Requested: gemini-2.0-flash (interpreted from 'gemine 2.5 flash')
   * STATUS: PENDING USER CONFIRMATION
   */
  const modelName = "gemini-2.5-flash"; 
  
  const context = sources.map(s => `[${s.type.toUpperCase()}: ${s.title}]: ${s.content}`).join('\n');

  console.log(`[Neural Core] Generating content with model: ${modelName}`);

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
      role: m.role,
      parts: [{ text: m.content }]
    })),
    {
      role: 'user' as const,
      parts: [{ text: query }]
    }
  ];

  try {
    const response = await aiInstance.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    const text = response.text;

    if (!text) {
      console.warn("[Neural Core] Response received but text field is empty.");
      return "I was unable to synchronize with the neural core. Please try again.";
    }

    return text;
  } catch (error: any) {
    console.error("[Neural Core] Detailed Sync Failure:", {
      message: error.message,
      model: modelName,
    });
    
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes("model") || errorMsg.includes("404")) {
      throw new Error(`Neural core rejected model '${modelName}'. Error: ${errorMsg}`);
    }

    throw new Error(`Neural sync failed: ${errorMsg}`);
  }
}
