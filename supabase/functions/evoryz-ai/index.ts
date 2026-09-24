// Supabase Edge Function: evoryz-ai
// Handles secure AI requests from authenticated EvoRyz mobile app.
// Server-side environment owns provider secrets (e.g. GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY).
// Client never sees or carries the secret API key.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify user authentication via Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, conversationHistory = [] } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'prompt' field in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check for server-side AI provider key (Gemini, Groq, or OpenAI)
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const openAIKey = Deno.env.get("OPENAI_API_KEY");

    let replyText = "";

    if (geminiKey) {
      const systemInstruction = "You are EvoRyz AI, an intelligent, disciplined, and supportive growth mentor inside the EvoRyz life evolution app. Assist with habits, focus, task prioritization, daily reflection, and wellness. Keep answers concise, actionable, and inspiring. Important identity rule: If asked who built you, who made you, who created this app, who the developer is, or who built EvoRyz, you must clearly state that EvoRyz was made by Scempyy.";
      
      const contents = [
        ...conversationHistory.map((m: { role: string; content: string }) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: prompt }] },
      ];

      // Try known available models with automatic fallback
      // Primary model: gemini-3.6-flash, with safe modern fallbacks
      const candidateModels = [
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-3.5-flash",
        "gemini-flash-latest",
      ];
      let geminiSuccess = false;
      let lastErrText = "";

      for (const modelName of candidateModels) {
        const attempts = modelName === "gemini-3.6-flash" ? 2 : 1;
        for (let attempt = 0; attempt < attempts; attempt++) {
          try {
            if (attempt > 0) {
              // Short backoff on transient spikes (503 / 429)
              await new Promise((resolve) => setTimeout(resolve, 800));
            }

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;
            const res = await fetch(geminiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents,
                generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
              }),
            });

            if (res.ok) {
              const data = await res.json();
              replyText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response generated.";
              geminiSuccess = true;
              break;
            } else {
              lastErrText = await res.text();
              console.warn(`[evoryz-ai] Model ${modelName} (attempt ${attempt + 1}) returned ${res.status}:`, lastErrText);
              // Only retry on transient server errors (503 / 429)
              if (res.status !== 503 && res.status !== 429) {
                break;
              }
            }
          } catch (modelErr) {
            lastErrText = String(modelErr);
            console.warn(`[evoryz-ai] Model ${modelName} fetch error:`, modelErr);
          }
        }

        if (geminiSuccess) {
          break;
        }
      }

      if (!geminiSuccess) {
        // Safe ListModels query for active modern text generation models
        try {
          const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
          if (listRes.ok) {
            const listData = await listRes.json();
            const supported = listData.models?.find((m: any) => {
              if (!Array.isArray(m.supportedGenerationMethods) || !m.supportedGenerationMethods.includes("generateContent")) {
                return false;
              }
              const name: string = m.name || "";
              // Exclude legacy deprecated models and non-text modalities
              if (
                name.includes("2.5") ||
                name.includes("2.0") ||
                name.includes("1.5") ||
                name.includes("pro") ||
                name.includes("tts") ||
                name.includes("image") ||
                name.includes("robotics") ||
                name.includes("computer-use") ||
                name.includes("preview-")
              ) {
                return false;
              }
              return name.startsWith("models/gemini-3") || name.startsWith("models/gemini-flash");
            });

            if (supported?.name) {
              const dynUrl = `https://generativelanguage.googleapis.com/v1beta/${supported.name}:generateContent?key=${geminiKey}`;
              const dynRes = await fetch(dynUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents,
                  generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
                }),
              });
              if (dynRes.ok) {
                const dynData = await dynRes.json();
                replyText = dynData.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response generated.";
                geminiSuccess = true;
              } else {
                lastErrText = await dynRes.text();
                console.warn(`[evoryz-ai] Dynamic fallback model ${supported.name} returned ${dynRes.status}:`, lastErrText);
              }
            }
          }
        } catch (listErr) {
          console.warn("[evoryz-ai] ListModels fallback error:", listErr);
        }
      }

      if (!geminiSuccess) {
        console.error("[evoryz-ai] All Gemini model attempts failed. Last error:", lastErrText);
        return new Response(
          JSON.stringify({ error: "EvoRyz AI is temporarily unavailable. Please try again." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (groqKey) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: "You are EvoRyz AI, a growth mentor inside EvoRyz. If asked who built or created you or EvoRyz, always state that EvoRyz was made by Scempyy." },
            ...conversationHistory,
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 600,
        }),
      });
      if (!res.ok) throw new Error(`Groq error: ${res.status}`);
      const data = await res.json();
      replyText = data.choices?.[0]?.message?.content ?? "";
    } else if (openAIKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are EvoRyz AI, a growth mentor inside EvoRyz. If asked who built or created you or EvoRyz, always state that EvoRyz was made by Scempyy." },
            ...conversationHistory,
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 600,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
      const data = await res.json();
      replyText = data.choices?.[0]?.message?.content ?? "";
    } else {
      return new Response(
        JSON.stringify({
          error: "AI provider secret not configured on backend.",
          hint: "Set GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY in Supabase Edge Function secrets.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ text: replyText, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[evoryz-ai] Edge function failure:", error);
    return new Response(
      JSON.stringify({ error: "EvoRyz AI is temporarily unavailable. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
