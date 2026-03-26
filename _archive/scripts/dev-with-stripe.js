// ARCHIVED: Original path was scripts/dev-with-stripe.js

/**
 * Development server with automatic Stripe webhook secret capture.
 * 
 * This script:
 * 1. Starts Stripe CLI and captures the webhook secret automatically
 * 2. Injects the secret into Next.js as an environment variable
 * 3. Starts the Next.js dev server with the fresh secret
 * 
 * No manual .env.local updates needed!
 */

const { spawn } = require('child_process');

console.log('🚀 Starting development server with Stripe webhooks...\n');

let webhookSecret = '';
let nextProcess = null;
let stripeReady = false;

// Start Stripe CLI
const stripeProcess = spawn('stripe', [
  'listen',
  '--forward-to',
  'localhost:3000/api/webhook/stripe'
], {
  stdio: ['ignore', 'pipe', 'pipe']
});

console.log('[Stripe CLI] Starting Stripe webhook listener...');

// Buffer to accumulate output (in case secret is split across chunks)
let outputBuffer = '';

function processOutput(data) {
  const output = data.toString();
  outputBuffer += output;
  
  // Remove whitespace/newlines to handle fragmented output
  const cleanBuffer = outputBuffer.replace(/\s+/g, '');
  
  // Capture the webhook secret from accumulated output
  const secretMatch = cleanBuffer.match(/whsec_[a-zA-Z0-9]+/);
  if (secretMatch && !webhookSecret) {
    webhookSecret = secretMatch[0];
    
    console.log('\n✅ WEBHOOK SECRET CAPTURED SUCCESSFULLY!');
    console.log(`   Secret: ${webhookSecret.substring(0, 20)}...`);
    console.log(`   Storage: Injected as STRIPE_WEBHOOK_SECRET environment variable`);
    console.log(`   Scope: Available to Next.js process (not written to .env.local)`);
    console.log(`   Note: Secret is generated fresh on each run - no manual updates needed!\n`);
    
    // Start Next.js with the captured secret
    startNextJS();
  }
  
  // Show Stripe CLI ready message
  if (output.includes('Ready!') && !stripeReady) {
    stripeReady = true;
    console.log('[Stripe CLI] ✓ Ready and forwarding webhooks to localhost:3000/api/webhook/stripe\n');
  }
  
  // Forward Stripe output (but hide the secret for security)
  const sanitizedOutput = output.replace(/whsec_[a-zA-Z0-9]+/g, 'whsec_***');
  if (!output.includes('Ready!') && sanitizedOutput.trim()) {
    process.stdout.write(`[Stripe CLI] ${sanitizedOutput}`);
  }
}

// Stripe CLI outputs to BOTH stdout and stderr, so listen to both
stripeProcess.stdout.on('data', processOutput);
stripeProcess.stderr.on('data', processOutput);

stripeProcess.on('close', (code) => {
  console.log(`\n[Stripe CLI] Process exited with code ${code}`);
  if (nextProcess) {
    nextProcess.kill();
  }
  process.exit(code);
});

function startNextJS() {
  console.log('[Next.js] Starting development server...\n');
  
  nextProcess = spawn('npm', ['run', 'dev'], {
    env: {
      ...process.env,
      STRIPE_WEBHOOK_SECRET: webhookSecret  // Inject the fresh secret
    },
    stdio: 'inherit',
    shell: true
  });

  nextProcess.on('close', (code) => {
    console.log(`\n[Next.js] Process exited with code ${code}`);
    stripeProcess.kill();
    process.exit(code);
  });
}

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');
  if (nextProcess) nextProcess.kill();
  stripeProcess.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  if (nextProcess) nextProcess.kill();
  stripeProcess.kill();
  process.exit();
});

// Start Next.js after a delay even if secret not captured (fallback to .env.local)
setTimeout(() => {
  if (!webhookSecret) {
    console.warn('\n⚠️  Could not capture webhook secret from Stripe CLI output.');
    console.warn('   Falling back to STRIPE_WEBHOOK_SECRET from .env.local');
    console.warn('   If webhooks fail, manually update .env.local with the secret shown below.\n');
    startNextJS();
  }
}, 5000);
