# AI Model Configuration

This project uses OpenAI models for various AI-powered features. You can customize which models are used by setting environment variables.

## Environment Variables

Add these to your `.env.local` file:

```bash
# Advanced AI Model (for complex reasoning tasks)
# Used for: ICP analysis, Phase 2 strategy, content generation, inline editing
AI_MODEL_ADVANCED=gpt-5.1
NEXT_PUBLIC_AI_MODEL_ADVANCED=gpt-5.1

# Standard AI Model (for creative tasks)
# Used for: campaign names, titles, outcomes, guarantees, factual checklists
AI_MODEL_STANDARD=gpt-4o
NEXT_PUBLIC_AI_MODEL_STANDARD=gpt-4o
```

## Model Usage Map

### Advanced Model (`gpt-5.1`)
**Tasks requiring deep reasoning and strategic insight:**
- ✅ ICP (Ideal Customer Profile) suggestions with profitability analysis
- ✅ Phase 2 article titles (requires strategic vendor/strategy comparison decision)
- ✅ Full article outline generation
- ✅ Content Magic AI Assistant (inline content editing)

### Standard Model (`gpt-4o`)
**Creative and straightforward tasks:**
- ✅ Campaign name suggestions
- ✅ Phase 1 & Phase 3 article titles
- ✅ Outcome phrase generation
- ✅ Peace of mind / guarantee statements
- ✅ Transactional facts checklists

## Configuration File

The central configuration is managed in `/config/ai-models.js`:

```javascript
import AI_MODELS from "@/config/ai-models";

// Use in your code
const model = AI_MODELS.ADVANCED; // or AI_MODELS.STANDARD
```

## Cost Optimization

**Estimated API Costs:**
- **gpt-5.1** (Advanced): ~$2-5 per complex task
- **gpt-4o** (Standard): ~$0.50-1 per task

**Cost-Saving Tips:**
1. Keep the default configuration (advanced only for truly complex tasks)
2. For development/testing, you can temporarily set both to `gpt-4o`:
   ```bash
   AI_MODEL_ADVANCED=gpt-4o  # Saves ~70% on API costs
   ```

## Changing Models Globally

To test a different model across the entire project:

```bash
# In .env.local
AI_MODEL_ADVANCED=gpt-4.5-turbo
AI_MODEL_STANDARD=gpt-4o-mini
```

Changes take effect immediately (restart dev server if needed).

## Model Performance Notes

### gpt-5.1 (Advanced)
- ✅ Best for: Complex reasoning, strategy analysis, multi-step thinking
- ✅ Excellent at: Determining vendor vs strategy comparison for Phase 2
- ⏱️ Slower: ~30-60 seconds per request
- 💰 More expensive: ~3-5x cost of gpt-4o

### gpt-4o (Standard)
- ✅ Best for: Creative content, titles, suggestions, simple analysis
- ✅ Fast: ~5-15 seconds per request
- 💰 Cost-effective: Baseline pricing
- ⚠️ May miss nuances in complex strategic decisions

## Troubleshooting

**Models not changing?**
1. Check `.env.local` file exists in project root
2. Restart the development server: `npm run dev`
3. Clear Next.js cache: `rm -rf .next`
4. Verify env vars are loaded: Check console logs for model names

**Want to force a specific model for debugging?**

Temporarily hardcode in `config/ai-models.js`:
```javascript
export const AI_MODELS = {
  ADVANCED: 'gpt-4o',  // Force to standard model
  STANDARD: 'gpt-4o',
};
```

## Files Updated

The following files now read from environment variables:
- ✅ `/config/ai-models.js` - Central configuration
- ✅ `/app/(private)/campaigns/components/CampaignSettings.js`
- ✅ `/app/(private)/campaigns/components/CampaignArticleOutline.js`
- ✅ `/libs/monkey.js` - Default model fallback
- ✅ `/app/api/ai/route.js` - Generic AI endpoint

---

**Last Updated:** 2025
**Configuration Version:** 1.0

