import { NextResponse } from "next/server";

const TEST_CASES = [
  { id: "TEST_1", inputs: [4, 7, 8, 2], hasSolution: true },
  { id: "TEST_2", inputs: [1, 1, 1, 1], hasSolution: false },
  { id: "TEST_3", inputs: [6, 6, 6, 6], hasSolution: true },
  { id: "TEST_4", inputs: [3, 3, 8, 8], hasSolution: true },
];

async function solveWithCCC(apiKey, numbers) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 512,
      system: `You are a Make 24 solver. Given 4 numbers, find a mathematical expression using all 4 numbers exactly once with +, -, *, / and parentheses that evaluates to exactly 24.

Return ONLY the expression in this format: (expression) = 24
Example: (8 - 2) * (6 / 2) = 24

If no solution exists, return exactly: No solution found.
No explanation, no markdown, no other text.`,
      messages: [
        {
          role: "user",
          content: `Solve Make 24 with numbers: ${numbers.join(", ")}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content[0].text.trim();
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { action } = body;

  if (action === "runAll") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 500 }
      );
    }

    const results = [];
    let messagesExchanged = 0;

    for (const test of TEST_CASES) {
      try {
        const output = await solveWithCCC(apiKey, test.inputs);
        messagesExchanged += 1;
        const gotSolution =
          !output.toLowerCase().includes("no solution") && output.length > 0;
        const status = gotSolution === test.hasSolution ? "PASS" : "FAIL";
        results.push({
          id: test.id,
          inputs: test.inputs,
          expected: test.hasSolution ? "solution" : "no solution",
          actual_output: output,
          got_solution: gotSolution,
          status,
        });
      } catch (err) {
        results.push({
          id: test.id,
          inputs: test.inputs,
          expected: test.hasSolution ? "solution" : "no solution",
          actual_output: `Error: ${err.message}`,
          got_solution: false,
          status: "FAIL",
        });
      }
    }

    const passed = results.filter((r) => r.status === "PASS").length;
    return NextResponse.json({
      results,
      passed,
      total: results.length,
      messagesExchanged,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
