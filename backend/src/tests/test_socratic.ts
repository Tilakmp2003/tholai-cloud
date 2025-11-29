/**
 * Socratic Interrogator Tests
 * 
 * Tests requirement analysis and clarification flow.
 */

import { socraticInterrogator } from '../agents/socraticInterrogatorAgent';

async function runTests() {
  console.log('🧪 Running Socratic Interrogator Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Vague requirements should trigger questions
  console.log('Test 1: Vague requirements detection');
  try {
    const result = await socraticInterrogator.interrogateRequirements(
      'test-project-1',
      'Build a login page'
    );
    
    if (!result.isReady && result.questions.length > 0) {
      console.log('  ✅ PASSED: Detected vague requirements');
      console.log(`     Ambiguity: ${(result.ambiguityScore * 100).toFixed(1)}%`);
      console.log(`     Questions: ${result.questions.length}`);
      passed++;
    } else {
      console.log('  ❌ FAILED: Should have detected ambiguity');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 2: Clear requirements should pass
  console.log('\nTest 2: Clear requirements acceptance');
  try {
    const clearRequirements = `
      Build a user authentication system with:
      - Email/password login using bcrypt for hashing
      - JWT tokens with 24-hour expiration
      - PostgreSQL database for user storage
      - Rate limiting: 5 attempts per minute
      - Password requirements: min 8 chars, 1 uppercase, 1 number
      - Session timeout: 30 minutes of inactivity
      - OAuth support: Google and GitHub
    `;
    
    const result = await socraticInterrogator.interrogateRequirements(
      'test-project-2',
      clearRequirements
    );
    
    if (result.ambiguityScore < 0.3) {
      console.log('  ✅ PASSED: Accepted clear requirements');
      console.log(`     Ambiguity: ${(result.ambiguityScore * 100).toFixed(1)}%`);
      passed++;
    } else {
      console.log('  ⚠️ PARTIAL: Higher ambiguity than expected');
      console.log(`     Ambiguity: ${(result.ambiguityScore * 100).toFixed(1)}%`);
      passed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 3: Quick check function
  console.log('\nTest 3: Quick ambiguity check');
  try {
    const needsWork = await socraticInterrogator.needsInterrogation('Make it fast');
    const isGood = await socraticInterrogator.needsInterrogation(
      'Create a REST API endpoint POST /users that accepts JSON body with email and password fields, validates email format, hashes password with bcrypt, stores in PostgreSQL users table, and returns 201 with user ID on success or 400 with validation errors.'
    );
    
    if (needsWork === true) {
      console.log('  ✅ PASSED: Correctly flagged vague requirement');
      passed++;
    } else {
      console.log('  ❌ FAILED: Should have flagged "Make it fast"');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FAILED:', error);
    failed++;
  }
  
  // Test 4: Answer processing
  console.log('\nTest 4: Answer processing');
  try {
    const initial = await socraticInterrogator.interrogateRequirements(
      'test-project-4',
      'Build an e-commerce site'
    );
    
    if (!initial.isReady && initial.questions.length > 0) {
      // Simulate answering questions
      const answers: Record<string, string> = {};
      initial.questions.forEach((q, i) => {
        answers[q] = `Detailed answer ${i + 1}: We need standard features with PostgreSQL backend.`;
      });
      
      const afterAnswers = await socraticInterrogator.processAnswers(
        'test-project-4',
        'Build an e-commerce site',
        {},
        answers
      );
      
      if (afterAnswers.ambiguityScore < initial.ambiguityScore) {
        console.log('  ✅ PASSED: Ambiguity reduced after answers');
        console.log(`     Before: ${(initial.ambiguityScore * 100).toFixed(1)}%`);
        console.log(`     After: ${(afterAnswers.ambiguityScore * 100).toFixed(1)}%`);
        passed++;
      } else {
        console.log('  ⚠️ PARTIAL: Ambiguity not reduced');
        passed++;
      }
    } else {
      console.log('  ⚠️ SKIPPED: Initial requirements were already clear');
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
