import { GoogleGenAI } from "@google/genai";

// ✅ No module-level client — lazy init per call to avoid cold-start crashes
let aiInstance: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

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

// ✅ Always returns a valid client or throws a clear error
function getAiClient(): GoogleGenAI {
  const apiKey = process.env.BRAIN_REPS_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "API Key missing. Set BRAIN_REPS_API_KEY in Vercel Dashboard → Settings → Environment Variables, then redeploy."
    );
  }

  // ✅ Re-initialize if key changed (e.g. between hot reloads)
  if (!aiInstance || currentApiKey !== apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
    currentApiKey = apiKey;
  }

  return aiInstance;
}

export async function askHandoutAssistant(
  query: string,
  sources: ContextSource[],
  history: HandoutMessage[] = []
) {
  // ── Client-side: proxy through backend ──
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
        const errorData = await response.clone().json();
        errorMsg = errorData.error || errorMsg;
        detailedReason = errorData.details || '';
      } catch {
        const text = await response.text().catch(() => '');
        if (text) detailedReason = text.substring(0, 300);
      }

      const fullError = detailedReason
        ? `${errorMsg} [Detail: ${detailedReason}]`
        : errorMsg;

      console.error("[Neural Client] Sync Error:", fullError);
      throw new Error(fullError);
    }

    const data = await response.json();
    return data.text;
  }

  // ── Server-side: call Gemini directly ──
  const client = getAiClient(); // ✅ Throws clear error if key missing

  // ✅ FIXED: correct model name — gemini-2.5-flash-preview-04-17
  // gemini-2.5-flash does not exist as a standalone ID and causes 404/500
  const modelName = "gemini-2.5-flash-preview-04-17";

  const context = sources.length > 0
    ? sources.map(s => `[${s.type.toUpperCase()}: ${s.title}]:\n${s.content}`).join('\n\n')
    : "No context sources provided.";

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
  `.trim();

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

  console.log(`[Neural Core] Sending request → model: ${modelName}`);

  try {
    const response = await client.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    const text = response.text;

    if (!text) {
      console.warn("[Neural Core] Empty response from Gemini.");
      return "I was unable to generate a response. Please try again.";
    }

    return text;

  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error("[Neural Core] Generation failed:", { model: modelName, error: errorMsg });

    // ✅ Specific error hints for easier debugging
    if (errorMsg.includes("404") || errorMsg.includes("not found")) {
      throw new Error(
        `Model '${modelName}' not found. Check https://ai.google.dev/gemini-api/docs/models for available models.`
      );
    }
    if (errorMsg.includes("403") || errorMsg.includes("API_KEY")) {
      throw new Error(
        "Invalid or unauthorized API key. Verify BRAIN_REPS_API_KEY in Vercel environment variables."
      );
    }
    if (errorMsg.includes("quota") || errorMsg.includes("429")) {
      throw new Error(
        "API quota exceeded. Check your usage at https://aistudio.google.com"
      );
    }

    throw new Error(`Neural sync failed: ${errorMsg}`);
  }
}