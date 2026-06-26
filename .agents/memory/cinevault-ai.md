---
  name: CineVault AI stack
  description: Which AI provider is used for the admin AI features and why.
  ---

  ## Rule
  All admin AI routes use @google/generative-ai (Gemini 2.5 Flash), not OpenAI.

  **Why:** User explicitly said they use Gemini and provided GEMINI_API_KEY.

  **How to apply:** When adding new AI features to the admin backend, import GoogleGenerativeAI from @google/generative-ai and use model "gemini-2.5-flash". Strip markdown code fences from responses before JSON.parse(). Check for GEMINI_API_KEY, not OPENAI_API_KEY.
  