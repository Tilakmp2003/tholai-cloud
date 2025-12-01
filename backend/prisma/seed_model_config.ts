import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const AGENT_CONFIGS = [
  {
    role: "Architect",
    specialization: "System Design & Strategy",
    modelConfig: {
      "primary": { "provider": "bedrock", "model": "deepseek.v3-v1:0", "region": "ap-south-1", "temperature": 0.0, "max_tokens": 4000, "estimated_cost_per_1k_tokens_usd": 0.00068 },
      "fallback": { "provider": "bedrock", "model": "deepseek.r1-v1:0", "region": "us-east-1", "temperature": 0.0, "max_tokens": 4000, "estimated_cost_per_1k_tokens_usd": 0.008 },
      "allowed_actions": ["plan_architecture","approve_api_schema","authorize_deploy"],
      "cost_limit_per_task_usd": 15.0,
      "timeout_ms": 600000
    }
  },
  {
    role: "SeniorDev",
    specialization: "Complex Logic & Refactoring",
    modelConfig: {
      "primary": { "provider": "bedrock", "model": "deepseek.v3-v1:0", "region": "ap-south-1", "temperature": 0.1, "max_tokens": 4000, "estimated_cost_per_1k_tokens_usd": 0.00068 },
      "fallback": { "provider": "bedrock", "model": "deepseek.r1-v1:0", "region": "us-east-1", "temperature": 0.1, "max_tokens": 4000, "estimated_cost_per_1k_tokens_usd": 0.008 },
      "allowed_actions": ["refactor_code", "optimize_performance", "debug_complex_issue"],
      "cost_limit_per_task_usd": 10.0,
      "timeout_ms": 600000
    }
  },
  {
    role: "Designer",
    specialization: "UI/UX Design",
    modelConfig: {
      "primary": { "provider": "bedrock", "model": "deepseek.v3-v1:0", "region": "ap-south-1", "temperature": 0.55, "max_tokens": 4000, "estimated_cost_per_1k_tokens_usd": 0.00068 },
      "fallback": { "provider": "bedrock", "model": "deepseek.r1-v1:0", "region": "us-east-1", "temperature": 0.55, "max_tokens": 4000, "estimated_cost_per_1k_tokens_usd": 0.008 },
      "allowed_actions": ["create_design_system", "generate_wireframes", "create_react_stubs"],
      "cost_limit_per_task_usd": 5.0,
      "timeout_ms": 450000
    }
  },
  {
    role: "TeamLead",
    specialization: "Project Management & Review",
    modelConfig: {
      "primary": { "provider": "bedrock", "model": "deepseek.v3-v1:0", "region": "ap-south-1", "temperature": 0.2, "max_tokens": 2000, "estimated_cost_per_1k_tokens_usd": 0.00068 },
      "fallback": { "provider": "bedrock", "model": "deepseek.r1-v1:0", "region": "us-east-1", "temperature": 0.2, "max_tokens": 2000, "estimated_cost_per_1k_tokens_usd": 0.008 },
      "allowed_actions": ["review_code", "merge_pr", "assign_tasks"],
      "cost_limit_per_task_usd": 8.0,
      "timeout_ms": 500000
    }
  },
  {
    role: "MidDev",
    specialization: "Feature Implementation",
    modelConfig: {
      "primary": { "provider": "bedrock", "model": "deepseek.v3-v1:0", "region": "ap-south-1", "temperature": 0.2, "max_tokens": 2000, "estimated_cost_per_1k_tokens_usd": 0.00068 },
      "fallback": { "provider": "bedrock", "model": "deepseek.r1-v1:0", "region": "us-east-1", "temperature": 0.3, "max_tokens": 2000, "estimated_cost_per_1k_tokens_usd": 0.008 },
      "allowed_actions": ["write_code","run_unit_tests","create_patch"],
      "cost_limit_per_task_usd": 4.0,
      "timeout_ms": 450000
    }
  },
  {
    role: "JuniorDev",
    specialization: "Simple Tasks & Edits",
    modelConfig: {
      "primary": { "provider": "bedrock", "model": "meta.llama3-8b-instruct-v1:0", "temperature": 0.3, "max_tokens": 1000, "estimated_cost_per_1k_tokens_usd": 0.0004 },
      "fallback": { "provider": "bedrock", "model": "deepseek.v3-v1:0", "region": "ap-south-1", "temperature": 0.3, "max_tokens": 1000, "estimated_cost_per_1k_tokens_usd": 0.00068 },
      "allowed_actions": ["fix_typo", "update_docs", "simple_refactor"],
      "cost_limit_per_task_usd": 1.0,
      "timeout_ms": 120000
    }
  },
  {
    role: "QA",
    specialization: "Testing & Quality Assurance",
    modelConfig: {
      "primary": { "provider": "bedrock", "model": "meta.llama3-8b-instruct-v1:0", "temperature": 0.0, "max_tokens": 1000, "estimated_cost_per_1k_tokens_usd": 0.0004 },
      "fallback": { "provider": "bedrock", "model": "deepseek.v3-v1:0", "region": "ap-south-1", "temperature": 0.0, "max_tokens": 1000, "estimated_cost_per_1k_tokens_usd": 0.00068 },
      "allowed_actions": ["run_test_suite", "analyze_coverage", "report_bug"],
      "cost_limit_per_task_usd": 2.0,
      "timeout_ms": 300000
    }
  },
  {
    role: "Socratic",
    specialization: "Requirements Clarification",
    modelConfig: {
      "primary": { "provider": "bedrock", "model": "meta.llama3-8b-instruct-v1:0", "temperature": 0.0, "max_tokens": 1000, "estimated_cost_per_1k_tokens_usd": 0.0004 },
      "fallback": { "provider": "bedrock", "model": "deepseek.v3-v1:0", "region": "ap-south-1", "temperature": 0.0, "max_tokens": 1000, "estimated_cost_per_1k_tokens_usd": 0.00068 },
      "allowed_actions": ["ask_clarifying_questions", "identify_ambiguity"],
      "cost_limit_per_task_usd": 1.0,
      "timeout_ms": 120000
    }
  },
  {
    role: "Canary",
    specialization: "Probing & Validation",
    modelConfig: {
      "primary": { "provider": "bedrock", "model": "deepseek.v3-v1:0", "region": "ap-south-1", "temperature": 0.1, "max_tokens": 500, "estimated_cost_per_1k_tokens_usd": 0.00068 },
      "fallback": { "provider": "bedrock", "model": "deepseek.r1-v1:0", "region": "us-east-1", "temperature": 0.1, "max_tokens": 500, "estimated_cost_per_1k_tokens_usd": 0.008 },
      "allowed_actions": ["ping_api", "check_health", "validate_config"],
      "cost_limit_per_task_usd": 0.5,
      "timeout_ms": 60000
    }
  },
  {
    role: "AgentOps",
    specialization: "Observability & Logs",
    modelConfig: {
      "primary": { "provider": "bedrock", "model": "meta.llama3-8b-instruct-v1:0", "temperature": 0.0, "max_tokens": 2000, "estimated_cost_per_1k_tokens_usd": 0.0004 },
      "fallback": { "provider": "bedrock", "model": "deepseek.v3-v1:0", "region": "ap-south-1", "temperature": 0.0, "max_tokens": 2000, "estimated_cost_per_1k_tokens_usd": 0.00068 },
      "allowed_actions": ["summarize_logs", "analyze_trace", "detect_anomalies"],
      "cost_limit_per_task_usd": 2.0,
      "timeout_ms": 180000
    }
  }
];

async function main() {
  console.log('🌱 Seeding Agent Model Configs...');

  for (const config of AGENT_CONFIGS) {
    // Upsert agent based on role
    // Note: In a real app, you might want to find by ID or handle duplicates differently.
    // Here we assume one agent per role for simplicity or update the first one found.
    
    // First, try to find an existing agent with this role
    const existingAgent = await prisma.agent.findFirst({
      where: { role: config.role }
    });

    if (existingAgent) {
      console.log(`Updating config for ${config.role}...`);
      await prisma.agent.update({
        where: { id: existingAgent.id },
        data: {
          modelConfig: config.modelConfig,
          specialization: config.specialization
        }
      });
    } else {
      console.log(`Creating new agent for ${config.role}...`);
      await prisma.agent.create({
        data: {
          role: config.role,
          specialization: config.specialization,
          modelConfig: config.modelConfig,
          status: 'IDLE'
        }
      });
    }
  }

  console.log('✅ Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
