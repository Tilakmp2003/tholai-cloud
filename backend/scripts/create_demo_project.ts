import { PrismaClient } from '@prisma/client';
import { workspaceManager } from '../src/services/workspaceManager';

const prisma = new PrismaClient();

async function createRealProject() {
  console.log('🚀 Creating a real Next.js project for testing...\n');

  const projectId = 'demo-app-' + Date.now();
  
  try {
    // 1. Create in database
    console.log('📊 Creating project in database...');
    const project = await prisma.project.create({
      data: {
        id: projectId,
        name: 'Demo App',
        description: 'A real Next.js app for testing',
        status: 'PLANNED',
        clientName: 'Demo Client',
      }
    });
    console.log(`✅ Project created: ${project.id}`);

    // 2. Initialize workspace with actual Next.js files
    console.log('\n📦 Initializing Next.js workspace...');
    const workspacePath = await workspaceManager.initializeWorkspace(
      projectId,
      'Demo App'
    );
    console.log(`✅ Workspace created at: ${workspacePath}`);

    // 3. Write a sample component
    console.log('\n📝 Writing sample component...');
    await workspaceManager.writeFile(
      projectId,
      'components/Button.tsx',
      `export default function Button({ label }: { label: string }) {
  return (
    <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
      {label}
    </button>
  );
}`
    );
    console.log('✅ Created components/Button.tsx');

    console.log('\n🎉 Project created successfully!');
    console.log('\n📌 Project Details:');
    console.log(`   ID: ${projectId}`);
    console.log(`   Name: Demo App`);
    console.log(`   Path: ${workspacePath}`);
    console.log('\n🔗 Open in browser:');
    console.log(`   http://localhost:3000/workspace?project=${projectId}`);

  } catch (error) {
    console.error('❌ Error creating project:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createRealProject();
