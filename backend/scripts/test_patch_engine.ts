import { patchEngine, PatchOperation } from '../src/services/patchEngine';

const sampleCode = `
import React from 'react';

function hello(name: string) {
  console.log("Hello " + name);
  return true;
}

export const App = () => {
  hello("World");
  return <div>App</div>;
}
`;

async function runTest() {
  console.log('🧪 Testing AST Patch Engine...');

  try {
    // 1. Replace Function
    console.log('1. Testing replace_function...');
    const ops1: PatchOperation[] = [{
      type: 'replace_function',
      name: 'hello',
      newCode: `function hello(name: string) {
  console.log("Greetings " + name);
  return false;
}`
    }];
    
    const res1 = patchEngine.applyPatches(sampleCode, ops1);
    if (res1.includes('"Greetings "') && res1.includes('return false;')) {
      console.log('✅ Function replaced successfully');
    } else {
      console.error('❌ Function replacement failed:\n', res1);
    }

    // 2. Add Import
    console.log('2. Testing add_import...');
    const ops2: PatchOperation[] = [{
      type: 'add_import',
      code: `import { useState } from 'react';`
    }];
    
    const res2 = patchEngine.applyPatches(sampleCode, ops2);
    if (res2.includes("import { useState } from 'react';")) {
      console.log('✅ Import added successfully');
    } else {
      console.error('❌ Import addition failed:\n', res2);
    }

  } catch (error) {
    console.error('❌ Test Failed:', error);
  }
}

runTest();
