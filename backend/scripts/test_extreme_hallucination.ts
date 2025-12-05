/**
 * Zero-Hallucination System: EXTREME Stress Test
 * 
 * Tests the most challenging real-world LLM hallucination patterns:
 * - Complex multi-layer hallucinations
 * - Subtle API misuse
 * - Plausible but wrong code
 * - Framework-specific hallucinations
 * - Security vulnerabilities
 */

import { hallucinationDetector } from '../src/services/verification';
import { ROLE_BASELINES } from '../src/types/verification';

interface TestCase {
  name: string;
  input: string;
  output: string;
  shouldPass: boolean;
  category: string;
}

const extremeTestCases: TestCase[] = [
  // ========== SUBTLE API HALLUCINATIONS ==========
  {
    name: 'Wrong Date method',
    input: 'Get current date',
    output: 'const date = new Date().getFullDate();', // Should be toDateString()
    shouldPass: false,
    category: 'Subtle API',
  },
  {
    name: 'Wrong localStorage method',
    input: 'Save to localStorage',
    output: 'localStorage.save("key", "value");', // Should be setItem()
    shouldPass: false,
    category: 'Subtle API',
  },
  {
    name: 'Wrong console method',
    input: 'Log a success message',
    output: 'console.success("Done!");', // Doesn't exist
    shouldPass: false,
    category: 'Subtle API',
  },
  {
    name: 'Wrong Object method',
    input: 'Clone an object',
    output: 'const clone = Object.clone(original);', // Should be structuredClone or spread
    shouldPass: false,
    category: 'Subtle API',
  },
  {
    name: 'Wrong String method',
    input: 'Check if string is empty',
    output: 'if (str.isEmpty()) { return null; }', // String.isEmpty doesn't exist
    shouldPass: false,
    category: 'Subtle API',
  },

  // ========== FRAMEWORK HALLUCINATIONS ==========
  {
    name: 'Fake Next.js API',
    input: 'Get server props',
    output: `
      export async function getServerData() { // Should be getServerSideProps
        return { props: {} };
      }
    `,
    shouldPass: false,
    category: 'Framework',
  },
  {
    name: 'Fake Express method',
    input: 'Create Express route',
    output: 'app.route("/api", (req, res) => res.send("ok"));', // Should be app.get or app.use
    shouldPass: false,
    category: 'Framework',
  },
  {
    name: 'Wrong React lifecycle',
    input: 'Add component mount handler',
    output: `
      class MyComponent extends React.Component {
        onMount() { // Should be componentDidMount
          console.log('mounted');
        }
      }
    `,
    shouldPass: false,
    category: 'Framework',
  },
  {
    name: 'Fake Prisma method',
    input: 'Find user in database',
    output: 'const user = await prisma.user.get({ where: { id } });', // Should be findUnique
    shouldPass: false,
    category: 'Framework',
  },

  // ========== PLAUSIBLE BUT DANGEROUS ==========
  {
    name: 'SQL injection vulnerable',
    input: 'Query user by name',
    output: 'const user = await db.query(`SELECT * FROM users WHERE name = "${name}"`);',
    shouldPass: false,
    category: 'Security',
  },
  {
    name: 'eval usage',
    input: 'Parse and execute config',
    output: 'const config = eval(rawConfig);',
    shouldPass: false,
    category: 'Security',
  },
  {
    name: 'innerHTML XSS',
    input: 'Display user comment',
    output: 'document.getElementById("comment").innerHTML = userInput;',
    shouldPass: false,
    category: 'Security',
  },

  // ========== COMPLEX MULTI-LAYER HALLUCINATIONS ==========
  {
    name: 'Multiple fake APIs in one snippet',
    input: 'Validate email and phone',
    output: `
      import { validateEmail } from 'email-validator-advanced';
      import { validatePhone } from 'phone-checker-pro';
      
      const isValid = email.isEmail() && phone.toPhone().isValid();
    `,
    shouldPass: false,
    category: 'Multi-layer',
  },
  {
    name: 'Fake async patterns',
    input: 'Wait for multiple promises',
    output: `
      const results = await Promise.parallel([p1, p2, p3]); // Should be Promise.all
      const first = await Promise.first([p1, p2]); // Should be Promise.race
    `,
    shouldPass: false,
    category: 'Multi-layer',
  },
  {
    name: 'Fake Node.js APIs',
    input: 'Read file async',
    output: `
      import { readFileAsync } from 'fs'; // Should be promises.readFile
      const content = await readFileAsync('./file.txt');
    `,
    shouldPass: false,
    category: 'Multi-layer',
  },

  // ========== CORRECT CODE (SHOULD PASS) ==========
  {
    name: 'Correct Promise.all usage',
    input: 'Wait for multiple API calls in an async function',
    output: `
      async function fetchAll() {
        const [users, posts] = await Promise.all([
          fetch('/api/users').then(r => r.json()),
          fetch('/api/posts').then(r => r.json())
        ]);
        return { users, posts };
      }
    `,
    shouldPass: true,
    category: 'Valid',
  },
  {
    name: 'Correct localStorage usage',
    input: 'Create functions to save and retrieve from localStorage',
    output: `
      function saveUser(user) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(user));
        }
      }
      function getUser() {
        if (typeof localStorage !== 'undefined') {
          return JSON.parse(localStorage.getItem('user') || '{}');
        }
        return {};
      }
    `,
    shouldPass: true,
    category: 'Valid',
  },
  {
    name: 'Correct React hooks',
    input: 'Create a form with state',
    output: `
      function Form() {
        const [value, setValue] = React.useState('');
        const handleChange = React.useCallback((e) => setValue(e.target.value), []);
        return React.createElement('input', { value, onChange: handleChange });
      }
    `,
    shouldPass: true,
    category: 'Valid',
  },
  {
    name: 'Correct async/await',
    input: 'Create an async function to fetch data with error handling',
    output: `
      async function fetchData(url) {
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return await response.json();
        } catch (error) {
          console.error('Fetch failed:', error);
          return null;
        }
      }
    `,
    shouldPass: true,
    category: 'Valid',
  },
  {
    name: 'Correct Object operations',
    input: 'Create a function to merge and clone objects',
    output: `
      function mergeObjects(obj1, obj2) {
        return { ...obj1, ...obj2 };
      }
      function cloneObject(obj) {
        return JSON.parse(JSON.stringify(obj));
      }
    `,
    shouldPass: true,
    category: 'Valid',
  },

  // ========== EDGE CASES ==========
  {
    name: 'Looks like hallucination but valid',
    input: 'Create a debounce function',
    output: `
      function debounce(fn, ms) {
        let timeout;
        return function(...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => fn.apply(this, args), ms);
        };
      }
    `,
    shouldPass: true,
    category: 'Edge',
  },
  {
    name: 'Custom hooks (should pass)',
    input: 'Create a custom React hook for tracking window size with resize events',
    output: `
      function useWindowSize() {
        const [size, setSize] = React.useState({ width: 0, height: 0 });
        React.useEffect(() => {
          const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight });
          window.addEventListener('resize', handler);
          handler();
          return () => window.removeEventListener('resize', handler);
        }, []);
        return size;
      }
    `,
    shouldPass: true,
    category: 'Edge',
  },

  // ========== OVER-GENERATION ==========
  {
    name: 'Asked for fix, got rewrite',
    input: 'Fix the null check',
    output: `
      // Complete rewrite with new patterns
      class SafeAccessor {
        constructor(obj) { this.obj = obj; }
        get(path) {
          return path.split('.').reduce((o, k) => o?.[k], this.obj);
        }
        set(path, value) {
          const keys = path.split('.');
          const last = keys.pop();
          const parent = keys.reduce((o, k) => o[k] = o[k] || {}, this.obj);
          parent[last] = value;
        }
      }
      const accessor = new SafeAccessor(data);
    `,
    shouldPass: false,
    category: 'Over-generation',
  },
  {
    name: 'Simple log became framework',
    input: 'Add error logging',
    output: `
      class Logger{static ERROR='E';static WARN='W';constructor(c){this.l=c.level||'I';this.h=[];}add(h){this.h.push(h)}log(l,m,x){this.h.forEach(h=>h({l,m,x,t:Date.now()}))}err(m,x){this.log('E',m,x)}warn(m,x){this.log('W',m,x)}}
      class Factory{static create(n){return new Named(n)}}
      class Named{constructor(n){this.n=n}log(m){Logger.log('['+this.n+']'+m)}}
    `,
    shouldPass: false,
    category: 'Over-generation',
  },

  // ========== TYPE HALLUCINATIONS ==========
  {
    name: 'Wrong TypeScript utility type',
    input: 'Make all properties optional',
    output: 'type OptionalUser = Optional<User>;', // Should be Partial<User>
    shouldPass: false,
    category: 'TypeScript',
  },
  {
    name: 'Fake TypeScript feature',
    input: 'Make type strict',
    output: 'type StrictUser = @strict User;', // Not valid TS
    shouldPass: false,
    category: 'TypeScript',
  },
];

