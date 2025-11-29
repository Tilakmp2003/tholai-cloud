import { patchEngine } from '../src/services/patchEngine';
import * as fs from 'fs';
import * as path from 'path';

console.log('🧪 Testing Multi-Language Patch Engine\\n');

// ============================================
// Test 1: JavaScript (existing functionality)
// ============================================
console.log('--- Test 1: JavaScript ---');

const jsSource = `
function calculateTotal(a, b) {
  return a + b;
}

function processData(data) {
  return data.map(x => x * 2);
}
`;

const jsPatches = [
  {
    type: 'replace_function' as const,
    name: 'calculateTotal',
    newCode: `function calculateTotal(a, b, c) {
  return a + b + c;
}`
  }
];

try {
  const jsResult = patchEngine.applyPatchesToFile('test.js', jsSource, jsPatches);
  if (jsResult.includes('function calculateTotal(a, b, c)')) {
    console.log('✅ JavaScript function replacement successful');
  } else {
    console.log('❌ JavaScript function replacement failed');
  }
} catch (err) {
  console.error('❌ JavaScript test failed:', err);
}

// ============================================
// Test 2: Python function replacement
// ============================================
console.log('\\n--- Test 2: Python ---');

const pythonSource = `
import os
import sys

def calculate_total(a, b):
    """Calculate the sum of two numbers"""
    return a + b

def process_data(data):
    """Process data by doubling each element"""
    return [x * 2 for x in data]

if __name__ == '__main__':
    print(calculate_total(10, 20))
`;

const pythonPatches = [
  {
    type: 'replace_function' as const,
    name: 'calculate_total',
    newCode: `def calculate_total(a, b, c):
    """Calculate the sum of three numbers"""
    return a + b + c`
  }
];

try {
  const pythonResult = patchEngine.applyPatchesToFile('test.py', pythonSource, pythonPatches);
  if (pythonResult.includes('def calculate_total(a, b, c):')) {
    console.log('✅ Python function replacement successful');
    console.log('   Function now takes 3 parameters');
  } else {
    console.log('❌ Python function replacement failed');
    console.log('   Result:', pythonResult);
  }
} catch (err) {
  console.error('❌ Python test failed:', err);
}

// ============================================
// Test 3: Python import addition
// ============================================
console.log('\\n--- Test 3: Python Import ---');

const pythonPatches2 = [
  {
    type: 'add_import' as const,
    code: 'import numpy as np'
  }
];

try {
  const pythonImportResult = patchEngine.applyPatchesToFile('test.py', pythonSource, pythonPatches2);
  if (pythonImportResult.includes('import numpy as np')) {
    console.log('✅ Python import addition successful');
  } else {
    console.log('❌ Python import addition failed');
  }
} catch (err) {
  console.error('❌ Python import test failed:', err);
}

// ============================================
// Test 4: Bash function replacement
// ============================================
console.log('\\n--- Test 4: Bash ---');

const bashSource = `#!/bin/bash

greet() {
  echo "Hello, $1"
}

function process_file() {
  cat "$1" | grep -v "^#"
}

greet "World"
`;

const bashPatches = [
  {
    type: 'replace_function' as const,
    name: 'greet',
    newCode: `greet() {
  echo "Hello, $1! Welcome to our system."
}`
  }
];

try {
  const bashResult = patchEngine.applyPatchesToFile('test.sh', bashSource, bashPatches);
  if (bashResult.includes('Welcome to our system')) {
    console.log('✅ Bash function replacement successful');
  } else {
    console.log('❌ Bash function replacement failed');
    console.log('   Result:', bashResult);
  }
} catch (err) {
  console.error('❌ Bash test failed:', err);
}

// ============================================
// Test 5: TypeScript (ensure backward compat)
// ============================================
console.log('\\n--- Test 5: TypeScript ---');

const tsSource = `
interface User {
  name: string;
  age: number;
}

function formatUser(user: User): string {
  return \`\${user.name} (\${user.age})\`;
}
`;

const tsPatches = [
  {
    type: 'add_import' as const,
    code: "import { Logger } from './logger';"
  }
];

try {
  const tsResult = patchEngine.applyPatchesToFile('test.ts', tsSource, tsPatches);
  if (tsResult.includes("import { Logger } from './logger';")) {
    console.log('✅ TypeScript import addition successful');
  } else {
    console.log('❌ TypeScript import addition failed');
  }
} catch (err) {
  console.error('❌ TypeScript test failed:', err);
}

console.log('\\n🎉 Multi-Language Patch Engine Tests Complete!');
