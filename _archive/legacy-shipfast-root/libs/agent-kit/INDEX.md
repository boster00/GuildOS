# OpenAI Agent Kit SDK - Test Implementation

## Overview

This is a complete implementation of an agentic workflow that generates service landing pages using OpenAI's Agent Kit SDK. The workflow uses 6 specialized AI agents that work together to create high-quality, responsive HTML landing pages.

## 📁 File Structure

```
/libs/agent-kit/
├── workflow.js           # Main Agent Kit workflow (corrected from SDK export)
├── README.md            # Detailed technical documentation
├── SETUP_GUIDE.md       # Comprehensive setup instructions
├── QUICK_START.md       # Quick reference guide
└── INDEX.md             # This file

/app/(private)/tests/agent-kit/
└── page.js              # Test page UI with campaign loader

/app/api/agent-kit-test/run/
└── route.js             # API endpoint for running workflow
```

## 🚀 Getting Started

### Prerequisites
✅ Dependencies already installed:
- `@openai/agents` (v0.3.7)
- `zod` (v4.3.4)
- `openai` (v4.104.0)

### Setup (2 steps)

1. **Add API Key** to `.env.local`:
   ```bash
   OPENAI_API_KEY=sk-proj-your-key-here
   ```

2. **Start Dev Server**:
   ```bash
   npm run dev
   ```

3. **Open Test Page**:
   ```
   http://localhost:3000/tests/agent-kit
   ```

That's it! 🎉

## 📖 Documentation

| File | Purpose | Read When |
|------|---------|-----------|
| `QUICK_START.md` | Fast overview and basic usage | First time setup |
| `SETUP_GUIDE.md` | Detailed setup and troubleshooting | Having issues |
| `README.md` | Technical details and customization | Building features |
| `workflow.js` | Source code with comments | Customizing workflow |

## 🎯 What It Does

**Input**: Service name, ICP, and offer in plain text

**Output**: Complete, styled HTML landing page

**Process**:
```
Input → Parse → Outline → Draft → QA Review → Revise → Convert to HTML
        └─────────────────────────────────────────────────────┘
                    6 Specialized AI Agents
```

## ⚡ Quick Test

1. Go to `/tests/agent-kit`
2. Use the pre-filled example or select a campaign
3. Click "Generate Landing Page"
4. Wait ~30-60 seconds
5. View, download, or copy the result

## 🎨 Features

### Test Page Features
- ✅ Campaign loader (auto-populate from existing data)
- ✅ Live HTML preview in iframe
- ✅ Download as `.html` file
- ✅ Copy to clipboard
- ✅ Process logs monitoring
- ✅ Metadata display (service, ICP, QA status)
- ✅ Raw HTML inspector

### Workflow Features
- ✅ Multi-agent collaboration
- ✅ Automatic QA review
- ✅ Self-correction (up to 3 revisions)
- ✅ Structured JSON output at each step
- ✅ Quality policy enforcement (no superlatives, no fake numbers)
- ✅ Modern, responsive HTML generation

## 🔧 Key Fixes Applied

The original SDK export had several bugs. Here's what was fixed:

| Issue | Original Code | Fixed Code |
|-------|--------------|------------|
| Offer assignment | `state.offer = state.offer;` | `state.offer = intakeNormalizeResult.output_parsed.offer_summary;` |
| String conversion | `string(data)` | `JSON.stringify(data)` |
| Variable references | `input.sections_draft_text` | Proper variable scoping |
| Model compatibility | `gpt-5.2` | `gpt-4o` |
| Error handling | None | Try-catch with detailed errors |

## 💰 Cost Estimation

| Workflow Run | API Calls | Approx Cost |
|--------------|-----------|-------------|
| Successful (no revisions) | 5 | $0.05 |
| With 1 revision | 6-7 | $0.10 |
| With 3 revisions | 8-9 | $0.15 |

Using GPT-4o model pricing.

## 🎓 Example Use Cases

### 1. B2B SaaS Landing Page
```
• service_name: Project Management Software
• icp: Product teams at tech startups
• offer: Streamline your roadmap with collaborative planning
```

