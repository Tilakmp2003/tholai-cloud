# Virtual Software Company — System Architecture & End-to-End Workflow  
**Version:** 1.0  
**Document Type:** Technical Architecture & Process Specification  
**Author:** (You)  
**Status:** Draft / Internal  

---

## 0. Purpose of This Document

This document describes, in **industrial-standard detail**, the complete architecture and working flow of the **Virtual Software Company** — an AI-driven, hierarchical multi-agent platform that behaves like a real IT services firm.

It covers:

- System goals & positioning  
- Organizational hierarchy (roles & responsibilities)  
- Core system components (Orchestrator, DB, Agent runtime, RAG, AgentOps)  
- Data model (ContextPackets, Tasks, Metrics, Traces)  
- Step-by-step workflows from **client request → delivery → governance → debugging**  
- Safety, cost control, and optimization mechanisms  

This is written to a level where a CTO / senior engineer could begin implementation.

---

## 1. System Overview

### 1.1 What Is the Virtual Software Company?

The Virtual Software Company is a **Multi-Agent System (MAS)** that:

- Simulates a **real-world software engineering organization**
- Uses **LLM agents** as "employees" (PMs, Architects, Devs, QA, Security, etc.)
- Is governed by strict **hierarchy, policies, and metrics**
- Executes software projects in an **auditable, controlled, cost-aware** way

You do **not** build "just an AI coder".  
You build an **autonomous digital workforce** that is managed like a real IT company.

---

### 1.2 Core Design Principles

1. **Hierarchy over Chaos**  
   All agents operate in a **clear chain of command**; no free-for-all chats.

2. **Context via Packets, Not Chats**  
   Work is assigned through **structured JSON ContextPackets**, not unstructured prompts.

3. **Governance & Accountability**  
   Agents can be monitored, scored, downgraded, or terminated based on performance.

4. **Economic Efficiency**  
   Use **serverless, ephemeral runtimes** and **elastic hierarchy routing** to keep costs low.

5. **Traceability & Forensics**  
   Every decision is recorded so you can see **why** the system behaved as it did.

6. **Human in the Loop Where It Matters**  
   AI automates the **95% engineering bulk**, humans handle **5% research / novel tasks**.

---

## 2. Organizational Hierarchy (Roles & Responsibilities)

The system mirrors a modern software company.

### 2.1 Role Levels

- **L4 — Executive**
  - **CEO Agent**
  - **CTO Agent**

- **L3 — Management**
  - **Product Manager (PM) Agent**
  - **Team Lead Agent**
  - **Delivery/Project Manager Agent (optional)**

- **L2 — Senior Engineering**
  - **Architect Agent**
  - **Senior Developer Agent**

- **L1 — Execution**
  - **Mid-Level Developer Agent**
  - **Junior Developer Agent**

- **L0 — Support & Assurance**
  - **QA Engineer Agent**
  - **Security Analyst Agent**
  - **Ops/DevOps Agent**

- **Special**
  - **Socratic Interrogator Agent**
  - **Canary Probing Agent**
  - **AgentOps / Observability components (non-LLM logic)**

---

### 2.2 High-Level Responsibilities

**CEO Agent (L4)**  
- Understands global business goal of the client project  
- Approves final deliverable at a conceptual level  
- Sets strategic non-functional requirements (quality, cost, timeline)

**CTO Agent (L4)**  
- Defines technology standards (languages, frameworks, infra patterns)  
- Approves major architectural decisions  
- Oversees security & compliance standards  

**Product Manager (PM) Agent (L3)**  
- Interfaces with client requirement (with Socratic Interrogator)  
- Produces a **Product Requirements Document (PRD)**  
- Creates feature backlog and priorities  
- Classifies tasks as **Engineering vs Research**  

**Team Lead Agent (L3)**  
- Breaks PRD into **modules / tasks**  
- Assigns tasks to Dev Agents  
- Owns **module-level quality & delivery**  
- Handles Dev escalations (context, ambiguity, blockers)

**Architect / Senior Dev (L2)**  
- Designs system architecture, APIs, data models  
- Handles **complex or critical** features  
- Acts as internal expert on a module or service

**Mid / Junior Dev (L1)**  
- Implement features, bugfixes, UI, tests  
- Follow constraints in **ContextPackets**  
- Ask for help via **ContextRequests** when blocked

