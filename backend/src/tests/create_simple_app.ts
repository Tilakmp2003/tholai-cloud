/**
 * Simple Test: Create a Todo App using the Virtual Software Company
 * 
 * This script demonstrates how to use your AI agent system to create a simple app.
 * The agents will plan, design, and potentially implement the application.
 */

const API_URL = 'http://localhost:4000';

async function createSimpleTodoApp() {
  console.log('🚀 Creating a simple Todo App using AI agents...\n');

  const projectData = {
    name: 'Simple Todo App',
    clientName: 'Test Client', // Required field
    requirements: `
Create a simple Todo application with the following features:

**Core Features:**
1. Add new todos with a title and description
2. Mark todos as complete/incomplete
3. Delete todos
4. Filter todos (All, Active, Completed)

**Tech Stack:**
- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: PostgreSQL
- Styling: Tailwind CSS

**Requirements:**
- Clean, modern UI
- Responsive design (mobile-friendly)
- Simple REST API
- Basic input validation
- Local storage fallback if DB is unavailable

Keep it simple - this is an MVP to test the AI agent system.
    `.trim(),
    priority: 'MEDIUM',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
  };

  try {
    console.log('📋 Project Requirements:');
    console.log(JSON.stringify(projectData, null, 2));
    console.log('\n');

    const response = await fetch(`${API_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log('✅ Project Created Successfully!');
    console.log(`📝 Project ID: ${result.id}`);
    console.log(`📛 Project Name: ${result.name}`);
    console.log(`📊 Status: ${result.status}`);

    console.log('\n🤖 AI Agents are now working on your project...');
    console.log('   - Socratic Agent: Analyzing requirements');
    console.log('   - Designer Agent: Creating UI/UX design');
    console.log('   - Architect Agent: Designing system architecture');
    console.log('   - Dev Agents: Will implement the features');

    console.log('\n📡 Monitor progress:');
    console.log(`   GET ${API_URL}/api/projects/${result.id}`);
    console.log(`   GET ${API_URL}/api/projects/${result.id}/tasks`);

    console.log('\n💡 Tip: Open the frontend to see real-time updates!');
    
    return result;

  } catch (error: any) {
    console.error('\n❌ Error creating project:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n⚠️ Backend not running! Start it with:');
      console.error('   cd backend && npm run dev');
    }
    
    throw error;
  }
}

// Run the test
if (require.main === module) {
  createSimpleTodoApp()
    .then(() => {
      console.log('\n✨ Test complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

export { createSimpleTodoApp };
