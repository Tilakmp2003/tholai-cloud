import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// --- Projects ---
router.post('/project', async (req, res) => {
  try {
    const { name, clientName, status } = req.body;
    const project = await prisma.project.create({
      data: { name, clientName, status },
    });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.get('/project', async (req, res) => {
  const projects = await prisma.project.findMany();
  res.json(projects);
});

// --- Modules ---
router.post('/module', async (req, res) => {
  try {
    const { name, projectId, status } = req.body;
    const module = await prisma.module.create({
      data: { name, projectId, status },
    });
    res.json(module);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create module' });
  }
});

router.get('/module', async (req, res) => {
  const modules = await prisma.module.findMany();
  res.json(modules);
});

// --- Agents ---
router.post('/agent', async (req, res) => {
  try {
    const { role, specialization, status } = req.body;
    const agent = await prisma.agent.create({
      data: { role, specialization, status },
    });
    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

router.get('/agent', async (req, res) => {
  const agents = await prisma.agent.findMany();
  res.json(agents);
});

// --- Tasks ---
router.post('/task', async (req, res) => {
  try {
    const { moduleId, requiredRole, summary } = req.body;
    
    const contextPacket = {
      summary,
      createdAt: new Date().toISOString(),
    };

    const task = await prisma.task.create({
      data: { moduleId, requiredRole, status: 'QUEUED', contextPacket },
    });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.get('/task', async (req, res) => {
  const tasks = await prisma.task.findMany();
  res.json(tasks);
});

export { router };
