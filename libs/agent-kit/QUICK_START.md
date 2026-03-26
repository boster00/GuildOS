# Quick Start Guide - Agent Kit Test

## What Was Created

A complete test environment for the OpenAI Agent Kit SDK that generates landing pages using an agentic workflow.

### Files Created

```
/app/(private)/tests/agent-kit/page.js
    → Test page UI with campaign loader

/app/api/agent-kit-test/run/route.js
    → API endpoint that runs the workflow

/libs/agent-kit/workflow.js
    → Corrected Agent Kit workflow logic

/libs/agent-kit/README.md
    → Detailed documentation

/libs/agent-kit/SETUP_GUIDE.md
    → Comprehensive setup instructions

/libs/agent-kit/QUICK_START.md
    → This file
```

## How to Use

### 1. Configure API Key

Add to `.env.local`:
```
OPENAI_API_KEY=sk-proj-your-key-here
```

### 2. Start Dev Server

```bash
npm run dev
```

### 3. Access the Test Page

Navigate to: `http://localhost:3000/tests/agent-kit`

### 4. Run a Test

**Option A: Use Example Prompt**
- The text area is pre-filled
- Click "Generate Landing Page"
- Wait 30-60 seconds

**Option B: Load from Campaign**
- Select a campaign from dropdown
- Click "Generate Landing Page"

**Option C: Custom Input**
- Type your own prompt in format:
  ```
  • service_name: Your Service
  • icp: Your Target Audience
  • offer: Your Value Proposition
  ```

## What It Does

```
Your Input
    ↓
[AI Agents Process]
    ↓
Complete HTML Landing Page
```

The workflow:
1. Parses your input
2. Creates an outline
3. Generates marketing copy
4. Reviews for quality
5. Revises if needed (up to 3x)
6. Converts to styled HTML

## Features

✅ **Campaign Loader** - Load existing campaign data automatically
✅ **Live Preview** - See the generated page in an iframe
✅ **Download HTML** - Export the complete HTML file
✅ **Copy to Clipboard** - Quick copy for pasting elsewhere
✅ **Process Logs** - Monitor the workflow progress
✅ **Metadata Display** - See service name, ICP, QA status, etc.
✅ **Raw HTML View** - Inspect the generated code

## Expected Output

The workflow generates a modern, responsive landing page with:
- **Hero Section** - Compelling headline, subheadline, and CTA
- **Problem/Outcome** - Pain points and desired outcomes
- **Process Steps** - How the service works

Design features:
- Modern gradients and shadows
- Responsive layout
- Embedded CSS (no external dependencies)
- Clean, professional styling

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| "API key not configured" | Add `OPENAI_API_KEY` to `.env.local` |
| Workflow timeout | Check internet connection and OpenAI API status |
| No HTML generated | Check logs for QA failures or agent errors |
| "Model not available" | Verify your OpenAI account has GPT-4 access |

## Cost Per Run

Approximately **$0.05 - $0.15 USD** per generation (with GPT-4o)

## Next Steps

### For Testing
- ✅ Test with different service types
- ✅ Try various ICPs and offers
- ✅ Load from your actual campaigns
- ✅ Export and review the HTML

### For Production
- ⬜ Add database persistence for generated pages
- ⬜ Integrate with your content workflow
- ⬜ Create a gallery of generated pages
- ⬜ Add custom styling/branding options
- ⬜ Implement version history

## Customization

### Change Models
Edit `libs/agent-kit/workflow.js` and update `model: "gpt-4o"` to:
- `"gpt-4-turbo"` - More capable but slower
- `"gpt-3.5-turbo"` - Faster and cheaper but lower quality

### Adjust Sections
Edit the `Outline_Builder` and `QA_Reviewer` agents to change:
- Number of sections
- Section types
- Required fields
- Quality rules

### Custom Styling
Edit the `HTML_Converter` agent instructions to change:
- Color schemes
- Layout patterns
- Typography
- Spacing

## Example Prompts

### B2B SaaS
```
• service_name: Sales Pipeline Management
• icp: B2B sales teams at mid-market companies
• offer: Visualize your pipeline and close deals faster with intelligent forecasting
```

### Professional Services
```
• service_name: Executive Coaching
• icp: C-level executives at Fortune 500 companies
• offer: Strategic guidance to enhance leadership effectiveness and drive organizational transformation
```

### E-commerce
```
• service_name: Subscription Box Service
• icp: Health-conscious professionals aged 25-45
• offer: Curated wellness products delivered monthly to support your healthy lifestyle
```

## Architecture

```
Frontend (React)
    ↓ POST /api/agent-kit-test/run
Backend API Route
    ↓ calls
Agent Kit Workflow (6 AI Agents)
    ↓ uses
OpenAI GPT-4 API
    ↓ returns
Complete HTML Landing Page
```

## Support Resources

1. **Setup Issues**: See `SETUP_GUIDE.md`
2. **Detailed Docs**: See `README.md`
3. **Code Reference**: See `workflow.js`
4. **OpenAI Agent Kit**: https://openai.com/agents

## Success Criteria

You'll know it's working when:
- ✅ No API key errors
- ✅ Workflow completes in 30-60 seconds
- ✅ HTML preview displays in iframe
- ✅ Download button produces valid HTML file
- ✅ Generated content matches your input

## Demo Ready!

Your test environment is ready to use. Just add your OpenAI API key and start generating landing pages!
