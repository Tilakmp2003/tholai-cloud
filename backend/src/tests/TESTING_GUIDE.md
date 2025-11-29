# Complete Testing Guide

## Prerequisites

Before testing, ensure you have:
- Node.js 18+
- PostgreSQL running
- Redis running (optional, for task queue)
- Docker running (for sandbox tests)

---

## Phase 1: Database & Server Setup

### Step 1.1: Setup Environment
```bash
cd backend
cp .env.example .env  # If you have one, otherwise create .env
```

Your `.env` should have:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/virtualcompany"
REDIS_URL="redis://localhost:6379"
PORT=4000

# Leave these empty for now - we'll use mocks
GEMINI_API_KEY=""
OPENROUTER_API_KEY=""
GROQ_API_KEY=""
```

### Step 1.2: Initialize Database
```bash
cd backend
npx prisma generate
npx prisma db push
```

### Step 1.3: Seed Test Data
```bash
npx tsx src/tests/seed_test_data.ts
```

### Step 1.4: Start Backend Server
```bash
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:4000
📡 WebSocket ready for real-time updates
🧠 Starting Governance Loop...
📨 Starting Task Queue Processor...
🧹 Starting Memory Retention Scheduler...
```

### Step 1.5: Start Frontend
```bash
cd frontend
npm run dev
```

Open http://localhost:3000

---

## Phase 2: API Endpoint Testing (No LLM Required)

Use curl or Postman to test each endpoint.

### 2.1 Health Check
```bash
curl http://localhost:4000/health
# Expected: {"status":"ok"}
```

### 2.2 Dashboard Metrics
```bash
curl http://localhost:4000/api/dashboard/metrics
# Expected: JSON with agents, tasks, performance data
```

### 2.3 Approval Gates
```bash
# Create a gate
curl -X POST http://localhost:4000/api/approvals/configure \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test-project","enabledGates":["PRE_COMMIT","SECURITY"]}'

# Get pending gates
curl http://localhost:4000/api/approvals

# Approve a gate (replace GATE_ID)
curl -X POST http://localhost:4000/api/approvals/GATE_ID/approve \
  -H "Content-Type: application/json" \
  -d '{"reviewerId":"tester","notes":"Looks good"}'
```

### 2.4 Memory System
```bash
# Store a best practice
curl -X POST http://localhost:4000/api/memory/best-practice \
  -H "Content-Type: application/json" \
  -d '{"category":"auth","title":"JWT Best Practice","content":"Always use RS256 for production"}'

# Get stats
curl http://localhost:4000/api/memory/stats

# Search memories
curl -X POST http://localhost:4000/api/memory/search \
  -H "Content-Type: application/json" \
  -d '{"context":{"summary":"implement authentication"},"agentRole":"MidDev","limit":5}'
```

### 2.5 Git Integration
```bash
# Initialize repo (needs a project with workspace)
curl -X POST http://localhost:4000/api/git/PROJECT_ID/init

# Get history
curl http://localhost:4000/api/git/PROJECT_ID/history

# Get branches
curl http://localhost:4000/api/git/PROJECT_ID/branches
```

### 2.6 Admin Endpoints
```bash
# Get KPIs
curl http://localhost:4000/api/admin/kpis

# Get safety allowlist
curl http://localhost:4000/api/admin/safety/allowlist

# Add to allowlist
curl -X POST http://localhost:4000/api/admin/safety/allowlist \
  -H "Content-Type: application/json" \
  -d '{"packageName":"lodash"}'

# Get budget stats
curl http://localhost:4000/api/admin/budget/stats

# Pause all agents
curl -X POST http://localhost:4000/api/admin/budget/pause \
  -H "Content-Type: application/json" \
  -d '{"reason":"Testing pause functionality"}'

# Resume all agents
curl -X POST http://localhost:4000/api/admin/budget/resume

# Verify trace integrity
curl http://localhost:4000/api/admin/trace/verify

# Run memory purge
curl -X POST http://localhost:4000/api/admin/memory/purge
```

---

## Phase 3: Unit Tests (No LLM Required)

### 3.1 Run Approval Flow Tests
```bash
cd backend
npx tsx src/tests/test_approval_flow.ts
```

Expected output:
```
🧪 Running Approval Flow Tests

Test 1: Create approval gate
  ✅ PASSED: Gate created successfully
