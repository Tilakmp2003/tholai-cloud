# Quick Testing Guide

## Step 1: Start Services

### Terminal 1 - Database (if not running)
```bash
# Make sure PostgreSQL is running
pg_isready -h localhost -p 5432
```

### Terminal 2 - Backend
```bash
cd backend
npx prisma generate
npx prisma db push
npm run dev
```

Wait for:
```
🚀 Server running on http://localhost:4000
📡 WebSocket ready for real-time updates
```

### Terminal 3 - Frontend
```bash
cd frontend
npm run dev
```

Open: http://localhost:3000

---

## Step 2: Seed Test Data

```bash
cd backend
npx tsx src/tests/seed_test_data.ts
```

---

## Step 3: Run Unit Tests

```bash
cd backend
npx tsx src/tests/run_all_tests.ts
```

Expected: All tests pass ✅

---

## Step 4: Test API Endpoints

```bash
cd backend
npx tsx src/tests/test_api_endpoints.ts --live
```

---

## Step 5: Test Frontend UI

Open http://localhost:3000 and verify:

| Page | What to Check |
|------|---------------|
| `/` (Command Center) | KPIs load, logs show, WebSocket connected |
| `/admin` | All tabs work, can pause/resume |
| `/agents` | Agent list displays |
| `/pipeline` | Tasks display by status |

---

## Step 6: Test Create Project Flow

1. Click "Initialize Project" button
2. Enter: Name = "Test Project", Description = "Build a todo app"
3. Click "Analyze Requirements Clarity"
4. See questions appear (Socratic working)
5. Answer questions or click "Skip"
6. Submit project
7. Check database: `SELECT * FROM "Project" ORDER BY "createdAt" DESC LIMIT 1;`

---

## Step 7: Test Approval Flow

### Create a test approval gate:
```bash
curl -X POST http://localhost:4000/api/approvals/configure \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","enabledGates":["PRE_COMMIT"]}'
```

### Trigger an approval (simulated):
```bash
# This would normally happen when an agent commits code
# For testing, check the /admin page for pending approvals
```

---

## Step 8: Test Memory System

```bash
# Store a memory
curl -X POST http://localhost:4000/api/memory/best-practice \
  -H "Content-Type: application/json" \
  -d '{"category":"auth","title":"JWT Pattern","content":"Always use RS256"}'

# Search memories
curl -X POST http://localhost:4000/api/memory/search \
  -H "Content-Type: application/json" \
  -d '{"context":{"summary":"authentication"},"agentRole":"MidDev"}'

# Check stats
curl http://localhost:4000/api/memory/stats
```

---

## Step 9: Test Admin Controls

1. Go to http://localhost:3000/admin
2. Click "Pause All" → verify agents stop
3. Click "Resume All" → verify agents resume
4. Check Safety tab → add a package to allowlist
5. Check Memory tab → run purge cycle
6. Check Trace tab → verify integrity

---

## Step 10: Test with Real LLM (Optional)

Your `.env` already has API keys. To test:

1. Create a new project with detailed requirements
2. Watch the agents process tasks in real-time
3. Monitor costs in admin dashboard

---

## Troubleshooting

### "Cannot connect to database"
```bash
# Check PostgreSQL
pg_isready -h localhost -p 5432

# Reset database
cd backend
npx prisma db push --force-reset
```

### "WebSocket not connecting"
- Check browser console for errors
- Verify backend is running on port 4000
- Check CORS settings

### "LLM calls failing"
```bash
# Enable mock mode for testing
echo 'USE_MOCK_LLM="true"' >> backend/.env
# Restart backend
```

### "Frontend not loading"
```bash
cd frontend
rm -rf .next node_modules
npm install
npm run dev
```

---

## Test Checklist

- [ ] Backend starts without errors
- [ ] Frontend loads
- [ ] WebSocket connects (green dot)
- [ ] Unit tests pass
- [ ] API endpoints respond
- [ ] Create project works
- [ ] Socratic questions appear
- [ ] Admin dashboard loads
- [ ] Pause/Resume works
- [ ] Memory storage works
- [ ] Memory search works

Once all ✅, you're ready for production testing with real LLM calls!