**QA & Security (L0)**  
- QA: Validate correctness and behavior vs PRD  
- Security: Scan for vulnerabilities, misconfigurations  
- Block unsafe deployments

**Ops Agent (L0)**  
- Prepares CI/CD, deployment manifests  
- Ensures code is shippable in a production-like environment

**Socratic Interrogator Agent**  
- Challenges client's vague requirements  
- Forces clarity before work begins  

**Canary Probing Agent**  
- Verifies real behavior of external APIs/tools  
- Updates context with ground truth  
- Prevents documentation-driven hallucinations

---

## 3. Core System Components

### 3.1 Orchestrator Service

The **Orchestrator** is the brain that:

- Reads from DB (tasks, metrics, escalations)  
- Assigns work to the correct agents  
- Runs **Dispatch, Escalation, Governance, and Optimization** loops  
- Manages agent lifecycle (hydrate → execute → dehydrate)  

### 3.2 Agent Runtime (Serverless / Ephemeral)

- Agents are **not** always running containers  
- Agents are **definitions + state in DB**  
- When needed:
  - Orchestrator spins up a short-lived runtime (e.g. Firecracker, Lambda, Fargate)  
  - Injects system prompt, role profile, and ContextPacket  
  - Executes the agent's task  
  - Saves outputs + metrics  
  - Shuts down the runtime  

### 3.3 Data Layer (PostgreSQL + Vector Store)

**Relational DB (Postgres)** holds:

- Agents  
- Projects & Modules  
- Tasks & ContextPackets  
- Context Escalations  
- Metrics & Aggregates  
- Traces (AgentOps logs)  

**Vector Store** holds:

- PRDs  
- Architecture docs  
- API docs  
- Knowledge base  
- Linked via IDs (e.g., `REQ-102`, `ARCH-DB-V2`)

### 3.4 RAG Layer (Immutable Referencing)

- Agents don't rely only on **hierarchical summaries**  
- They use **RAG** to fetch the original PRD sections using IDs embedded in ContextPacket  
- Prevents "Telephone Game" effect

### 3.5 AgentOps & Observability

- **Trace IDs** track reasoning chains across agents and tools  
- **Trace Steps** record:
  - thought snippets  
  - tool calls  
  - tool outputs  
  - errors  
- Used to:
  - Debug failed tasks  
  - Determine blame (Agent vs Manager vs Docs)  
  - Power **Traceability Insurance**

---

## 4. Data Model & Key Entities

### 4.1 Agents Table (Workforce Registry)

- `agent_id` (UUID)  
- `role` (`CEO`, `CTO`, `PM`, `TeamLead`, `SeniorDev`, `MidDev`, `JuniorDev`, `QA`, `Security`, `Ops`)  
- `specialization` (e.g., `Auth`, `Payments`, `Frontend`)  
- `status` (`IDLE`, `BUSY`, `RESTRICTED`, `OFFLINE`)  
- `model_config` (JSONB, which LLM, temperature, etc.)  
- `total_cost_incurred` (DECIMAL)  
- `intervention_count` (INT) — how many times "Governance" had to correct them  

---

### 4.2 Projects & Modules

**Projects Table**

- `project_id`  
- `name`  
- `client_name`  
- `status` (`PLANNED`, `ACTIVE`, `ON_HOLD`, `COMPLETED`)  

**Modules Table**

- `module_id`  
- `project_id`  
- `owner_agent_id` (Team Lead)  
- `parent_module_id` (optional, hierarchy)  
- `tech_stack` (JSONB)  
- `constraints` (JSONB)  
- `docs_refs` (e.g., [`ARCH-001`, `SCHEMA-USER-V2`])  
- `status`  

---

### 4.3 Tasks & ContextPackets

**Tasks Table**

- `task_id`  
- `module_id`  
- `assigned_to_agent`  
- `required_role`  
- `complexity_score` (0–100)  
- `task_type` (`FEATURE`, `BUGFIX`, `REFACTOR`, `TEST_ONLY`)  
- `context_packet` (JSONB snapshot)  
- `status` (`QUEUED`, `ASSIGNED`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `REJECTED`, `APPROVED`, `NEEDS_REASSIGNMENT`)  
- `retry_count`  

