/**
 * Export Generated Code
 * Extracts AI-generated code from completed tasks and saves to files
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface TaskWithModule {
  id: string;
  result: any;
  module: {
    name: string;
    project: {
      name: string;
    };
  };
}

async function exportGeneratedCode(projectName?: string) {
  console.log('🚀 Extracting generated code...\n');

  // Fetch all completed tasks
  const tasks: TaskWithModule[] = await prisma.task.findMany({
    where: {
      status: 'COMPLETED',
      ...(projectName && {
        module: {
          project: {
            name: projectName
          }
        }
      })
    },
    include: {
      module: {
        include: {
          project: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  if (tasks.length === 0) {
    console.log('❌ No completed tasks found.');
    return;
  }

  console.log(`📦 Found ${tasks.length} completed tasks\n`);

  // Group by project
  const projectMap = new Map<string, TaskWithModule[]>();
  for (const task of tasks) {
    const projName = task.module.project.name;
    if (!projectMap.has(projName)) {
      projectMap.set(projName, []);
    }
    projectMap.get(projName)!.push(task);
  }

  // Process each project
  for (const [proj, projTasks] of projectMap.entries()) {
    console.log(`\n📁 Project: ${proj}`);
    console.log(`   Tasks: ${projTasks.length}`);

    const outputDir = path.join(process.cwd(), 'generated', sanitizeFilename(proj));
    
    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let extractedCount = 0;
    const summary: string[] = [];

    // Group tasks by module
    const moduleMap = new Map<string, TaskWithModule[]>();
    for (const task of projTasks) {
      const modName = task.module.name;
      if (!moduleMap.has(modName)) {
        moduleMap.set(modName, []);
      }
      moduleMap.get(modName)!.push(task);
    }

    // Process each module
    for (const [moduleName, moduleTasks] of moduleMap.entries()) {
      console.log(`\n   📂 Module: ${moduleName} (${moduleTasks.length} tasks)`);
      
      const moduleDir = path.join(outputDir, sanitizeFilename(moduleName));
      if (!fs.existsSync(moduleDir)) {
        fs.mkdirSync(moduleDir, { recursive: true });
      }

      // Extract code from each task
      for (let i = 0; i < moduleTasks.length; i++) {
        const task = moduleTasks[i];
        
        if (!task.result || typeof task.result !== 'object') {
          console.log(`      ⚠️  Task ${i + 1}: No valid result data`);
          continue;
        }

        // Extract code - try different possible structures
        let code = extractCode(task.result);
        
        if (!code) {
          console.log(`      ⚠️  Task ${i + 1}: Could not extract code`);
          continue;
        }

        // Clean markdown artifacts
        code = cleanMarkdown(code);

        // Determine filename
        const filename = `task_${i + 1}_${task.id.substring(0, 8)}.ts`;
        const filepath = path.join(moduleDir, filename);

        // Save to file
        fs.writeFileSync(filepath, code, 'utf-8');
        extractedCount++;

        console.log(`      ✅ Task ${i + 1}: Saved to ${filename} (${code.length} chars)`);
        summary.push(`${moduleName}/${filename}`);
      }
    }

    // Create summary report
    const summaryPath = path.join(outputDir, 'EXPORT_SUMMARY.md');
    const summaryContent = `# Code Export Summary

**Project**: ${proj}
**Export Date**: ${new Date().toISOString()}
**Tasks Processed**: ${projTasks.length}
**Files Generated**: ${extractedCount}

## Generated Files

${summary.map(f => `- \`${f}\``).join('\n')}

## Directory Structure

\`\`\`
${outputDir}/
${Array.from(moduleMap.keys()).map(m => `├── ${sanitizeFilename(m)}/`).join('\n')}
\`\`\`

## Next Steps

1. Review the generated code
2. Run type checking: \`tsc --noEmit\`
3. Fix any compilation errors
4. Integrate into your project
5. Add tests
`;

    fs.writeFileSync(summaryPath, summaryContent, 'utf-8');
    
    console.log(`\n✅ Exported ${extractedCount} files to: ${outputDir}`);
    console.log(`📄 Summary saved to: ${summaryPath}\n`);
  }
}

function extractCode(result: any): string | null {
  // Try different possible structures where code might be stored
  if (typeof result === 'string') {
    return result;
  }
  
  if (result.output) {
    return typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2);
  }
  
  if (result.code) {
    return typeof result.code === 'string' ? result.code : JSON.stringify(result.code, null, 2);
  }
  
  if (result.implementation) {
    return typeof result.implementation === 'string' ? result.implementation : JSON.stringify(result.implementation, null, 2);
  }

  // If result is an object, try to stringify it
  return JSON.stringify(result, null, 2);
}

function cleanMarkdown(code: string): string {
  // Remove markdown code fences
  code = code.replace(/```[\w]*\n/g, '');
  code = code.replace(/```$/g, '');
  
  // Remove leading/trailing whitespace
  code = code.trim();
  
  return code;
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Main execution
const projectName = process.argv[2]; // Optional: specify project name

exportGeneratedCode(projectName)
  .then(() => {
    console.log('🎉 Code export complete!\n');
  })
  .catch(e => {
    console.error('❌ Error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
