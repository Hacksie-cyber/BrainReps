import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Neural synchronization failed (${response.status})`);
    }
    
    const data = await response.json();
    return data.text;
  }

  // Server-side execution: Direct call to Gemini
  const apiKey = process.env.BRAIN_REPS_API_KEY;
  if (!apiKey) {
    console.error("[Neural Core] CRITICAL: BRAIN_REPS_API_KEY is missing in server environment.");
    throw new Error("Missing AI API Key on server. Please verify BRAIN_REPS_API_KEY is added to the Secrets panel in Settings.");
  }

  if (!genAI) {
    console.log("[Neural Core] Initializing Generative AI with BRAIN_REPS_API_KEY.");
    genAI = new GoogleGenAI({ apiKey });
  }

  const model = "gemini-3-flash-preview";
  
  // Format context from sources
  const context = sources.map(s => `[${s.type.toUpperCase()}: ${s.title}]: ${s.content}`).join('\n');

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
    const response = await genAI.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "I was unable to synchronize with the neural core. Please try again.";
  } catch (error: any) {
    console.error("Gemini Assistant Sync Failure:", error);
    throw error;
  }
}
