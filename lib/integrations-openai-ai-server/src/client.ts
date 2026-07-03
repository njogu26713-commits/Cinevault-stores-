import OpenAI from "openai";

const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration or add your own API key?",
  );
}

export const openai = new OpenAI({
  apiKey,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
