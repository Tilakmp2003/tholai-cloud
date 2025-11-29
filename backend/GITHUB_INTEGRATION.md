# GitHub Integration Setup

## Environment Variables

Add to your `.env` file:

```bash
# GitHub Integration
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_OWNER=your-username-or-org
GITHUB_REPO=your-repo-name
```

## Generating a GitHub Token

1. Go to https://github.com/settings/tokens
2. Click **Generate new token** → **Generate new token (classic)**
3. Give it a name (e.g., "AI Agent Code Commits")
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Click **Generate token**
6. Copy the token and add to `.env`

## Usage

### Auto-commit a completed project:

```bash
npx tsx src/github/githubService.ts "E-Commerce Platform"
```

This will:
1. Create feature branches for each module
2. Commit all generated code files
3. Create Pull Requests with AI agent metadata

### Example Output:

```
🚀 GitHub Integration: Committing code for "E-Commerce Platform"

📦 Found 11 completed tasks

📂 Module: User Authentication (3 tasks)
   Creating branch: feature/user-authentication
      ✅ Task 1: Committed task_1_b049afd5.ts
      ✅ Task 2: Committed task_2_fe0fd501.ts
      ✅ Task 3: Committed task_3_a22bd859.ts
   
   Creating Pull Request...
   ✅ PR Created: https://github.com/owner/repo/pull/1

✅ GitHub integration complete!
```

## Features

- ✅ Creates feature branches per module
- ✅ Auto-commits all generated code
- ✅ Creates PRs with metadata (agent info, task IDs)
- ✅ Handles existing branches gracefully
- ✅ Updates files if they already exist
- ✅ Clean commit messages with agent attribution

## Notes

- Make sure the repository exists before running
- The default branch (usually `main` or `master`) must exist
- Requires write access to the repository
- Each module gets its own PR for easier review
