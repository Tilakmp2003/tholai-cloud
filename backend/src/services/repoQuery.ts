import { PrismaClient } from '@prisma/client';
import { vectorDb } from './vectorDb';

const prisma = new PrismaClient();

export class RepoQueryService {
  
  /**
   * Fetch symbol details by name and projectId.
   * Useful for agents to find function definitions.
   */
  async fetchBySymbol(projectId: string, symbolName: string) {
    const repo = await prisma.repo.findUnique({ where: { projectId } });
    if (!repo) {
      console.warn(`[RepoQuery] Repo not found for project ${projectId}`);
      return null;
    }
    const repoId = repo.id;

    console.log(`[RepoQuery] Fetching symbol '${symbolName}' in repo '${repoId}' (Project: ${projectId})`);
    
    // Find symbol in DB
    const symbol = await prisma.symbol.findFirst({
      where: {
        repoId,
        name: symbolName
      },
      include: {
        file: true
      }
    });
    console.log(`[RepoQuery] Found symbol:`, symbol ? symbol.name : 'NULL');

    if (!symbol) return null;

    // Fetch content from file chunk or read file?
    // We stored chunks. Let's try to find the chunk for this symbol.
    const chunk = await prisma.fileChunk.findFirst({
      where: {
        repoId,
        fileId: symbol.fileId,
        startLine: symbol.startLine,
        endLine: symbol.endLine
      }
    });

    return {
      symbol,
      code: chunk?.text || null,
      location: `${symbol.file.path}:${symbol.startLine}-${symbol.endLine}`
    };
  }

  /**
   * Retrieve relevant code chunks using RAG (Vector Search).
   * Currently mocks vector search by returning random chunks or keyword match.
   */
  async ragRetrieve(projectId: string, query: string, limit = 3) {
    const repo = await prisma.repo.findUnique({ where: { projectId } });
    if (!repo) return [];
    const repoId = repo.id;

    console.log(`[RepoQuery] 🔍 RAG Query: "${query}" in ${repoId}`);
    
    // TODO: Implement real vector search via vectorDb service
    // For now, we'll do a simple keyword search on FileChunk text
    // This is a "poor man's" RAG for MVP
    
    const chunks = await prisma.fileChunk.findMany({
      where: {
        repoId,
        text: {
          contains: query // Simple substring match
        }
      },
      take: limit,
      include: {
        file: true
      }
    });

    return chunks.map(chunk => ({
      text: chunk.text,
      filePath: chunk.file.path,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      score: 1.0 // Mock score
    }));
  }
}

export const repoQuery = new RepoQueryService();
