# OpenAI Agent Kit SDK Test

This directory contains a test implementation of the OpenAI Agent Kit SDK workflow for generating service landing pages.

## Setup

### 1. Install Dependencies

You need to install the OpenAI Agent Kit SDK and Zod:

```bash
npm install @openai/agents zod
```

### 2. Configure OpenAI API Key

Make sure you have your OpenAI API key set in your environment variables:

```bash
# Add to your .env.local file
OPENAI_API_KEY=your_api_key_here
```

The Agent Kit SDK will automatically use the `OPENAI_API_KEY` environment variable.

## Usage

### Access the Test Page

Navigate to `/tests/agent-kit` in your browser (when logged in).

### Input Format

The workflow expects input in this format:

```
• service_name: [Your Service Name]
• icp: [Your Ideal Customer Profile]
• offer: [Your Value Proposition]
```

Example:
```
• service_name: ELISA CRO Service
• icp: Biotech discovery and preclinical R&D teams
• offer: We run your plates quickly with reliable execution so your team can focus on decisions, not troubleshooting.
```

## Workflow Overview

The agentic workflow consists of these steps:

1. **Intake & Normalize** - Parses the input and extracts service_name, icp, and offer
2. **Outline Builder** - Creates a structured outline for the landing page
3. **Draft Generator** - Generates marketing copy for each section
4. **QA Reviewer** - Validates the draft against quality rules
5. **Revision Agent** - Fixes any issues found (up to 3 iterations)
6. **HTML Converter** - Converts the final draft to a complete HTML landing page

## Quality Rules

The workflow enforces these rules:

- **Structure**: Exactly 3 sections (hero, problem_outcome, process_steps)
- **Claims Policy**: No numeric claims or superlatives
- **Hero Requirements**: Substantial content (minimum 40 words)

## Output

The workflow generates:

- A complete, responsive HTML landing page
- Embedded CSS styling
- Modern design with gradients and shadows
- Mobile-responsive layout

## Troubleshooting

### "OpenAI Agent Kit SDK not installed"

Install the required dependencies:
```bash
npm install @openai/agents zod
```

### "API Key not found"

Make sure `OPENAI_API_KEY` is set in your environment variables or `.env.local` file.

### Workflow Timeout

The workflow can take 30-60 seconds to complete. If it times out, you may need to adjust the timeout settings in your Next.js configuration.

## Cost Considerations

Each workflow run makes multiple API calls to OpenAI's GPT-4 model:
- 1 intake call
- 1 outline call
- 1 draft generation call
- 1-3 QA review calls (depending on revisions)
- 1 HTML conversion call

Expect 5-7 API calls per run, using the GPT-4o model.

## Files

- `workflow.js` - Main workflow logic (corrected from SDK export)
- `README.md` - This file
- `/app/(private)/tests/agent-kit/page.js` - Test page UI
- `/app/api/agent-kit-test/run/route.js` - API endpoint

## Notes

- The workflow uses GPT-4o instead of GPT-5.2 (which doesn't exist yet)
- The original SDK export had several bugs that have been fixed in `workflow.js`
- The QA review loop runs up to 3 times to ensure quality output
