"use client";

import { useState, useEffect } from "react";

export default function TestStripeClient() {
  const [accountInfo, setAccountInfo] = useState(null);
  const [webhookResult, setWebhookResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Auto-load account info on mount
    fetch("/api/test-stripe/check-account")
      .then(res => res.json())
      .then(data => setAccountInfo(data))
      .catch(err => setAccountInfo({ error: err.message }));
  }, []);

  const testWebhook = async () => {
    setLoading(true);
    setWebhookResult(null);
    
    try {
      const res = await fetch("/api/test-stripe/ping-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      setWebhookResult(data);
    } catch (error) {
      setWebhookResult({ error: error.message });
    }
    
    setLoading(false);
  };

  const getAccountMatch = () => {
    if (!accountInfo?.appAccount?.id) return null;
    
    // The Stripe CLI account from earlier check was: acct_1SB8U3F6LYYE8X5S5zEdGnwd
    // But the app might be using a different account (acct_1SB8UI...)
    const appAccountId = accountInfo.appAccount.id;
    const cliAccountId = "acct_1SB8U3FISjkZ1PKx"; // From Stripe CLI config
    
    return {
      match: appAccountId === cliAccountId,
      appAccount: appAccountId,
      cliAccount: cliAccountId
    };
  };

  const accountMatch = getAccountMatch();

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Stripe Webhook Diagnostics</h1>

      {/* Account Check */}
      <div style={{ marginBottom: "2rem", padding: "1rem", border: "2px solid #0070f3", borderRadius: "8px", background: "#f0f9ff" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Account Alignment Check</h2>
        {accountInfo ? (
          <>
            <div style={{ marginBottom: "1rem" }}>
              <strong>Your App's Stripe Account:</strong> {accountInfo.appAccount?.id || "Unknown"}
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <strong>Stripe CLI Connected To:</strong> acct_1SB8U3FISjkZ1PKx
            </div>
            {accountMatch && (
              <div style={{ 
                padding: "1rem", 
                borderRadius: "4px", 
                background: accountMatch.match ? "#dcfce7" : "#fee2e2",
                border: accountMatch.match ? "1px solid #86efac" : "1px solid #fca5a5",
                marginTop: "1rem"
              }}>
                {accountMatch.match ? (
                  <>
                    <div style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>✅ Accounts MATCH</div>
                    <div>Webhooks should work if Stripe CLI is actively listening</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>❌ ACCOUNT MISMATCH</div>
                    <div style={{ marginBottom: "0.5rem" }}>
                      App creates checkouts in: <code>{accountMatch.appAccount}</code>
                    </div>
                    <div>
                      Stripe CLI listens to: <code>{accountMatch.cliAccount}</code>
                    </div>
                    <div style={{ marginTop: "1rem", fontWeight: "bold" }}>
                      This is why webhooks don't fire! Different accounts.
                    </div>
                  </>
                )}
              </div>
            )}
            <details style={{ marginTop: "1rem" }}>
              <summary style={{ cursor: "pointer", color: "#666" }}>View full account details</summary>
              <pre style={{ marginTop: "0.5rem", padding: "1rem", background: "#f5f5f5", borderRadius: "4px", overflow: "auto" }}>
                {JSON.stringify(accountInfo, null, 2)}
              </pre>
            </details>
          </>
        ) : (
          <div>Loading account info...</div>
        )}
      </div>

      {/* Webhook Test */}
      <div style={{ marginBottom: "2rem", padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Test Webhook Endpoint</h2>
        <p style={{ marginBottom: "1rem", color: "#666" }}>
          Sends a mock checkout.session.completed event directly to <code>/api/webhook/stripe</code>
        </p>
        
        <button
          onClick={testWebhook}
          disabled={loading}
          style={{ 
            padding: "0.75rem 1.5rem", 
            cursor: loading ? "not-allowed" : "pointer",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "1rem",
            fontWeight: "500"
          }}
        >
          {loading ? "Testing..." : "Ping Webhook"}
        </button>

        {webhookResult && (
          <div style={{ marginTop: "1.5rem" }}>
            <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
              {webhookResult.interpretation}
            </h3>
            <details>
              <summary style={{ cursor: "pointer", color: "#666" }}>View full response</summary>
              <pre style={{ 
                marginTop: "1rem", 
                padding: "1rem", 
                background: "#f5f5f5", 
                borderRadius: "4px", 
                overflow: "auto"
              }}>
                {JSON.stringify(webhookResult, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{ padding: "1rem", background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: "8px" }}>
        <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Next Steps:</h3>
        <ol style={{ marginLeft: "1.5rem", lineHeight: "1.8" }}>
          <li>Check if accounts match above</li>
          <li>If accounts DON'T match: You need to update your .env keys OR reconnect Stripe CLI to the right account</li>
          <li>If accounts DO match: Run <code>stripe listen --forward-to localhost:3000/api/webhook/stripe</code> in a separate terminal</li>
          <li>Complete a real checkout and watch for webhook logs in your Next.js terminal</li>
        </ol>
      </div>
    </div>
  );
}
