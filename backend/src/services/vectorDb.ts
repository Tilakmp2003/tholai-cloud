import { randomUUID, createHash } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Claim 3: Immutable Context Reference Architecture
 * 
 * Simulates a Vector Database that stores "Immutable Artifacts".
 * In a real system, this would connect to Pinecone/Weaviate.
 * 
 * Phase 3 Upgrade: Persistence via Postgres (Prisma)
 */
class VectorDbService {
  // Removed in-memory storage: private storage = new Map<string, string>();

  /**
   * Stores content as an Immutable Artifact and returns a Vector Pointer.
   * Upgrade: Appends SHA-256 hash for Zero-Drift verification.
   */
  async store(content: string): Promise<string> {
    const id = randomUUID();
    
    // Claim 3 Upgrade: Cryptographic Seal
    const hash = createHash('sha256').update(content).digest('hex');
    const vectorPointer = `vector://${id}?sig=${hash}`;
    
    // Phase 3: Persist to Postgres
    await prisma.artifact.create({
      data: {
        id,
        content,
        hash
      }
    });

    console.log(`[VectorDb] 🧊 Stored Immutable Artifact (Persisted): ${vectorPointer}`);
    
    return vectorPointer;
  }

  /**
   * Retrieves the original content using a Vector Pointer (RAG).
   * Upgrade: Verifies SHA-256 hash to ensure integrity.
   */
  async retrieve(vectorPointer: string): Promise<string | null> {
    if (!vectorPointer.startsWith("vector://")) {
      return null;
    }

    // Parse ID and Signature
    const url = new URL(vectorPointer);
    const id = url.hostname; // 'vector://uuid' -> hostname is uuid in some parsers, but let's parse manually for safety
    
    // Manual parsing to be safe with custom protocol
    const parts = vectorPointer.split('?sig=');
    const base = parts[0];
    const signature = parts[1];
    const uuid = base.replace('vector://', '');

    // Phase 3: Retrieve from Postgres
    const artifact = await prisma.artifact.findUnique({
      where: { id: uuid }
    });
    
    if (artifact) {
      const content = artifact.content;

      // Verify Integrity
      if (signature) {
        const currentHash = createHash('sha256').update(content).digest('hex');
        if (currentHash !== signature) {
          console.error(`[VectorDb] 🚨 INTEGRITY BREACH! Hash mismatch for ${uuid}`);
          throw new Error("Immutable Context Corrupted: Hash mismatch");
        }
        console.log(`[VectorDb] ✅ Verified Merkle Seal for ${uuid}`);
      }

      console.log(`[VectorDb] 🔍 Dereferenced pointer: ${vectorPointer}`);
      return content;
    } else {
      console.warn(`[VectorDb] ⚠️  Pointer not found: ${vectorPointer}`);
      return null;
    }
  }
}

export const vectorDb = new VectorDbService();
