import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();

export interface StackFrame {
  functionName: string | null;
  filePath: string;
  lineNumber: number;
  columnNumber: number;
}

export class StackTraceMapper {
  
  /**
   * Parse a stack trace string into structured frames.
   */
  parse(stackTrace: string): StackFrame[] {
    const lines = stackTrace.split('\n');
    const frames: StackFrame[] = [];

    // Regex for "at Function (File:Line:Col)" or "at File:Line:Col"
    // Example: at RepoIndexer.indexRepo (/path/to/file.ts:15:5)
    const re1 = /at\s+(.+)\s+\((.+):(\d+):(\d+)\)/;
    // Example: at /path/to/file.ts:15:5
    const re2 = /at\s+(.+):(\d+):(\d+)/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('at ')) continue;

      let match = trimmed.match(re1);
      if (match) {
        frames.push({
          functionName: match[1],
          filePath: match[2],
          lineNumber: parseInt(match[3]),
          columnNumber: parseInt(match[4])
        });
        continue;
      }

      match = trimmed.match(re2);
      if (match) {
        frames.push({
          functionName: null,
          filePath: match[1],
          lineNumber: parseInt(match[2]),
          columnNumber: parseInt(match[3])
        });
      }
    }

    return frames;
  }

  /**
   * Map a stack trace to symbols in the indexed repo.
   */
  async mapToSymbol(projectId: string, stackTrace: string) {
    const repo = await prisma.repo.findUnique({ where: { projectId } });
    if (!repo) return null;
    const repoId = repo.id;

    const frames = this.parse(stackTrace);
    if (frames.length === 0) return null;

    // Try to map the top frame
    const topFrame = frames[0];
    
    // Normalize path: remove workspace root if present
    // We assume the indexed paths are relative.
    // We need to match the end of the path.
    
    // Find file in DB that ends with the frame path
    // This is tricky because frame path is absolute.
    // We'll try to match by filename first.
    const filename = path.basename(topFrame.filePath);
    
    const candidates = await prisma.repoFile.findMany({
      where: {
        repoId,
        path: {
          endsWith: filename
        }
      },
      include: {
        symbols: true
      }
    });

    // Find the exact file match (if multiple files have same name)
    // For MVP, we take the first one or try to match more path segments?
    // Let's just use the first candidate for now.
    const file = candidates[0];
    if (!file) return null;

    // Find symbol containing the line number
    const symbol = file.symbols.find(s => 
      s.startLine <= topFrame.lineNumber && s.endLine >= topFrame.lineNumber
    );

    return {
      frame: topFrame,
      file: file.path,
      symbol: symbol || null
    };
  }
}

export const stackTraceMapper = new StackTraceMapper();
