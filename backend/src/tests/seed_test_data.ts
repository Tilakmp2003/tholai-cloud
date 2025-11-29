/**
 * Seed Test Data
 * 
 * Creates sample data for testing without LLM calls.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding test data...\n');

  // Clean existing data (optional - comment out to preserve)
  console.log('Cleaning existing data...');
  await prisma.trace.deleteMany();
  await prisma.taskMetrics.deleteMany();
  await prisma.contextRequest.deleteMany();
  await prisma.agentPerformanceLog.deleteMany();
  await prisma.governanceEvent.deleteMany();
  await prisma.artifact.deleteMany();
  await prisma.task.deleteMany();
  await prisma.module.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.project.deleteMany();

  // Create test project
  console.log('Creating test project...');
  const project = await prisma.project.create({
    data: {
      name: 'Test E-Commerce Platform',
      clientName: 'Test Client',
      description: 'A test e-commerce platform for testing all features',
      domain: 'E_COMMERCE',
      status: 'IN_PROGRESS',
      complexityScore: 65
    }
  });
  console.log(`  ✅ Project: ${project.id}`);

  // Create agents
  console.log('Creating agents...');
  const agents = await Promise.all([
    prisma.agent.create({
      data: {
        role: 'TeamLead',
        specialization: 'Full Stack',
        status: 'IDLE',
        score: 85,
        riskLevel: 'LOW',
        modelConfig: {
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          maxTokens: 4096,
          temperature: 0.7
        }
      }
    }),
    prisma.agent.create({
      data: {
        role: 'MidDev',
        specialization: 'Backend',
        status: 'IDLE',
        score: 72,
        riskLevel: 'LOW',
        modelConfig: {
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          maxTokens: 4096,
          temperature: 0.5
        }
      }
    }),
    prisma.agent.create({
      data: {
        role: 'MidDev',
        specialization: 'Frontend',
        status: 'IDLE',
        score: 68,
        riskLevel: 'LOW',
        modelConfig: {
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          maxTokens: 4096,
          temperature: 0.5
        }
      }
    }),
    prisma.agent.create({
      data: {
        role: 'QA',
        specialization: 'Testing',
        status: 'IDLE',
        score: 80,
        riskLevel: 'LOW',
        modelConfig: {
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          maxTokens: 2048,
          temperature: 0.3
        }
      }
    }),
    prisma.agent.create({
      data: {
        role: 'Architect',
        specialization: 'System Design',
        status: 'IDLE',
        score: 90,
        riskLevel: 'LOW',
        modelConfig: {
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          maxTokens: 8192,
          temperature: 0.7
        }
      }
    })
  ]);
  console.log(`  ✅ Created ${agents.length} agents`);

  // Create modules
  console.log('Creating modules...');
  const authModule = await prisma.module.create({
    data: {
      name: 'Authentication',
      projectId: project.id,
      ownerAgentId: agents[0].id,
      status: 'IN_PROGRESS'
    }
  });

  const productModule = await prisma.module.create({
    data: {
      name: 'Product Catalog',
      projectId: project.id,
      ownerAgentId: agents[0].id,
      status: 'PLANNED'
    }
  });

  const cartModule = await prisma.module.create({
    data: {
      name: 'Shopping Cart',
      projectId: project.id,
      ownerAgentId: agents[0].id,
      status: 'PLANNED'
    }
  });
  console.log(`  ✅ Created 3 modules`);

  // Create tasks
  console.log('Creating tasks...');
  const tasks = await Promise.all([
    // Auth tasks
    prisma.task.create({
      data: {
        moduleId: authModule.id,
        title: 'Implement JWT authentication',
        requiredRole: 'MidDev',
        status: 'QUEUED',
        contextPacket: {
          summary: 'Implement JWT-based authentication',
          details: 'Create login/register endpoints with JWT tokens',
          techStack: ['Node.js', 'Express', 'JWT']
        }
      }
    }),
    prisma.task.create({
      data: {
        moduleId: authModule.id,
        title: 'Add password hashing with bcrypt',
        requiredRole: 'MidDev',
        status: 'QUEUED',
        contextPacket: {
          summary: 'Secure password storage',
          details: 'Hash passwords using bcrypt before storing',
          techStack: ['bcrypt']
        }
      }
    }),
    prisma.task.create({
      data: {
        moduleId: authModule.id,
        title: 'Create login form UI',
        requiredRole: 'MidDev',
        status: 'IN_PROGRESS',
        assignedToAgentId: agents[2].id,
        contextPacket: {
          summary: 'Build login form component',
          details: 'React component with email/password fields',
          techStack: ['React', 'Tailwind']
        }
      }
    }),
    // Product tasks
    prisma.task.create({
      data: {
        moduleId: productModule.id,
        title: 'Design product database schema',
        requiredRole: 'Architect',
        status: 'COMPLETED',
        assignedToAgentId: agents[4].id,
        result: {
          output: 'Schema designed with products, categories, variants tables'
        },
        contextPacket: {
          summary: 'Database schema for products',
          details: 'Design PostgreSQL schema for product catalog'
        }
      }
    }),
    prisma.task.create({
      data: {
        moduleId: productModule.id,
        title: 'Implement product listing API',
        requiredRole: 'MidDev',
        status: 'IN_QA',
        assignedToAgentId: agents[1].id,
        contextPacket: {
          summary: 'GET /api/products endpoint',
          details: 'Paginated product listing with filters'
        }
      }
    }),
    // Cart tasks
    prisma.task.create({
      data: {
        moduleId: cartModule.id,
        title: 'Implement add to cart functionality',
        requiredRole: 'MidDev',
        status: 'QUEUED',
        contextPacket: {
          summary: 'Add to cart feature',
          details: 'Allow users to add products to shopping cart'
        }
      }
    }),
    // A failed task for testing
    prisma.task.create({
      data: {
        moduleId: authModule.id,
        title: 'Implement OAuth with Google',
        requiredRole: 'MidDev',
        status: 'FAILED',
        retryCount: 3,
        errorMessage: 'OAuth configuration missing',
        contextPacket: {
          summary: 'Google OAuth integration',
          details: 'Allow users to sign in with Google'
        }
      }
    })
  ]);
  console.log(`  ✅ Created ${tasks.length} tasks`);

  // Create some governance events
  console.log('Creating governance events...');
  await Promise.all([
    prisma.governanceEvent.create({
      data: {
        agentId: agents[1].id,
        action: 'PROMOTE',
        reason: 'Consistent high performance on backend tasks'
      }
    }),
    prisma.governanceEvent.create({
      data: {
        agentId: agents[2].id,
        action: 'WARNING',
        reason: 'Task completion time above average'
      }
    }),
    prisma.governanceEvent.create({
      data: {
        agentId: agents[3].id,
        action: 'FLAG',
        reason: 'QA coverage below threshold'
      }
    })
  ]);
  console.log(`  ✅ Created 3 governance events`);

  // Create task metrics
  console.log('Creating task metrics...');
  await Promise.all([
    prisma.taskMetrics.create({
      data: {
        taskId: tasks[3].id,
        agentId: agents[4].id,
        executionTimeMs: 45000,
        tokensIn: 1200,
        tokensOut: 800,
        costUsd: 0.0045,
        modelUsed: 'gemini-2.0-flash'
      }
    }),
    prisma.taskMetrics.create({
      data: {
        taskId: tasks[4].id,
        agentId: agents[1].id,
        executionTimeMs: 120000,
        tokensIn: 2500,
        tokensOut: 1800,
        costUsd: 0.0089,
        modelUsed: 'gemini-2.0-flash'
      }
    })
  ]);
  console.log(`  ✅ Created 2 task metrics`);

  // Create traces
  console.log('Creating traces...');
  await Promise.all([
    prisma.trace.create({
      data: {
        taskId: tasks[3].id,
        agentId: agents[4].id,
        event: 'TASK_COMPLETED',
        metadata: {
          duration: 45000,
          success: true
        }
      }
    }),
    prisma.trace.create({
      data: {
        taskId: tasks[4].id,
        agentId: agents[1].id,
        event: 'TASK_ASSIGNED',
        metadata: {
          role: 'MidDev'
        }
      }
    })
  ]);
  console.log(`  ✅ Created 2 traces`);

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ Seed completed successfully!');
  console.log('='.repeat(50));
  console.log(`
Summary:
  - 1 Project: ${project.name}
  - ${agents.length} Agents
  - 3 Modules
  - ${tasks.length} Tasks
  - 3 Governance Events
  - 2 Task Metrics
  - 2 Traces

Test Project ID: ${project.id}
  `);

  return project.id;
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
