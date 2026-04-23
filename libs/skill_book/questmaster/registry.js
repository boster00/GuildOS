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
      description: "Review a worker agent's deliverables before advancing to review.",
      howTo: [
        "**Review process:**",
        "1. Read quest description — understand what each deliverable should prove",
        "2. Fetch ALL screenshot URLs from inventory. Verify each returns HTTP 200.",
        "3. Look at every screenshot. For each, judge: does it prove the deliverable?",
        "4. Write review INTO inventory: UPDATE each inventory item to add a review field:",
        "   { passed: true/false, note: 'what was checked and why it passed or failed' }",
        "   Reference the specific WBS deliverable. Be specific and verifiable. No generic notes.",
        "5. If unsure, use Claude CLI (getSecondOpinion)",
        "6. Post a summary quest comment with overall pass/fail and key observations",
        "",
        "**First submission rule:** On the first purrview for any quest, always provide at least",
        "one improvement suggestion per deliverable category. Approve only on second or later submission.",
        "",
        "**Decision:**",
        "- Pass: move to review. Summary comment explains what passed.",
        "- Needs improvement: move back to execute. Comment lists what to fix.",
        "",
        "**Feedback format:** Simple and actionable. What is wrong (one sentence), what to do (one sentence).",
        "",
        "**Quality bar:** Check quest description or adventurer system_prompt for project-specific requirements.",
        "",
        "**Iteration limit:** After 20 review cycles, escalate with a comment explaining recurring issues.",
      ].join("\n"),
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