...
Results: 7 passed, 0 failed
```

### 3.2 Run Memory Tests
```bash
npx tsx src/tests/test_memory_reuse.ts
```

### 3.3 Run All Unit Tests
```bash
npx tsx src/tests/run_all_tests.ts
```

---

## Phase 4: Frontend UI Testing

### 4.1 Command Center (/)
- [ ] Page loads without errors
- [ ] KPI cards display data
- [ ] System logs panel shows events
- [ ] Active tasks panel shows tasks
- [ ] WebSocket indicator shows connected (green dot)
- [ ] "Initialize Project" button opens modal

### 4.2 Create Project Modal
- [ ] Modal opens when clicking "Initialize Project"
- [ ] Quick start templates populate description
- [ ] "Analyze Requirements Clarity" button works
- [ ] Form validation shows errors for empty fields
- [ ] Submit creates project (check console for API call)

### 4.3 Admin Dashboard (/admin)
- [ ] Page loads without errors
- [ ] KPI cards show metrics
- [ ] Safety tab shows allowlist
- [ ] Can add package to allowlist
- [ ] Budget tab shows spend stats
- [ ] Pause/Resume buttons work
- [ ] Memory tab shows retention stats
- [ ] Trace tab shows chain stats

### 4.4 Approval Notifications
- [ ] Create a test approval gate via API
- [ ] Floating notification appears in bottom-right
- [ ] Clicking "Review" opens modal
- [ ] Can approve/reject from modal

### 4.5 WebSocket Real-time Updates
- [ ] Open browser console
- [ ] Create an approval gate via API
- [ ] See `approval:pending` event in console
- [ ] UI updates without refresh

---

## Phase 5: Integration Testing (With Mock LLM)

### 5.1 Enable Mock Mode
Create `backend/src/llm/mockClient.ts` for testing without real API keys.

### 5.2 Test Socratic Interrogator
```bash
curl -X POST http://localhost:4000/api/socratic/check \
  -H "Content-Type: application/json" \
  -d '{"requirements":"Build a login page"}'
```

With mock, should return:
```json
{"needsInterrogation":true,"ambiguityScore":0.6,"issueCount":3}
```

### 5.3 Test Full Project Creation Flow
1. Open frontend
2. Click "Initialize Project"
3. Enter name: "Test E-Commerce"
4. Enter description: "Build an online store"
5. Click "Analyze Requirements Clarity"
6. Answer clarification questions
7. Submit project
8. Check database for new project, modules, tasks

---

## Phase 6: Sandbox Testing (Requires Docker)

### 6.1 Verify Docker is Running
```bash
docker ps
```

### 6.2 Test Sandbox Creation
```bash
curl -X POST http://localhost:4000/api/workspace/PROJECT_ID/sandbox/create
```

### 6.3 Test Command Execution
```bash
curl -X POST http://localhost:4000/api/workspace/PROJECT_ID/exec \
  -H "Content-Type: application/json" \
  -d '{"command":"echo Hello World"}'
```

---

## Phase 7: End-to-End Flow Test

### Complete Flow Checklist

1. **Create Project**
   - [ ] Open frontend → Click "Initialize Project"
   - [ ] Fill in name and description
   - [ ] Click "Analyze Requirements" (tests Socratic)
   - [ ] Submit project

2. **Verify Project Created**
   - [ ] Check database: `SELECT * FROM "Project" ORDER BY "createdAt" DESC LIMIT 1;`
   - [ ] Check modules created
   - [ ] Check tasks created

3. **Verify Agents Spawned**
   - [ ] Check database: `SELECT * FROM "Agent" WHERE status = 'IDLE';`

4. **Verify Workspace**
   - [ ] Check `workspaces/` folder for new project
   - [ ] Verify Next.js app scaffolded

5. **Test Git Integration**
   - [ ] Check `.git` folder exists in workspace
   - [ ] Run `git log` in workspace folder

6. **Test Approval Flow**
   - [ ] Trigger a task that creates approval gate
   - [ ] See notification in UI
   - [ ] Approve via modal
   - [ ] Verify task proceeds

7. **Test Admin Controls**
   - [ ] Go to /admin
   - [ ] Pause all agents
   - [ ] Verify agents stop processing
   - [ ] Resume agents
   - [ ] Verify agents resume

---

## Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Check connection string in .env
```

### WebSocket Not Connecting
- Check CORS settings in server.ts
- Verify frontend NEXT_PUBLIC_API_URL matches backend

### Prisma Errors
```bash
npx prisma generate
npx prisma db push --force-reset  # WARNING: Deletes all data
```

### Docker Sandbox Fails
```bash
# Check Docker is running
docker info

# Pull required image
docker pull node:20-alpine
```

---

## Test Results Checklist

| Test | Status | Notes |
|------|--------|-------|
| Health endpoint | ⬜ | |
| Dashboard metrics | ⬜ | |
| Approval gates CRUD | ⬜ | |
| Memory storage | ⬜ | |
| Memory search | ⬜ | |
| Git init | ⬜ | |
| Admin KPIs | ⬜ | |
| Budget pause/resume | ⬜ | |
| Trace verification | ⬜ | |
| Frontend loads | ⬜ | |
| WebSocket connects | ⬜ | |
| Create project flow | ⬜ | |
| Approval notification | ⬜ | |

---

## Next Steps After Testing

Once all tests pass:
1. Add your GEMINI_API_KEY to .env
2. Test Socratic Interrogator with real LLM
3. Test agent task execution with real LLM
4. Monitor costs in admin dashboard
