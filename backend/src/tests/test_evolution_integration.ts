/**
 * Evolution Integration Test Script
 * 
 * Tests the full evolution system integration:
 * 1. Initialize population
 * 2. Verify agents have evolutionary fields
 * 3. Run a dry-run evolution cycle
 * 4. Verify termination and breeding logic
 */

import { populationManager } from '../services/evolution/PopulationManager';
import { evolutionCycleService } from '../services/evolution/EvolutionCycleService';
import { prisma } from '../lib/prisma';

async function runEvolutionIntegrationTest() {
    console.log('================================================');
    console.log('🧬 EVOLUTION INTEGRATION TEST');
    console.log('================================================\n');

    try {
        // Step 1: Check current population
        console.log('📊 Step 1: Checking current population...');
        const initialStats = await populationManager.getPopulationStats();
        console.log(`   Total agents: ${initialStats.totalAgents}`);
        console.log(`   Alive agents: ${initialStats.aliveAgents}`);
        console.log(`   Average E: ${initialStats.avgE.toFixed(2)}`);
        console.log(`   Role distribution:`, initialStats.roleDistribution);
        console.log();

        // Step 2: Initialize population if empty
        if (initialStats.aliveAgents < 5) {
            console.log('🌱 Step 2: Initializing population (not enough agents)...');
            const created = await populationManager.initializePopulation();
            console.log(`   Created ${created} Gen 0 agents`);
            console.log();
        } else {
            console.log('✅ Step 2: Population already exists, skipping initialization');
            console.log();
        }

        // Step 3: Verify agents have evolutionary fields
        console.log('🔬 Step 3: Verifying evolutionary fields on agents...');
        const sampleAgents = await prisma.agent.findMany({
            take: 5,
            where: { existencePotential: { gt: 0 } }
        });

        for (const agent of sampleAgents) {
            console.log(`   ${agent.id}:`);
            console.log(`     - E: ${agent.existencePotential}`);
            console.log(`     - Generation: ${agent.generation}`);
            console.log(`     - Genome: ${agent.genome ? 'Present' : 'Missing'}`);
            console.log(`     - Parent: ${agent.parentId || 'None (Gen 0)'}`);
        }
        console.log();

        // Step 4: Run dry-run evolution cycle
        console.log('🔄 Step 4: Running DRY-RUN evolution cycle...');
        evolutionCycleService.setDryRunMode(true);
        const cycleResult = await evolutionCycleService.runCycle('test-project');
        
        console.log(`   Generation: ${cycleResult.generationNumber}`);
        console.log(`   Would terminate: ${cycleResult.terminated.length} agents`);
        console.log(`   Would breed: ${cycleResult.bred.length} offspring`);
        console.log(`   Survivors: ${cycleResult.survivors.length}`);
        console.log(`   Average fitness: ${cycleResult.avgFitness.toFixed(3)}`);
        console.log(`   Max fitness: ${cycleResult.maxFitness.toFixed(3)}`);
        console.log();

        // Step 5: Final stats
        console.log('📊 Step 5: Final population stats...');
        const finalStats = await populationManager.getPopulationStats();
        console.log(`   Total agents: ${finalStats.totalAgents}`);
        console.log(`   By generation:`, finalStats.generationDistribution);
        console.log(`   By role:`, finalStats.roleDistribution);
        console.log();

        console.log('================================================');
        console.log('✅ EVOLUTION INTEGRATION TEST COMPLETE');
        console.log('================================================');
        console.log('\nTo run a REAL evolution cycle (agents will die/breed):');
        console.log('  POST /api/evolution/cycle/run { "dryRun": false }');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
runEvolutionIntegrationTest();
