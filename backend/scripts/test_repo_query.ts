import { repoIndexer } from '../src/services/repoIndexer';
import { repoQuery } from '../src/services/repoQuery';
import { stackTraceMapper } from '../src/services/stackTraceMapper';
import { workspaceManager } from '../src/services/workspaceManager';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const prisma = new PrismaClient();

async function runTest() {
  const projectId = `test-query-${uuidv4().substring(0, 8)}`;
  console.log(`🧪 Testing Repo Query & Stack Mapper for Project: ${projectId}`);

  try {
    // 1. Setup Project & Index
    await prisma.project.create({
      data: {
        id: projectId,
        name: projectId,
        description: 'Query Test',
        status: 'IN_PROGRESS',
        clientName: 'Test Client'
      }
    });

    const workspacePath = await workspaceManager.initializeWorkspace(projectId, projectId);
    
    // Write a file
    await workspaceManager.writeFile(projectId, 'utils.ts', `
      export function calculateTotal(a: number, b: number) {
        return a + b;
      }
      
      export class Calculator {
        add(a: number, b: number) {
          return a + b;
        }
      }
    `);

    await repoIndexer.indexRepo(projectId);

    // 2. Test fetchBySymbol
    console.log('\n--- Testing fetchBySymbol ---');
    const funcSym = await repoQuery.fetchBySymbol(projectId, 'calculateTotal');
    if (funcSym) {
      console.log(`✅ Found symbol 'calculateTotal' in ${funcSym.location}`);
      console.log(`   Code: ${funcSym.code?.trim()}`);
    } else {
      console.error('❌ Symbol calculateTotal not found');
    }

    // 3. Test ragRetrieve
    console.log('\n--- Testing ragRetrieve ---');
    const chunks = await repoQuery.ragRetrieve(projectId, 'Calculator');
    if (chunks.length > 0) {
      console.log(`✅ Retrieved ${chunks.length} chunks for 'Calculator'`);
      chunks.forEach(c => console.log(`   - ${c.filePath}:${c.startLine}`));
    } else {
      console.error('❌ No chunks found for Calculator');
    }

    // 4. Test StackTraceMapper
    console.log('\n--- Testing StackTraceMapper ---');
    // Simulate a stack trace
    // Note: The path in stack trace will be absolute in real life, but we simulate it.
    // We need to make sure the filename matches 'utils.ts'.
    const fakeTrace = `
      Error: Something went wrong
          at calculateTotal (${path.join(workspacePath, 'utils.ts')}:3:15)
          at Object.<anonymous> (index.ts:10:1)
    `;
    
    const mapped = await stackTraceMapper.mapToSymbol(projectId, fakeTrace);
    if (mapped) {
      console.log(`✅ Mapped trace to file: ${mapped.file}`);
      if (mapped.symbol) {
        console.log(`✅ Mapped to symbol: ${mapped.symbol.name} (${mapped.symbol.kind})`);
      } else {
        console.error('❌ Failed to map to symbol (line number mismatch?)');
      }
    } else {
      console.error('❌ Failed to map trace');
    }

    // Cleanup
    await prisma.project.delete({ where: { id: projectId } });

  } catch (error) {
    console.error('❌ Test Failed:', error);
  }
}

runTest();