**ContextPacket (JSON Schema, logical)**

```json
{
  "schema_version": "1.0",
  "packet_id": "ctx_849201",
  "trace_id": "trace_7b12f9",
  "timestamp": "2025-11-23T14:00:00Z",
  "hierarchy": {
    "project_id": "PROJ-001",
    "module_id": "AUTH-001",
    "assigned_agent_id": "MidDev-Agent-12",
    "assigned_agent_role": "MidDev"
  },
  "task_definition": {
    "task_id": "TASK-LOGIN-API-03",
    "summary": "Implement POST /login endpoint with Redis-backed session",
    "priority": "HIGH",
    "task_type": "FEATURE",
    "acceptance_criteria": [
      "POST /login with email+password",
      "401 on invalid credentials",
      "Session stored in Redis",
      "Latency < 200ms under normal load"
    ],
    "requirements_links": [
      "vector://prds/PRD_AUTH#REQ-102"
    ]
  },
  "technical_context": {
    "tech_stack": ["Node.js", "Express", "Redis", "PostgreSQL"],
    "constraints": [
      "Use 'app_users' table from schema v2",
      "Passwords hashed using bcrypt",
      "Do not modify auth middleware"
    ],
    "dependencies": [
      {
        "service_id": "REDIS-SESSION-STORE",
        "interface_def": "lib/redisClient.js"
      }
    ],
    "shared_docs_refs": [
      "ARCH://AUTH-SERVICE-V2",
      "SCHEMA://USERS-V2"
    ]
  },
  "quality_gates": {
    "testing_requirements": ["Unit test valid login", "Unit test 401 case"],
    "linting_rules": "standard-js",
    "coverage_minimum": 0.8,
    "security_level": "HIGH"
  },
  "communication_channel": {
    "supervisor_id": "TeamLead-Agent-AUTH",
    "escalation_trigger": "IF_BLOCKED_10_MINUTES",
    "allowed_contacts": ["TeamLead-Agent-AUTH"],
    "log_channel_id": "log_auth_team"
  }
}
```

---

### 4.4 Context Escalations

- `escalation_id`
- `task_id`
- `from_agent_id`
- `to_agent_id`
- `issue_type` (`MISSING_INFORMATION`, `AMBIGUITY`, `CONFLICT`, `BLOCKED_DEPENDENCY`)
- `question`
- `resolution`
- `resolved_at`

---

### 4.5 Traces (AgentOps)

**Traces Table**

- `trace_id`
- `project_id`
- `task_id`
- `root_agent_id`
- `final_outcome`
- `termination_reason` (optional)

**TraceSteps Table**

- `trace_step_id`
- `trace_id`
- `step_number`
- `timestamp`
- `agent_id`
- `action_type` (`READ_CONTEXT`, `THOUGHT`, `TOOL_CALL`, `TOOL_RESULT`, `CONTEXT_REQUEST`, `ERROR`, `KILL`)
- `payload` (JSONB: thought snippet, tool args, etc.)

---

## 5. End-to-End Workflow (Step by Step)

This section shows the full flow from client request to delivery, including governance and debugging.

### 5.1 Phase 0 – Client Intake & Requirement Clarification

**Step 0.1 – Initial Request**

Human user (client) submits a high-level request:

> "Build a login page with email/password."

**Step 0.2 – Socratic Phase (Interrogator Agent)**

Socratic Interrogator Agent analyzes request and computes an `ambiguity_score`.

If `ambiguity_score > threshold` (e.g., 10%):

Interrogator asks structured questions:

- "Do you need OAuth (Google/Apple)?"
- "Should there be 2FA?"
- "What is session timeout duration?"
- "Any password complexity rules?"

Loop continues until:

- `ambiguity_score ≤ threshold`
- Key constraints are defined

**Output:**

- A clean, structured requirement fed to PM Agent
- All Q&A logged and linked as artifacts (for auditing)

---

### 5.2 Phase 1 – PRD & Project Setup

**Step 1.1 – PM Agent Creates PRD**

PM Agent converts clarified requirements into a PRD document:

- Features, user stories, non-functional requirements
- Each requirement gets IDs: `REQ-101`, `REQ-102`, etc.

**Step 1.2 – Executive & CTO Guidance**

**CEO Agent:**

- Confirms high-level business goals

**CTO Agent:**

