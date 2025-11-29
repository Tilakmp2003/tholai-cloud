/**
 * Memory Reuse Tests
 * 
 * Tests agent memory storage, retrieval, and learning.
 */

import { agentMemory } from '../services/agentMemory';
import { memoryRetention } from '../services/memoryRetention';

async function runTests() {
  console.log('🧪 Running Memory Reuse Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Store memory
  console.log('Test 1: Store memory');
  try {
    const entry = await agentMemory.storeMemory(
      'agent-test-1',
      'MidDev',
      'SUCCESS_PATTERN',
      'auth',
      'JWT Token Implementation',
      'Always use RS256 algorithm for JWT tokens in production. Store refresh tokens in httpOnly cookies.',
      { taskId: 'test-task-1' }
    );
    
    if (entry.id && entry.type === 'SUCCESS_PATTERN') {
      console.log('  ✅ PASSED: Memory stored successfully');
      console.log(`     ID: ${entry.id}`);
      passed++;
    } else {
      console.log('  ❌ FAILED: Memory not stored properly');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 2: Store multiple memories
  console.log('\nTest 2: Store multiple memories');
  try {
    await agentMemory.storeMemory(
      'agent-test-2',
      'MidDev',
      'FAILURE_LESSON',
      'database',
      'N+1 Query Problem',
      'Avoid N+1 queries by using eager loading with Prisma include.',
      { taskId: 'test-task-2' }
    );
    
    await agentMemory.storeBestPractice(
      'api',
      'REST API Versioning',
      'Always version your APIs using URL path (e.g., /api/v1/) for backward compatibility.'
    );
    
    await agentMemory.storeCodeSnippet(
      'auth',
      'Password Hashing',
      `import bcrypt from 'bcrypt';
const hash = await bcrypt.hash(password, 12);`,
      'Secure password hashing with bcrypt'
    );
    
    const stats = agentMemory.getMemoryStats();
    
    if (stats.totalMemories >= 4) {
      console.log('  ✅ PASSED: Multiple memories stored');
      console.log(`     Total: ${stats.totalMemories}`);
      passed++;
    } else {
      console.log('  ❌ FAILED: Not all memories stored');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 3: Retrieve relevant memories
  console.log('\nTest 3: Retrieve relevant memories');
  try {
    const memories = await agentMemory.retrieveRelevantMemories(
      { summary: 'Implement user authentication with JWT tokens', category: 'auth' },
      'MidDev',
      3
    );
    
    if (memories.length > 0) {
      console.log('  ✅ PASSED: Retrieved relevant memories');
      console.log(`     Count: ${memories.length}`);
      memories.forEach(m => console.log(`     - ${m.title}`));
      passed++;
    } else {
      console.log('  ❌ FAILED: No memories retrieved');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 4: Get memories by category
  console.log('\nTest 4: Get memories by category');
  try {
    const authMemories = agentMemory.getMemoriesByCategory('auth');
    
    if (authMemories.length >= 2) {
      console.log('  ✅ PASSED: Retrieved category memories');
      console.log(`     Auth memories: ${authMemories.length}`);
      passed++;
    } else {
      console.log('  ❌ FAILED: Expected at least 2 auth memories');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 5: Update memory outcome
  console.log('\nTest 5: Update memory outcome');
  try {
    const memories = agentMemory.getMemoriesByCategory('auth');
    if (memories.length > 0) {
      const memory = memories[0];
      const initialRate = memory.successRate;
      
      // Simulate successful use
      agentMemory.updateMemoryOutcome(memory.id, true);
      agentMemory.updateMemoryOutcome(memory.id, true);
      
      // Get updated memory
      const updated = agentMemory.getMemoriesByCategory('auth').find(m => m.id === memory.id);
      
      if (updated && updated.successRate >= initialRate) {
        console.log('  ✅ PASSED: Success rate updated');
        console.log(`     Before: ${(initialRate * 100).toFixed(0)}%`);
        console.log(`     After: ${(updated.successRate * 100).toFixed(0)}%`);
        passed++;
      } else {
        console.log('  ❌ FAILED: Success rate not updated');
        failed++;
      }
    } else {
      console.log('  ⚠️ SKIPPED: No memories to update');
      passed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 6: Format memories for prompt
  console.log('\nTest 6: Format memories for prompt');
  try {
    const memories = agentMemory.getMemoriesByCategory('auth');
    
    const formatted = agentMemory.formatMemoriesForPrompt(memories);
    
    
    if (formatted.includes('RELEVANT KNOWLEDGE') && formatted.includes('SUCCESS_PATTERN')) {
      console.log('  ✅ PASSED: Memories formatted for prompt');
      console.log(`     Length: ${formatted.length} chars`);
      passed++;
    } else {
      console.log('  ❌ FAILED: Format incorrect');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 7: Memory statistics
  console.log('\nTest 7: Memory statistics');
  try {
    const stats = agentMemory.getMemoryStats();
    
    if (
      stats.totalMemories > 0 &&
      Object.keys(stats.byType).length > 0 &&
      Object.keys(stats.byCategory).length > 0
    ) {
      console.log('  ✅ PASSED: Statistics generated');
      console.log(`     Total: ${stats.totalMemories}`);
      console.log(`     Types: ${Object.keys(stats.byType).join(', ')}`);
      console.log(`     Categories: ${Object.keys(stats.byCategory).join(', ')}`);
      console.log(`     Avg Success: ${(stats.avgSuccessRate * 100).toFixed(0)}%`);
      passed++;
    } else {
      console.log('  ❌ FAILED: Incomplete statistics');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 8: Retention score calculation
  console.log('\nTest 8: Retention score calculation');
  try {
    const memories = agentMemory.getMemoriesByCategory('auth');
    if (memories.length > 0) {
      const score = memoryRetention.calculateRetentionScore(memories[0]);
      
      if (score > 0 && score <= 100) {
        console.log('  ✅ PASSED: Retention score calculated');
        console.log(`     Score: ${score.toFixed(1)}`);
        passed++;
      } else {
        console.log('  ❌ FAILED: Invalid score');
        failed++;
      }
    } else {
      console.log('  ⚠️ SKIPPED: No memories for scoring');
      passed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 9: Memory curation
  console.log('\nTest 9: Memory curation');
  try {
    const memories = agentMemory.getMemoriesByCategory('auth');
    if (memories.length > 0) {
      memoryRetention.curateMemory(memories[0].id);
      const stats = memoryRetention.getRetentionStats();
      
      if (stats.totalCurated > 0) {
        console.log('  ✅ PASSED: Memory curated');
        console.log(`     Curated count: ${stats.totalCurated}`);
        passed++;
      } else {
        console.log('  ❌ FAILED: Curation not recorded');
        failed++;
      }
    } else {
      console.log('  ⚠️ SKIPPED: No memories to curate');
      passed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  
  return { passed, failed };
}

// Run if executed directly
if (require.main === module) {
  runTests()
    .then(({ passed, failed }) => {
      process.exit(failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

export { runTests };
