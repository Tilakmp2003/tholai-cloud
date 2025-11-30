/**
 * Phase 8: Project Creation API
 * 
 * Handles new project intake and initialization
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { workspaceManager } from '../services/workspaceManager';
import { planProject } from '../services/projectPlanner';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/projects
 * List all projects
 */
router.get('/', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        clientName: true,
        description: true,
        domain: true,
        status: true,
        workspacePath: true,
        devPort: true,
        previewStatus: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json(projects);
  } catch (error: any) {
    console.error('[Projects API] Error listing projects:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

/**
 * POST /api/projects
 * Create a new project from user requirements
 */
router.post('/', async (req, res) => {
  try {
    const { name, clientName, description, domain } = req.body;

    // Validation
    if (!name || !clientName) {
      return res.status(400).json({ 
        error: 'name and clientName are required' 
      });
    }

    console.log(`[Projects API] Creating project: ${name}`);

    // Step 1: Create project record
    const project = await prisma.project.create({
      data: {
        name,
        clientName,
        description: description || '',
        domain: domain || 'CUSTOM',
        status: 'IN_PROGRESS'
      }
    });

    console.log(`[Projects API] Project created with ID: ${project.id}`);

    // Step 2: Initialize workspace (Background)
    // Don't await this - it takes too long (create-next-app) and will timeout the HTTP request
    workspaceManager.initializeWorkspace(project.id, project.name)
      .then(() => console.log(`[Projects API] Workspace initialized for ${project.id}`))
      .catch(error => console.error(`[Projects API] Workspace init failed:`, error.message));

    // Step 3: Analyze PRD and create modules/tasks (async)
    if (description && description.length > 20) {
      // Run planning in background
      planProject(project.id, description, domain)
        .then(result => {
          console.log(`[Projects API] Planning complete for ${project.id}`);
          console.log(`  → Created ${result.modules.length} modules`);
        })
        .catch(error => {
          console.error(`[Projects API] Planning failed for ${project.id}:`, error);
        });
    }

    // Return immediately
    res.status(201).json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        clientName: project.clientName,
        domain: project.domain,
        status: project.status
      },
      message: 'Project created! AI agents are analyzing requirements and creating modules...'
    });

  } catch (error: any) {
    console.error('[Projects API] Error creating project:', error);
    res.status(500).json({ 
      error: 'Failed to create project',
      details: error.message
    });
  }
});

/**
 * GET /api/projects/:id
 * Get project details with modules and tasks
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            tasks: {
              take: 5,
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error: any) {
    console.error('[Projects API] Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

export default router;