- Chooses global architecture patterns
- Defines stack (e.g., Node/React/Postgres)
- Sets security and performance guidelines

**Step 1.3 – Project & Module Creation in DB**

**Orchestrator:**

- Creates `Projects` and `Modules` rows
- Links PRD docs to `docs_refs` fields
- Assigns initial Team Leads & Architects

---

### 5.3 Phase 2 – Architecture & Module Design

**Step 2.1 – Architect Agent Designs System**

Architect retrieves PRD via RAG:

- `REQ-101`, `REQ-102`, etc.

Produces:

- API endpoints
- DB schemas
- Service boundaries (modules)
- Diagrams, constraints

**Step 2.2 – Team Lead Decomposes Into Modules & Tasks**

Team Lead:

- Splits system into modules like:
  - `AUTH-SERVICE`, `USER-PROFILE`, `FRONTEND-LOGIN`

- Creates Tasks:
  - e.g., `TASK-LOGIN-API-03`, `TASK-LOGIN-UI-02`

- Assigns:
  - Required role
  - Complexity score
  - Task type

**Step 2.3 – Research vs Engineering Classification**

PM Agent:

- Tags each task:
  - **Engineering Task** → AI Swarm
  - **Research Task** → Human Escalation Queue (e.g., new compression algorithm)

---

### 5.4 Phase 3 – Fast-Track Routing (Elastic Hierarchy)

For each task:

**Step 3.1 – Orchestrator Applies Fast-Track Logic**

Uses `complexity_score` and `task_type` to pick path:

| Complexity | Example Task | Flow |
|------------|-------------|------|
| 0–20 | CSS tweak, label change | Junior Dev → Reviewer |
| 21–60 | Bug fix, simple business logic | Team Lead → Mid Dev → QA |
| 61–100 | New feature, security-sensitive | Architect → Team Lead → Senior Dev → QA → Head approval |

**Result:**  
Senior/time-expensive agents are only used where needed.

---

### 5.5 Phase 4 – Canary Validation for External Integrations

If a task depends on external APIs (Stripe, Twilio, etc.):

**Step 4.1 – Canary Probing Agent Run**

- Orchestrator detects external dependency in `ContextPacket.dependencies`
- Spawns **Canary Probing Agent**:
  - Writes tiny test script calling the API
  - Confirms field names, auth requirements, response structures
  - Updates:
    - Module constraints
    - `ContextPacket.technical_context` with actual, not theoretical, behavior

This ensures development is based on reality, not outdated docs.

---

### 5.6 Phase 5 – Development Execution (Async Mode)

**Step 5.1 – Dispatch Loop Assigns Tasks**

For each `QUEUED` task:

- Select suitable agent (role + specialization + available)
- Build `ContextPacket` for that agent
- Hydrate runtime for agent
- Pass `ContextPacket` + role system prompt
- Mark task `ASSIGNED` → `IN_PROGRESS`

**Step 5.2 – Dev Agent Work Cycle**

Within its runtime, Dev Agent:

- Reads `ContextPacket`
- Fetches original PRD sections via RAG using `requirements_links`
- Writes code / tests in sandboxed environment
- Runs unit tests locally
- Produces patch + test results

**Step 5.3 – QA/Security Review**

**QA Agent:**

- Validates behavior vs acceptance criteria
- Runs integration tests

**Security Agent:**

- Scans for vulnerabilities (OWASP, CWE patterns)

If all good → mark `APPROVED`  
If not → reject with structured feedback, increment `retry_count`

---

### 5.7 Phase 6 – War Room Mode (Sync Collaboration)

If `retry_count > threshold` for a given task:

**Step 6.1 – Orchestrator Detects Deadlock**

- E.g., `retry_count >= 3`
- Task stuck in `REJECTED` state repeatedly

**Step 6.2 – War Room Session Created**

Orchestrator creates a shared session with:

- Dev Agent
- QA Agent
- Optional Team Lead

Provides:

- Current code
- Error logs
- Test failures
- PRD requirement sections

System prompt:

> "You are stuck in a loop. Collaborate to resolve the issue and produce one final patch. Do not exit until you agree on a single solution."

**Step 6.3 – War Room Output**

- One final patch
- Clear reasoning logged as `TraceSteps`
- QA re-runs tests
- If successful → `APPROVED`

