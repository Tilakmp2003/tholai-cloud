/**
 * API Endpoint Tests
 * 
 * Tests all API endpoints without requiring the server to be running.
 * Run with: npx tsx src/tests/test_api_endpoints.ts
 * 
 * For live testing, start the server first then run:
 * npx tsx src/tests/test_api_endpoints.ts --live
 */

const API_URL = process.env.API_URL || 'http://localhost:4000';
const isLive = process.argv.includes('--live');

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

async function testEndpoint(
  method: string,
  path: string,
  body?: any,
  expectedStatus: number = 200
): Promise<TestResult> {
  const endpoint = `${method} ${path}`;
  const start = Date.now();
  
  if (!isLive) {
    return {
      endpoint,
      method,
      status: 'SKIP',
      message: 'Run with --live flag to test against running server'
    };
  }
  
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_URL}${path}`, options);
    
    const duration = Date.now() - start;
    
    if (response.status === expectedStatus) {
      return {
        endpoint,
        method,
        status: 'PASS',
        message: `Status ${response.status} (${duration}ms)`,
        duration
      };
    } else {
      const text = await response.text();
      return {
        endpoint,
        method,
        status: 'FAIL',
        message: `Expected ${expectedStatus}, got ${response.status}: ${text.substring(0, 100)}`,
        duration
      };
    }
  } catch (error: any) {
    return {
      endpoint,
      method,
      status: 'FAIL',
      message: `Error: ${error.message}`
    };
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║              API ENDPOINT TEST SUITE                   ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  if (!isLive) {
    console.log('⚠️  Running in DRY RUN mode. Use --live flag to test against server.\n');
  } else {
    console.log(`🌐 Testing against: ${API_URL}\n`);
  }

  // Health Check
  console.log('─── Health ───');
  results.push(await testEndpoint('GET', '/health'));

  // Dashboard
  console.log('\n─── Dashboard ───');
  results.push(await testEndpoint('GET', '/api/dashboard/metrics'));

  // Approvals
  console.log('\n─── Approvals ───');
  results.push(await testEndpoint('GET', '/api/approvals'));
  results.push(await testEndpoint('POST', '/api/approvals/configure', {
    projectId: 'test-project',
    enabledGates: ['PRE_COMMIT', 'SECURITY']
  }));

  // Memory
  console.log('\n─── Memory ───');
  results.push(await testEndpoint('GET', '/api/memory/stats'));
  results.push(await testEndpoint('POST', '/api/memory/best-practice', {
    category: 'test',
    title: 'Test Practice',
    content: 'This is a test best practice'
  }));
  results.push(await testEndpoint('POST', '/api/memory/search', {
    context: { summary: 'test search' },
    agentRole: 'MidDev',
    limit: 5
  }));

  // Socratic
  console.log('\n─── Socratic ───');
  results.push(await testEndpoint('POST', '/api/socratic/check', {
    requirements: 'Build a login page'
  }));

  // Admin
  console.log('\n─── Admin ───');
  results.push(await testEndpoint('GET', '/api/admin/kpis'));
  results.push(await testEndpoint('GET', '/api/admin/safety/allowlist'));
  results.push(await testEndpoint('GET', '/api/admin/budget/stats'));
  results.push(await testEndpoint('GET', '/api/admin/trace/stats'));
  results.push(await testEndpoint('GET', '/api/admin/memory/retention'));

  // Print Results
  console.log('\n' + '═'.repeat(60));
  console.log('                      RESULTS');
  console.log('═'.repeat(60) + '\n');

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const result of results) {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${icon} ${result.endpoint.padEnd(40)} ${result.message}`);
    
    if (result.status === 'PASS') passed++;
    else if (result.status === 'FAIL') failed++;
    else skipped++;
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Total: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('═'.repeat(60));

  return { passed, failed, skipped };
}

// Run
runTests()
  .then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Test runner crashed:', error);
    process.exit(1);
  });
