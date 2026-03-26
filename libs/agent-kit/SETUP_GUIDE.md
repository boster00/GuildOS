# Agent Kit Test Setup Guide

This guide will help you set up and run the OpenAI Agent Kit SDK test page.

## Prerequisites

✅ Already installed (from package.json):
- `@openai/agents` (v0.3.7)
- `zod` (v4.3.4)
- `openai` (v4.104.0)

## Environment Configuration

### 1. Set up OpenAI API Key

Create or update your `.env.local` file in the project root:

```bash
# OpenAI API Configuration
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

**Important**: The Agent Kit SDK requires a valid OpenAI API key with GPT-4 access.

### 2. Verify Environment Variables

Run this command to check if your API key is loaded:

```bash
node -e "require('dotenv').config({ path: '.env.local' }); console.log('API Key:', process.env.OPENAI_API_KEY ? 'Set ✓' : 'Not Set ✗')"
```

## Running the Test

### 1. Start the Development Server

```bash
npm run dev
```

### 2. Access the Test Page

Navigate to: `http://localhost:3000/tests/agent-kit`

(Note: You need to be logged in to access this private route)

### 3. Test the Workflow

1. The text area is pre-filled with an example prompt
2. Click "Generate Landing Page"
3. Wait 30-60 seconds for the workflow to complete
4. View the generated HTML in the preview iframe

## How It Works

### Workflow Steps

```
Input Text
    ↓
[1] Intake & Normalize Agent
    → Extracts: service_name, icp, offer_summary
    ↓
[2] Outline Builder Agent
    → Creates structured outline for landing page
    ↓
[3] Draft Generator Agent
    → Generates marketing copy for sections
    ↓
[4] QA Reviewer Agent
    → Validates against quality rules
    ↓
[5] Revision Agent (if needed)
    → Fixes issues found by QA
    ↓ (loops up to 3 times)
[6] HTML Converter Agent
    → Converts to styled HTML
    ↓
Final Landing Page HTML
```

### Expected Output

The workflow generates a complete HTML landing page with:
- Hero section with headline and CTA
- Problem/Outcome section
- Process steps section
- Modern, responsive design
- Embedded CSS styling

## Troubleshooting

### Error: "OpenAI API key not configured"

**Solution**: Add `OPENAI_API_KEY` to your `.env.local` file

```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

### Error: "Invalid API key"

**Solution**: 
1. Verify your API key is correct
2. Ensure it has GPT-4 access
3. Check if there are any billing issues on your OpenAI account

### Workflow Times Out

**Solution**: The workflow is configured with a 5-minute timeout (`maxDuration = 300`). If it times out:
1. Check your internet connection
2. Verify OpenAI API status
3. Try with a simpler prompt

### "Workflow completed but no HTML was produced"

**Possible causes**:
1. QA review failed after 3 attempts
2. An agent in the chain returned unexpected output
3. Check the logs and raw_result in the response

**Debug steps**:
1. Look at the "Process Log" section
2. Check browser console for errors
3. Review the `raw_result` in development mode

### Model Not Available

If you see errors about model availability:
- The workflow uses `gpt-4o` (GPT-4 Optimized)
- Ensure your API key has access to GPT-4 models
- Fallback: Edit `libs/agent-kit/workflow.js` to use `gpt-3.5-turbo` if needed

## Cost Estimation

Each workflow run typically makes **5-7 API calls**:

| Agent | Calls | Approx Tokens |
|-------|-------|---------------|
| Intake_Normalize | 1 | 500 |
| Outline_Builder | 1 | 1,000 |
| Draft_Generator | 1 | 2,000 |
| QA_Reviewer | 1-3 | 1,500 each |
| Revision_Agent | 0-2 | 2,000 each |
| HTML_Converter | 1 | 3,000 |

**Estimated cost per run**: $0.05 - $0.15 USD (with GPT-4o pricing)

## Customization

### Change Models

Edit `libs/agent-kit/workflow.js` and update the `model` field in each agent:

```javascript
const intakeNormalize = new Agent({
  name: "Intake_Normalize",
  model: "gpt-4o", // Change this
  // ...
});
```

Available models:
- `gpt-4o` (recommended)
- `gpt-4-turbo`
- `gpt-4`
- `gpt-3.5-turbo` (cheaper, lower quality)

### Adjust QA Rules

Edit the QA Reviewer agent instructions in `workflow.js`:

```javascript
const qaReviewer = new Agent({
  instructions: `You are a strict QA reviewer...
  // Add your custom rules here
  `,
  // ...
});
```

### Change Revision Limit

In `workflow.js`, find the revision loop:

```javascript
while (
  state.revision_count < 3 && // Change this number
  state.sections_feedback.status !== "pass"
) {
  // ...
}
```

## Testing Tips

### Good Test Prompts

```
• service_name: Email Marketing Automation
• icp: Small business owners and marketing managers
• offer: Automate your email campaigns with smart templates and analytics

• service_name: AI-Powered Legal Research
• icp: Law firms and corporate legal departments  
• offer: Find relevant case law in seconds, not hours

• service_name: Cloud Infrastructure Monitoring
• icp: DevOps teams at high-growth startups
• offer: Real-time monitoring with intelligent alerting to prevent downtime
```

### Bad Prompts (for testing error handling)

```
Missing fields:
• service_name: Test Service

Invalid format:
Just some random text without structure

Empty:
(empty input)
```

## Next Steps

1. ✅ Set up environment variables
2. ✅ Test with example prompt
3. ⬜ Integrate with your existing CampaignContext
4. ⬜ Add database persistence for generated pages
5. ⬜ Create a gallery of generated pages

## Integration Ideas

### Save to Database

Add Supabase integration to save generated pages:

```javascript
const { data, error } = await supabase
  .from('generated_pages')
  .insert({
    service_name: result.service_name,
    html: result.sections_html.page_html,
    metadata: { ... }
  });
```

### Load Existing Campaign Data

Modify the test page to load from campaigns table:

```javascript
const campaign = await getCampaign(campaignId);
const prompt = `
• service_name: ${campaign.service_name}
• icp: ${campaign.icp_vertical}
• offer: ${campaign.offer_summary}
`;
```

## Support

For issues or questions:
1. Check the console logs in browser and terminal
2. Review the OpenAI Agent Kit documentation
3. Verify your OpenAI API key and billing status
