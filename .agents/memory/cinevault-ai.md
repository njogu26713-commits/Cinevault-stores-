---
name: CineVault AI stack
description: Which AI provider is used for the admin AI features and why.
---

## Rule
All admin AI routes use the `openai` SDK pointed at xAI's base URL (`https://api.x.ai/v1`) with model `grok-3`, not Gemini.

**Why:** User switched from Gemini to Grok.

**How to apply:** When adding new AI features to the admin backend, import OpenAI from "openai", instantiate with `{ apiKey, baseURL: "https://api.x.ai/v1" }`, and use model "grok-3". The API key env var is `XAI_API_KEY`, not GEMINI_API_KEY. Strip markdown code fences from responses before JSON.parse(). The `@google/generative-ai` package has been removed.
