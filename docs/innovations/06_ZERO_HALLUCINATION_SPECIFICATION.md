# Zero-Hallucination System: Production Specification

## Priority Matrix

| Concept | Priority | Complexity | Approach |
|---------|----------|------------|----------|
| **Sandbox Service** | 🔴 CRITICAL | High | Docker containers with resource limits |
| Symbolic Hashing | 🟡 Medium | Medium | Simple structural hash first, AST later |
| Entropy Detection | 🟢 Low | Low | Line count + import counting heuristic |
| Holographic Memory | 🟡 Medium | Medium | Vector DB with composite embeddings |
| CRDT Sync | 🟡 Medium | High | Redis pub/sub first, CRDT only for conflicts |

---

## 1. Sandbox Execution Service (CRITICAL PATH)

### Decision Tree
```
Is the agent trusted? (e.g., your own MidDev agent)
├── Yes → Use Node.js `vm` module
│   ├── Timeout: 10 seconds
│   ├── Memory: 512MB
│   └── Allowed: All Node modules except fs, child_process
│
└── No → Use Docker container
    ├── Image: node:20-slim
    ├── Timeout: 30 seconds
    ├── Memory: 1GB
    ├── Read-only filesystem
    └── Network: isolated (or allow npm registry only)
```

### Implementation
```typescript
// backend/src/services/SandboxService.ts
import { NodeVM, VM2 } from 'vm2';
import Docker from 'dockerode';

class SandboxService {
  private executionLayers = {
    'trusted': new NodeVM({ timeout: 10000, sandbox: {}, eval: false, wasm: false }),
    'untrusted': new VM2({ timeout: 5000, memoryLimit: 128, allowAsync: true }),
    'dangerous': new DockerSandbox({ image: 'node:20-alpine', timeout: 30000, memory: '256m', readOnly: true, network: 'none' }),
  };

  async execute(code: string, context: ExecutionContext): Promise<Result> {
    const riskLevel = this.assessRisk(code, context);
    const sandbox = this.executionLayers[riskLevel];
    return await sandbox.run(code, {
      timeout: this.getTimeout(context),
      memoryLimit: this.getMemoryLimit(context),
      allowedModules: this.getAllowedModules(context.agentId),
    });
  }
}
```

---

## 2. Symbolic Logic Hashing

### Phase 1: Simple Structural Hash
```typescript
const structuralHash = (code: string): string => {
  const stripped = code.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  const lines = stripped.split(';').filter(l => l.trim());
  const sorted = lines.sort((a, b) => {
    if (!hasDependencies(a, b) && !hasDependencies(b, a)) return a.localeCompare(b);
    return 0;
  });
  return sha256(sorted.join(';'));
};
```

### Phase 2: AST-Based (for critical code)
- Use `@typescript-eslint/typescript-estree` for parsing
- Focus on functions > 10 lines
- Cache hashes per file

---

## 3. Entropy / Hallucination Detection

### Simple Heuristic That Works
```typescript
function detectPotentialHallucination(task: Task, code: string): boolean {
  // Heuristic 1: Output much longer than expected
  const expectedLines = task.complexity * 10;
  if (code.split('\n').length > expectedLines * 3) return true;
  
  // Heuristic 2: Too many new concepts
  if (countNewImports(code, task.context) > 2) return true;
  
  // Heuristic 3: Low test coverage correlation
  if (estimateTestability(code) < 0.3) return true;
  
  return false;
}
```

### Role Baselines
| Role | Max Complexity Ratio | Min Similarity |
|------|---------------------|----------------|
| SeniorDev | 1.2 | 0.7 |
| JuniorDev | 1.5 | 0.6 |
| Architect | 2.0 | 0.4 |
| Tester | 1.1 | 0.9 |

---

## 4. Holographic Memory (Simplified)

### Use Vector DB with Composite Keys
```typescript
class SimpleMemoryVectorStore {
  async storeMemory(agent: string, task: string, content: string) {
    const composite = this.averageVectors([
      await embed(`agent:${agent}`),
      await embed(`task:${task}`),
      await embed(content)
    ]);
    await vectorDB.upsert({ id: `${agent}|${task}|${Date.now()}`, values: composite, metadata: { agent, task, content } });
  }

  async query(agent: string, task: string): Promise<Memory[]> {
    const queryEmbedding = await embed(`agent:${agent} task:${task}`);
    return await vectorDB.query({ vector: queryEmbedding, topK: 10, filter: { agent, task } });
  }
}
```

---

## 5. CRDT / Context Sync

### Phase 1: Redis Pub/Sub (Week 1-2)
```typescript
redis.subscribe(`context:${taskId}`, (message) => {
  this.context = JSON.parse(message);
});
```

### Phase 2: CRDT for Conflict-Prone Fields (Week 3-4)
- Architecture decisions
- Database choices
- API contracts

---

## 2-Week Implementation Plan

### Week 1: Foundation
- [ ] Docker sandbox service *(blocking)*
- [ ] Simple structural hashing
- [ ] Line-count entropy detector
- [ ] Redis-based context sync

### Week 2: Enhancement
- [ ] Trusted agent optimization (vm module)
- [ ] AST-based hashing for critical code
- [ ] Vector DB memory system
- [ ] Conflict detection (not resolution)
