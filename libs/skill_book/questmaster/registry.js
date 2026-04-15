/**
 * Questmaster skill book — knowledge registry format for Cat (Questmaster agent).
 * Cat is a cloud-run Cursor agent that reviews submissions and handles approvals.
 */

export const questmasterRegistry = {
  id: "questmaster_registry",
  title: "Questmaster — Review, Approval & Closing",
  description: "Actions for the Questmaster (Cat): review submissions, handle help requests, close quests to Asana.",
  steps: [],
  toc: {
    approveOrEscalate: {
      description: "Handle requests from worker agents seeking approval or help.",
      howTo: `
**When another agent contacts you for approval or help:**

1. **First response:** Do NOT read their full report yet. Ask them:
   "Do you have everything you need to proceed? If so, proceed. If not, tell me specifically what you need from me."

2. **On their second response:** Judge whether you can provide what they need:
   - If YES: help them directly (provide info, credentials, guidance, whatever they asked for)
   - If NO: tell them to escalate the quest and work on the next one:
     "I cannot help with this. Please escalate this quest (move to 'escalated' stage with a comment explaining the blocker) and work on your next highest-priority quest if you have one."

**Key principle:** Don't be a bottleneck. Most agents are asking for permission they don't need. The first question filters those out.
`,
    },
    reviewSubmission: {
      description: "Review a worker agent's deliverables before advancing to closing.",
      howTo: `
**Default assumption:** Every submission should include screenshots unless the quest description explicitly specifies a different deliverable format.

**Review process:**
1. Read the quest description to understand what was requested
2. Read the deliverables (usually screenshots in inventory)
3. Evaluate against the quest requirements:
   - Does the screenshot show what was asked for?
   - Is the quality acceptable? (no placeholder content, no errors, no broken layouts)
   - Are all deliverables present?

**Decision:**
- **Pass (90%+ satisfied):** Move quest to 'review' stage. Add a comment: "Deliverables approved. Moving to review."
- **Needs improvement:** Add a comment with specific feedback. Do NOT move the quest — let the worker agent address the feedback and resubmit.

**Quality bar:** There is plenty of execution bandwidth. Do NOT settle until you are 90% satisfied with the result. Send feedback and ask for iteration.

**For complex judgment:** Use Claude CLI for a second opinion (getSecondOpinion action).
`,
    },
    getSecondOpinion: {
      description: "Launch Claude CLI to independently evaluate a submission.",
      howTo: `
**When to use:** Complex deliverables where you're unsure about quality, correctness, or completeness.

**How:**
\`\`\`bash
claude -p "Review this submission for quest '<quest-title>'. The deliverable should show: <description>. The screenshot is at: <url>. Is this acceptable? What could be improved?"
\`\`\`

**Use Claude CLI's response to:**
- Confirm your assessment
- Identify issues you missed
- Provide more detailed feedback to the worker agent
`,
    },
    closeQuest: {
      description: "Archive quest deliverables and summary to Asana, then mark complete.",
      howTo: `
**Closing flow:**
1. Read the quest description, inventory, and key comments
2. Write a summary suitable for Asana (managerial-level, not technical details)
3. Check if the quest has an Asana task ID in inventory or description
4. If yes: update the Asana task with the summary and attach key deliverables
5. If no: escalate to Guildmaster to identify the right Asana task

**Asana update:**
\`\`\`javascript
import { writeTask, writeComment } from '@/libs/weapon/asana';
await writeComment({ taskId: '<asana-task-id>', text: '<quest summary>' });
// Optionally update task status
await writeTask({ taskId: '<asana-task-id>', completed: true });
\`\`\`

6. After successful Asana archival: move quest to 'complete' stage
7. Add a comment: "Quest closed. Summary archived to Asana task <id>."
`,
    },
  },
};
