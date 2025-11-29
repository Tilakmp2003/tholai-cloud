import { repoIndexer } from '../src/services/repoIndexer';
import { workspaceManager } from '../src/services/workspaceManager';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function runTest() {
  const projectId = `test-repo-${uuidv4().substring(0, 8)}`;
  console.log(`🧪 Testing Repo Indexer for Project: ${projectId}`);

  try {
    // 1. Create Project
    await prisma.project.create({
      data: {
        id: projectId,
        name: projectId,
        description: 'Repo Indexer Test',
        status: 'IN_PROGRESS',
        clientName: 'Test Client'
      }
    });

    // 2. Initialize Workspace
    const workspacePath = await workspaceManager.initializeWorkspace(projectId, projectId);
    
    // 3. Write some files
    await workspaceManager.writeFile(projectId, 'index.ts', `
      export function hello() {
        console.log("Hello World");
      }
      
      export class Greeter {
        greet() {
          return "Hi";
        }
      }
    `);

    // 4. Run Indexer
    await repoIndexer.indexRepo(projectId);

    // 5. Verify DB
    const repo = await prisma.repo.findUnique({ 
        where: { projectId },
        include: { files: { include: { symbols: true, chunks: true } } }
    });

    if (repo && repo.files.length > 0) {
      console.log(`✅ Repo indexed. Files: ${repo.files.length}`);
      const file = repo.files.find(f => f.path === 'index.ts') || repo.files[0];
      console.log(`   File: ${file.path}`);
      console.log(`   Symbols: ${file.symbols.length}`);
      file.symbols.forEach(s => console.log(`     - ${s.kind} ${s.name} (${s.startLine}-${s.endLine})`));
      console.log(`   Chunks: ${file.chunks.length}`);
    } else {
      console.error('❌ Repo indexing failed or no files found.');
    }

    // Cleanup
    await prisma.project.delete({ where: { id: projectId } });

  } catch (error) {
    console.error('❌ Test Failed:', error);
  }
}

runTest();
