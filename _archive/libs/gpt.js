// ARCHIVED: Original path was libs/gpt.js

// DEPRECATED: This file is deprecated. Use monkey.AI() instead from @/libs/monkey
// 
// Example usage with monkey:
// import { initMonkey } from "@/libs/monkey";
// const monkey = await initMonkey();
// const response = await monkey.AI(messages, {
//   model: "gpt-4",
//   temperature: temp,
//   max_tokens: max,
// });

import { initMonkey } from "@/libs/monkey";

// DEPRECATED: Use monkey.AI() instead
// This function is kept for backward compatibility but should be migrated to monkey.AI()
export const sendOpenAi = async (messages, userId, max = 100, temp = 1) => {
  console.warn("⚠️ sendOpenAi is deprecated. Use monkey.AI() instead from @/libs/monkey");
  
  try {
    const monkey = await initMonkey();
    const response = await monkey.AI(messages, {
      model: "gpt-4",
      temperature: temp,
      max_tokens: max,
    });
    return response;
  } catch (e) {
    console.error("GPT Error:", e?.message || e);
    return null;
  }
};
