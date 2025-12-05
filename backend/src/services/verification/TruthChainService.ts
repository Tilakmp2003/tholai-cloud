/**
 * Zero-Hallucination System: Truth Chain Service
 * 
 * Blockchain-like immutable ledger for storing verified outputs.
 * Each block contains verified statements and links to the previous block.
 */

import { createHash } from 'crypto';
import { PrismaClient, TruthBlock, VerifiedStatement } from '@prisma/client';
import { symbolicHasher } from './SymbolicHasher';
import { hallucinationDetector } from './HallucinationDetector';
import { VerificationResult, VerifiedStatementData } from '../../types/verification';

const prisma = new PrismaClient();

// Genesis block hash (the first block in the chain)
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export class TruthChainService {
  private readonly DIFFICULTY = 2; // Number of leading zeros required (simplified PoW)

  /**
   * Verify and add a statement to the truth chain.
   * Returns the verification result and block info if successful.
   */
  async verifyAndStore(
    agentId: string,
    content: string,
    contentType: 'CODE' | 'TEXT' | 'JSON',
    options: {
      taskId?: string;
      inputContext?: string;
      language?: 'javascript' | 'typescript' | 'python';
    } = {}
  ): Promise<{
    verified: boolean;
    verificationResult: VerificationResult;
    block?: TruthBlock;
    statement?: VerifiedStatement;
  }> {
    // Step 1: Verify the content
    const verificationResult = await hallucinationDetector.verify({
      agentId,
      taskId: options.taskId,
      input: options.inputContext || '',
      output: content,
      language: options.language,
    });

    if (!verificationResult.passed) {
      // Log the failed verification
      await this.logFailedVerification(agentId, content, verificationResult, options.taskId);
      
      return {
        verified: false,
        verificationResult,
      };
    }

    // Step 2: Add to truth chain
    const statement: VerifiedStatementData = {
      agentId,
      taskId: options.taskId,
      contentType,
      content,
      contentHash: symbolicHasher.hashContent(content),
      proofHash: verificationResult.proofHash,
      syntaxValid: verificationResult.checks.syntax.passed,
      sandboxValid: verificationResult.checks.sandbox.passed,
      entropyValid: verificationResult.checks.entropy.passed,
    };

    const { block, statement: savedStatement } = await this.addStatement(statement);

    return {
      verified: true,
      verificationResult,
      block,
      statement: savedStatement,
    };
  }

  /**
   * Add a verified statement to the chain.
   * Creates a new block or adds to the current pending block.
   */
  private async addStatement(statementData: VerifiedStatementData): Promise<{
    block: TruthBlock;
    statement: VerifiedStatement;
  }> {
    // Get or create the latest block
    let latestBlock = await this.getLatestBlock();
    
    if (!latestBlock) {
      // Create genesis block
      latestBlock = await this.createGenesisBlock();
    }

    // Create the verified statement
    const statement = await prisma.verifiedStatement.create({
      data: {
        blockId: latestBlock.id,
        agentId: statementData.agentId,
        taskId: statementData.taskId,
        contentType: statementData.contentType,
        content: statementData.content,
        contentHash: statementData.contentHash,
        proofHash: statementData.proofHash,
        syntaxValid: statementData.syntaxValid,
        sandboxValid: statementData.sandboxValid,
        entropyValid: statementData.entropyValid,
        entropyScore: statementData.entropyScore,
        complexityRatio: statementData.complexityRatio,
      },
    });

    // Check if we should seal this block and create a new one
    const statementCount = await prisma.verifiedStatement.count({
      where: { blockId: latestBlock.id },
    });

    if (statementCount >= 10) {
      // Seal current block and create new one
      await this.sealAndCreateNewBlock(latestBlock);
    }

    return { block: latestBlock, statement };
  }

  /**
   * Get the latest block in the chain
   */
  private async getLatestBlock(): Promise<TruthBlock | null> {
    return prisma.truthBlock.findFirst({
      orderBy: { index: 'desc' },
    });
  }

  /**
   * Create the genesis (first) block
   */
  private async createGenesisBlock(): Promise<TruthBlock> {
    const blockData = {
      index: 0,
      previousHash: GENESIS_HASH,
      nonce: 0,
    };

    const hash = this.calculateBlockHash(blockData, []);

    return prisma.truthBlock.create({
      data: {
        index: 0,
        previousHash: GENESIS_HASH,
        hash,
        nonce: 0,
      },
    });
  }

  /**
   * Seal current block and create a new one
   */
  private async sealAndCreateNewBlock(currentBlock: TruthBlock): Promise<TruthBlock> {
    // Get all statements in current block
    const statements = await prisma.verifiedStatement.findMany({
      where: { blockId: currentBlock.id },
    });

    // Recalculate and update the block hash
    const { hash, nonce } = this.mineBlock({
      index: currentBlock.index,
      previousHash: currentBlock.previousHash,
      nonce: 0,
    }, statements);

    await prisma.truthBlock.update({
      where: { id: currentBlock.id },
      data: { hash, nonce },
    });

    // Create new block
    const newIndex = currentBlock.index + 1;
    const newBlockData = {
      index: newIndex,
      previousHash: hash,
      nonce: 0,
    };
    const newHash = this.calculateBlockHash(newBlockData, []);

    return prisma.truthBlock.create({
      data: {
        index: newIndex,
        previousHash: hash,
        hash: newHash,
        nonce: 0,
      },
    });
  }

  /**
   * Calculate block hash from block data and statements
   */
  private calculateBlockHash(
    blockData: { index: number; previousHash: string; nonce: number },
    statements: VerifiedStatement[]
  ): string {
    const statementHashes = statements.map(s => s.contentHash).join('');
    const payload = `${blockData.index}${blockData.previousHash}${statementHashes}${blockData.nonce}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Simple proof-of-work mining (find nonce that produces hash with leading zeros)
   */
  private mineBlock(
    blockData: { index: number; previousHash: string; nonce: number },
    statements: VerifiedStatement[]
  ): { hash: string; nonce: number } {
    let nonce = 0;
    let hash = '';
    const target = '0'.repeat(this.DIFFICULTY);

    do {
      nonce++;
      blockData.nonce = nonce;
      hash = this.calculateBlockHash(blockData, statements);
    } while (!hash.startsWith(target) && nonce < 1000000);

    return { hash, nonce };
  }

  /**
   * Log a failed verification attempt
   */
  private async logFailedVerification(
    agentId: string,
    content: string,
    result: VerificationResult,
    taskId?: string
  ): Promise<void> {
    let failureReason = 'UNKNOWN';
    if (!result.checks.syntax.passed) failureReason = 'SYNTAX_ERROR';
    else if (!result.checks.sandbox.passed) failureReason = 'SANDBOX_FAIL';
    else if (!result.checks.entropy.passed) failureReason = 'ENTROPY_VIOLATION';

    await prisma.hallucinationCheck.create({
      data: {
        agentId,
        taskId,
        inputHash: '', // Would need input context
        outputHash: symbolicHasher.hashContent(content),
        passed: false,
        failureReason,
        syntaxCheckMs: result.checks.syntax.durationMs,
        sandboxCheckMs: result.checks.sandbox.durationMs,
        entropyScore: undefined, // Could extract from entropy check
        flaggedOutput: content,
      },
    });

    console.log(`[TruthChain] ⚠️ Hallucination detected: ${failureReason} (Agent: ${agentId})`);
  }

  /**
   * Verify the integrity of the entire chain
   */
  async verifyChainIntegrity(): Promise<{
    valid: boolean;
    invalidBlocks: number[];
  }> {
    const blocks = await prisma.truthBlock.findMany({
      orderBy: { index: 'asc' },
      include: { statements: true },
    });

    const invalidBlocks: number[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      // Check 1: Verify hash
      const calculatedHash = this.calculateBlockHash(
        { index: block.index, previousHash: block.previousHash, nonce: block.nonce },
        block.statements
      );

      if (calculatedHash !== block.hash) {
        invalidBlocks.push(block.index);
        continue;
      }

      // Check 2: Verify previous hash link (except genesis)
      if (i > 0) {
        const prevBlock = blocks[i - 1];
        if (block.previousHash !== prevBlock.hash) {
          invalidBlocks.push(block.index);
        }
      }
    }

    return {
      valid: invalidBlocks.length === 0,
      invalidBlocks,
    };
  }

  /**
   * Get verification statistics
   */
  async getStats(): Promise<{
    totalBlocks: number;
    totalStatements: number;
    totalHallucinationsDetected: number;
    hallucinationRate: number;
  }> {
    const [blockCount, statementCount, hallucinationCount] = await Promise.all([
      prisma.truthBlock.count(),
      prisma.verifiedStatement.count(),
      prisma.hallucinationCheck.count({ where: { passed: false } }),
    ]);

    const totalAttempts = statementCount + hallucinationCount;
    const hallucinationRate = totalAttempts > 0 ? hallucinationCount / totalAttempts : 0;

    return {
      totalBlocks: blockCount,
      totalStatements: statementCount,
      totalHallucinationsDetected: hallucinationCount,
      hallucinationRate,
    };
  }
}

// Singleton export
export const truthChainService = new TruthChainService();