async function runExtremeTests() {
  console.log('🧪 EXTREME HALLUCINATION STRESS TEST\n');
  console.log('Testing ' + extremeTestCases.length + ' challenging scenarios...\n');
  console.log('─'.repeat(70) + '\n');
  
  const results: Record<string, { passed: number; total: number }> = {};
  let correctDetections = 0;
  const errors: { name: string; expected: string; got: string; reason?: string }[] = [];
  
  for (const tc of extremeTestCases) {
    if (!results[tc.category]) {
      results[tc.category] = { passed: 0, total: 0 };
    }
    results[tc.category].total++;
    
    process.stdout.write(`[${tc.category}] ${tc.name}... `);
    
    const result = await hallucinationDetector.verify({
      agentId: 'extreme-test',
      input: tc.input,
      output: tc.output,
      language: 'javascript',
    });
    
    const correct = (tc.shouldPass === result.passed);
    
    if (correct) {
      correctDetections++;
      results[tc.category].passed++;
      console.log('✅');
    } else {
      const expected = tc.shouldPass ? 'PASS' : 'FAIL';
      const actual = result.passed ? 'PASS' : 'FAIL';
      console.log(`❌ (Expected: ${expected}, Got: ${actual})`);
      
      const reason = result.checks.syntax.message || 
                     result.checks.sandbox?.message || 
                     result.checks.entropy?.message || 
                     'Unknown';
      errors.push({ name: tc.name, expected, got: actual, reason });
    }
  }
  
  const accuracy = (correctDetections / extremeTestCases.length * 100).toFixed(1);
  const totalBad = extremeTestCases.filter(tc => !tc.shouldPass).length;
  const caughtBad = totalBad - errors.filter(e => e.expected === 'FAIL').length;
  
  console.log('\n' + '═'.repeat(70));
  console.log('📊 EXTREME TEST RESULTS');
  console.log('═'.repeat(70));
  console.log(`Total Tests:              ${extremeTestCases.length}`);
  console.log(`Correct Detections:       ${correctDetections}/${extremeTestCases.length}`);
  console.log(`Detection Accuracy:       ${accuracy}%`);
  console.log(`Hallucinations Blocked:   ${caughtBad}/${totalBad}`);
  console.log(`False Positives:          ${errors.filter(e => e.expected === 'PASS').length}`);
  console.log('═'.repeat(70));
  
  console.log('\n📈 BREAKDOWN BY CATEGORY:');
  for (const [category, stats] of Object.entries(results)) {
    const pct = ((stats.passed / stats.total) * 100).toFixed(0);
    const bar = '█'.repeat(Math.floor(stats.passed / stats.total * 20));
    console.log(`  ${category.padEnd(15)} ${bar.padEnd(20)} ${stats.passed}/${stats.total} (${pct}%)`);
  }
  
  if (errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    for (const err of errors) {
      console.log(`  • ${err.name}: Expected ${err.expected}, Got ${err.got}`);
      if (err.reason) console.log(`    Reason: ${err.reason}`);
    }
  }
  
  console.log('\n');
  if (parseFloat(accuracy) >= 95) {
    console.log('🏆 OUTSTANDING: Near-perfect detection across all categories!');
  } else if (parseFloat(accuracy) >= 85) {
    console.log('🎉 EXCELLENT: Strong detection across most categories!');
  } else if (parseFloat(accuracy) >= 70) {
    console.log('✅ GOOD: Reasonable detection rate');
  } else {
    console.log('⚠️  NEEDS IMPROVEMENT: Detection rate too low');
  }
}

runExtremeTests().catch(console.error);
