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
- **Needs improvement:** Move quest back to 'execute'. Add a comment with feedback.

**Feedback format — keep it simple and actionable:**
- State what is missing or wrong in one sentence
- State exactly what the agent needs to do to fix it
- Do NOT use jargon, caveats, or complex phrasing
- Example good: "Missing: screenshot of /products page showing 5 antibodies. Take the screenshot and add the URL to quest inventory."
- Example bad: "WBS 1.3 requires a quest comment listing every page with Figma match status; latest purrview note still defers 9+/10 Figma QC to human without a signed-off waiver in-thread."

**Quality bar:** Do NOT settle until 90% satisfied. But keep feedback short and clear.
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
    createPR: {
      description: "Create a pull request for the worker agent's branch after review approval.",
      howTo: [
        "**When:** After reviewSubmission passes (90%+ satisfied).",
        "",
        "1. Identify the worker agent's branch from the quest comments or conversation",
        "2. Create a PR on GitHub targeting main (or the project's default branch)",
        "3. Add the quest title and summary as PR description",
        "4. Record the PR URL in a quest comment",
        "",
        "Worker agents do NOT create PRs — only you do, after approval.",
      ].join("\n"),
    },
    closeQuest: {
      description: "Archive quest deliverables and summary to Asana, then mark complete.",
      howTo: [
        "**Closing flow:**",
        "1. Read the quest description, inventory, and key comments",
        "2. Write a summary suitable for Asana (managerial-level, not technical details)",
        "3. Check if the quest has an Asana task reference in the description",
        "4. If yes: update the Asana task with the summary using the asana weapon",
        "5. If no: escalate to Guildmaster to identify the right Asana task",
        "6. After successful Asana archival: move quest to complete stage",
        "7. Add a comment: Quest closed. Summary archived to Asana.",
      ].join("\n"),
    },
  },
};
