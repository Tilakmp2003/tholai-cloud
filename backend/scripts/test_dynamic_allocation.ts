/**
 * Test Dynamic Agent Allocation
 * Tests small, medium, and large project allocations
 */

import { PrismaClient } from '@prisma/client';
import { analyzeProject, allocateAgents, getTotalAgentCount } from '../src/services/agentAllocator';
import { spawnAgents, countProjectAgents } from '../src/services/agentSpawner';
import { cleanupProjectAgents } from '../src/services/agentCleanup';

const prisma = new PrismaClient();

// Test PRDs
const SMALL_PRD = `
Build a simple landing page with:
- Hero section with CTA
- Features section (3 features)
- Contact form
- Footer
`;

const MEDIUM_PRD = `
Create a task management dashboard with:
- User authentication (login/signup)
- Task CRUD operations
- Project grouping
- Priority levels
- Due dates and reminders
- Search and filtering
- User profile settings
- Dashboard analytics
- Team collaboration features
- REST API backend
- PostgreSQL database
`;

const LARGE_PRD = `
Build a full e-commerce platform with:
- User authentication and profiles
- Product catalog with categories
- Advanced search and filtering
- Shopping cart functionality
- Checkout process
- Payment integration (Stripe)
- Order management system
- Inventory tracking
- Admin dashboard
- Product reviews and ratings
- Wishlist functionality
- Email notifications
- Analytics and reporting
- Multi-currency support
- Shipping calculator
- Discount codes and promotions
- Customer support chat
- Mobile responsive design
- SEO optimization
- Performance monitoring
`;

async function testAllocation() {
  console.log('\n🧪 === TESTING DYNAMIC AGENT ALLOCATION ===\n');

 // Test 1: Small Project
  console.log('📋 Test 1: Small Project (Landing Page)');
  console.log('PRD:', SMALL_PRD.substring(0, 50) + '...');
  
  const smallAnalysis = await analyzeProject(SMALL_PRD);
  const smallAllocation = allocateAgents(smallAnalysis);
  const smallCount = getTotalAgentCount(smallAllocation);
  
  console.log('Analysis:', smallAnalysis);
  console.log('Allocation:', smallAllocation);
  console.log(`✅ Expected: ~7 agents, Got: ${smallCount} agents\n`);

  // Test 2: Medium Project
  console.log('📋 Test 2: Medium Project (Task Dashboard)');
  console.log('PRD:', MEDIUM_PRD.substring(0, 50) + '...');
  
  const mediumAnalysis = await analyzeProject(MEDIUM_PRD);
  const mediumAllocation = allocateAgents(mediumAnalysis);
  const mediumCount = getTotalAgentCount(mediumAllocation);
  
  console.log('Analysis:', mediumAnalysis);
  console.log('Allocation:', mediumAllocation);
  console.log(`✅ Expected: ~13 agents, Got: ${mediumCount} agents\n`);

  // Test 3: Large Project
  console.log('📋 Test 3: Large Project (E-commerce)');
  console.log('PRD:', LARGE_PRD.substring(0, 50) + '...');
  
  const largeAnalysis = await analyzeProject(LARGE_PRD);
  const largeAllocation = allocateAgents(largeAnalysis);
  const largeCount = getTotalAgentCount(largeAllocation);
  
  console.log('Analysis:', largeAnalysis);
  console.log('Allocation:', largeAllocation);
  console.log(`✅ Expected: ~20 agents, Got: ${largeCount} agents\n`);

  // Test 4: Agent Spawning
  console.log('🚀 Test 4: Spawning Agents for Medium Project');
  const testProjectId = 'test_' + Date.now();
  
  await spawnAgents(testProjectId, mediumAllocation);
  const spawnedCount = await countProjectAgents(testProjectId);
  
  console.log(`✅ Spawned ${spawnedCount} agents for project ${testProjectId}\n`);

  // Test 5: Cleanup
  console.log('🧹 Test 5: Cleanup');
  const cleanedCount = await cleanupProjectAgents(testProjectId);
  const remainingCount = await countProjectAgents(testProjectId);
  
  console.log(`✅ Cleaned up ${cleanedCount} agents`);
  console.log(`✅ Remaining agents: ${remainingCount} (should be 0)\n`);

  console.log('=== ALL TESTS COMPLETE ===\n');
  
  await prisma.$disconnect();
}

testAllocation().catch(console.error);
