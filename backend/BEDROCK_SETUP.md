# AWS Bedrock Model Access Setup Guide

## Quick Start: Enable Claude Models (5 minutes)

### Step 1: Submit Anthropic Use Case Form

1. **Go to AWS Console**: https://console.aws.amazon.com/bedrock/
2. **Click "Model access"** in the left sidebar
3. **Find "Anthropic"** in the list
4. **Click "Modify model access"** or "Request access"
5. **Fill out the use case form:**
   - **Use case**: Select "Research & Development" or "Software Development"
   - **Description**: "Building AI-powered virtual software company with agent-based development workflow"
   - **Company details**: Fill in your info
6. **Submit** and wait **~15 minutes** for approval

### Step 2: Enable Specific Models

After the form is approved:
1. Go back to **Model access**
2. Enable these models:
   - ✅ **Claude 3.5 Sonnet** (`anthropic.claude-3-5-sonnet-20240620-v1:0`)
   - ✅ **Claude 3 Haiku** (`anthropic.claude-3-haiku-20240307-v1:0`)
   - ✅ **Meta Llama 3.1** (optional fallback)

### Step 3: Verify Access

Run this test to confirm:
```bash
cd backend
npx tsx src/tests/test_bedrock_models.ts
```

Look for:
```
✅ anthropic.claude-3-5-sonnet-20240620-v1:0 works!
✅ anthropic.claude-3-haiku-20240307-v1:0 works!
```

### Step 4: Update & Test

Once verified:
```bash
# Re-seed database with premium models
npx tsx prisma/seed_model_config.ts

# Test AI functionality
npx tsx src/tests/test_direct_planning.ts
```

## Troubleshooting

**Error: "Model use case details have not been submitted"**
→ Submit the Anthropic use case form (Step 1 above)

**Error: "try again in 15 minutes"**
→ Wait 15 minutes after submitting the form, then retry

**Error: "Invocation...not supported"**
→ Some models (Claude 3.5 Haiku) require inference profiles - use profiles or stick with 3.5 Sonnet + 3 Haiku

## Current Workaround (While Waiting for Approval)

If you can't wait 15 minutes, I can configure the system to use Meta Llama 3 models, which may not require use case forms. Let me know!
