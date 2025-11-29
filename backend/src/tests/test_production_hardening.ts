import { confidenceRouter } from '../services/confidenceRouter';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function runTests() {
  console.log('🛡️ Starting Production Hardening Tests...');

  // Setup: Create dummy project, module, and tasks
  const project = await prisma.project.create({
    data: { name: 'Test Project', clientName: 'Test Client' }
  });
  const module = await prisma.module.create({
    data: { name: 'Test Module', projectId: project.id }
  });
  const taskHigh = await prisma.task.create({
    data: { title: 'High Conf Task', moduleId: module.id, requiredRole: 'DEV', status: 'IN_QA' }
  });
  const taskMed = await prisma.task.create({
    data: { title: 'Med Conf Task', moduleId: module.id, requiredRole: 'DEV', status: 'IN_QA' }
  });
  const taskLow = await prisma.task.create({
    data: { title: 'Low Conf Task', moduleId: module.id, requiredRole: 'DEV', status: 'IN_QA' }
  });

  // 1. Test Confidence Router
  console.log('\n[Test] Confidence Router:');
  
  // High Confidence -> Auto-Verify
  console.log('Testing High Confidence (0.9)...');
  await confidenceRouter.routeByConfidence({
    bugId: 'BUG-TEST-HIGH',
    taskId: taskHigh.id,
    severity: 'HIGH',
    confidence: 0.9,
    suggestedPatch: 'const x = 1;'
  });

  // Medium Confidence -> Team Lead Review
  console.log('Testing Medium Confidence (0.7)...');
  await confidenceRouter.routeByConfidence({
    bugId: 'BUG-TEST-MED',
    taskId: taskMed.id,
    severity: 'MEDIUM',
    confidence: 0.7,
    suggestedPatch: 'const y = 2;'
  });

  // Low Confidence -> War Room
  console.log('Testing Low Confidence (0.4)...');
  await confidenceRouter.routeByConfidence({
    bugId: 'BUG-TEST-LOW',
    taskId: taskLow.id,
    severity: 'LOW',
    confidence: 0.4,
    suggestedPatch: 'const z = 3;'
  });

  // 2. Test Human Review Endpoint (Mocked Call)
  console.log('\n[Test] Human Review Endpoint:');
  try {
    console.log('Simulating POST /api/reviews/prop-123/decision with APPROVE');
    // const res = await axios.post('http://localhost:4000/api/reviews/prop-123/decision', { ... });
  } catch (e: any) {
    console.error('Review endpoint test failed:', e.message);
  }

  // 3. Test Audit Endpoint (Mocked Call)
  console.log('\n[Test] Audit Endpoint:');
  try {
    console.log('Simulating GET /api/audit/prop-123');
    // const res = await axios.get('http://localhost:4000/api/audit/prop-123');
    // console.log('Audit Logs:', res.data);
    
    console.log('Simulating GET /api/audit/entry/audit-1/verify');
    // const verifyRes = await axios.get('http://localhost:4000/api/audit/entry/audit-1/verify');
    // console.log('Verification:', verifyRes.data);
  } catch (e: any) {
    console.error('Audit endpoint test failed:', e.message);
  }

  console.log('\n🎉 Production Hardening Tests Completed!');
}

if (require.main === module) {
  runTests().catch(console.error);
}