### 2. Professional Services
```
• service_name: Technical Recruiting
• icp: Engineering managers at Series A-C startups
• offer: Source and vet senior engineers who fit your culture
```

### 3. E-commerce/DTC
```
• service_name: Organic Meal Kits
• icp: Busy parents who value healthy eating
• offer: Fresh, pre-portioned ingredients with chef-designed recipes
```

## 🔄 Workflow Architecture

```
┌─────────────────────────────────────────────┐
│          User Input (Text)                  │
└──────────────────┬──────────────────────────┘
                   ↓
         ┌─────────────────────┐
         │ Intake_Normalize    │ Parse input
         │ (Agent 1)           │ Extract: service, ICP, offer
         └──────────┬──────────┘
                    ↓
         ┌─────────────────────┐
         │ Outline_Builder     │ Create page structure
         │ (Agent 2)           │ Define sections
         └──────────┬──────────┘
                    ↓
         ┌─────────────────────┐
         │ Draft_Generator     │ Write marketing copy
         │ (Agent 3)           │ Generate content
         └──────────┬──────────┘
                    ↓
         ┌─────────────────────┐
         │ QA_Reviewer         │ Validate quality
         │ (Agent 4)           │ Check rules
         └──────────┬──────────┘
                    ↓
              [Pass or Fail?]
                    ↓
         ┌─────────────────────┐
         │ Revision_Agent      │ Fix issues
         │ (Agent 5)           │ (if needed)
         └──────────┬──────────┘
                    ↓
         ┌─────────────────────┐
         │ HTML_Converter      │ Generate HTML
         │ (Agent 6)           │ Add styling
         └──────────┬──────────┘
                    ↓
         ┌─────────────────────┐
         │  Complete Landing   │
         │  Page (HTML)        │
         └─────────────────────┘
```

## 🎛️ Configuration Options

### Change AI Model
Edit `workflow.js` and update each agent's `model` field:
```javascript
model: "gpt-4o"  // Options: gpt-4o, gpt-4-turbo, gpt-3.5-turbo
```

### Adjust Revision Limit
In `workflow.js`, find:
```javascript
while (state.revision_count < 3 && ...)
```

### Customize Sections
Edit the `Outline_Builder` agent instructions

### Modify Quality Rules
Edit the `QA_Reviewer` agent instructions

## 🐛 Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| "API key not configured" | Missing env var | Add `OPENAI_API_KEY` to `.env.local` |
| "Model not available" | API access issue | Verify GPT-4 access on OpenAI account |
| Workflow timeout | Network/API slow | Check connection, retry |
| "No HTML generated" | QA failed 3x | Review logs, simplify prompt |

See `SETUP_GUIDE.md` for detailed troubleshooting.

## 📊 Success Metrics

You're successfully running the workflow when:
- ✅ Response time: 30-60 seconds
- ✅ QA status: "pass" 
- ✅ HTML preview: Renders properly
- ✅ Content quality: Matches input
- ✅ No API errors

## 🚀 Next Steps

### For Evaluation (Now)
1. Test with your actual campaign data
2. Review HTML output quality
3. Check if copy matches your standards
4. Measure cost per generation
5. Evaluate speed vs quality trade-offs

### For Integration (Later)
1. Add database persistence
2. Connect to your content workflow
3. Create version history
4. Add custom branding options
5. Build a gallery of generated pages

## 📚 Additional Resources

- **OpenAI Agent Kit Docs**: https://platform.openai.com/docs/agents
- **Zod Schema Docs**: https://zod.dev
- **Project Root**: `/libs/agent-kit/`

## ✅ Implementation Checklist

- [x] Create test page UI
- [x] Build API endpoint
- [x] Fix and correct Agent Kit workflow
- [x] Add campaign loader
- [x] Implement live preview
- [x] Add download/copy features
- [x] Write comprehensive documentation
- [x] Add error handling
- [x] Configure timeouts
- [x] Create usage guides

## 🎉 Ready to Test!

Everything is set up and ready to go. Just add your OpenAI API key and start generating landing pages!

**Quick command to verify setup:**
```bash
# Check if API key is set
node -e "require('dotenv').config({ path: '.env.local' }); console.log('API Key:', process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not Set')"
```

Happy testing! 🚀
