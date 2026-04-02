# Start Stripe CLI with the sandbox account API key
# This ensures Stripe CLI listens to the same account as your sandbox test keys

Write-Host "Starting Stripe CLI for SANDBOX account..." -ForegroundColor Cyan
Write-Host "Using API key from STRIPE_SECRET_SANDBOX_TEST_KEY (set in env)" -ForegroundColor Yellow
Write-Host ""

$apiKey = $env:STRIPE_SECRET_SANDBOX_TEST_KEY
if (-not $apiKey) {
    Write-Error "Set STRIPE_SECRET_SANDBOX_TEST_KEY to your sk_test_... secret before running."
    exit 1
}

stripe listen --forward-to localhost:3002/api/webhook/stripe --api-key $apiKey

# The webhook secret printed by this command should match STRIPE_WEBHOOK_SECRET_SANDBOX_TEST in .env.local