---

### 5.8 Phase 7 – Governance & Termination

**Step 7.1 – Metrics Collection**

For each agent session:

Log:

- `tokens_input`, `tokens_output`, `execution_time_ms`, `estimated_cost_usd`
- `status` (success/failure)
- `context_request_count`
- `code_quality_score`

**Step 7.2 – Governance Loop Runs Periodically**

For each agent:

Compute:

- `avg_cost_per_task`
- `rejection_rate`
- `avg_quality_score`
- `interventions` count

If agent underperforms vs role median:

- **First time:**
  - Adjust prompts or restrict responsibilities (coaching)

- **Second time:**
  - Downgrade role or restrict to simpler tasks

- **Third time:**
  - Terminate (set status `OFFLINE`, reassign tasks)

**Step 7.3 – Blame Analysis via AgentOps**

On serious failures or high cost incidents, use Trace Logs to determine:

- **Agent Fault:**
  - Looping tool calls
  - Ignoring clear errors

- **Manager Fault:**
  - Impossible constraints
  - Misleading context

- **API/External Fault:**
  - Unexpected external behavior

System can:

- Reinstate wrongly terminated agents
- Flag problematic Team Leads
- Update documentation and constraints

---

### 5.9 Phase 8 – Delivery, Compliance & Insurance

**Step 8.1 – Final Approval & Artifacts**

Head/CTO/CEO Agents review:

- Test reports
- Security results
- Code structure summaries

Mark project `COMPLETED`

**Step 8.2 – Traceability Certificate**

For enterprise clients:

- Generate a **Compliance Certificate**:
  - Includes:
    - Task list
    - Responsible agents
    - Trace IDs for each critical feature
    - Summary of checks performed (QA, Security, Governance)

**Step 8.3 – Warranty / Insurance Model**

If client opts for **Traceability Insurance**:

- If a defect or bug is discovered:
  - Use Trace to determine cause
  - If AI/Agent error:
    - Platform covers fix effort (e.g., free patch, SLA credit)
  - If client spec ambiguity:
    - Client pays for change

This converts the legal risk into a paid assurance product.

---

## 6. Safety, Cost, and Industrial Standards

### 6.1 Cost Control

- Elastic hierarchy ensures not every task goes to Senior/Architect/Head
- Serverless agents avoid idle resource cost
- Governance loop prevents runaway agents
- Canary agents prevent large expensive rebuilds due to API drift

### 6.2 Reliability & Quality

- Double review: Team Lead + QA/Security
- War Room sync mode to resolve deadlocks
- Immutable referencing to avoid requirement distortion
- Canary probing to align with real-world API behavior

### 6.3 Enterprise Standards

- Full audit trail via AgentOps
- Traceable & explainable decisions
- Clear separation of:
  - Business logic
  - System architecture
  - Implementation
  - Testing
  - Security

---

## 7. Implementation Sequence (High-Level)

**Week 1–2: Foundation**

- DB schema, ContextPacket, Projects/Modules/Tasks tables
- Basic Orchestrator + minimal Agent runtime integration

**Week 3–4: MVP Agents & Core Loops**

- PM, Architect, Dev, QA as LLM-backed roles
- Dispatch loop, Escalation loop
- Module-based small demo project

**Week 5–6: Governance Layer**

- Metrics, agent scoring, intervention & termination mechanics
- Cost limits, retry thresholds

**Week 7–8: AgentOps & War Room**

- Trace logs, visualization, blame analysis functions
- War Room synchronous session logic

**Week 9–12: Optimizations & Enterprise Hardening**

- Elastic hierarchy rules
- Canary probing agent
- Socratic Interrogator on intake
- Traceability Insurance packaging

---

## 8. Conclusion

This document defines:

- A complete architecture for an AI-powered virtual software company
- A clear hierarchy of agents and responsibilities
- A robust data model for tasks, context, metrics, and traces
- Step-by-step workflows from requirement → design → development → QA → governance → delivery
- Advanced mechanisms for:
  - Cost control
  - Safety
  - Forensics
  - Real-world integration
  - Legal/compliance readiness

With this specification, you can:

- Start implementing the MVP
- Onboard engineers / collaborators
- Present a credible plan to investors or enterprises

You now have a full industrial-grade blueprint for your project.