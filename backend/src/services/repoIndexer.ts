import fs from 'fs/promises';
import path from 'path';
import * as recast from 'recast';
import * as parser from '@babel/parser';
import { visit } from 'ast-types';
import { PrismaClient } from '@prisma/client';
import { workspaceManager } from './workspaceManager';
import { vectorDb } from './vectorDb';

const prisma = new PrismaClient();

export class RepoIndexer {
  
  /**
   * Index a repository for a project
   */
  async indexRepo(projectId: string) {
    console.log(`[RepoIndexer] 🔍 Indexing project: ${projectId}`);
    
    // 1. Get Workspace Path
    const status = await workspaceManager.getPreviewStatus(projectId);
    if (!status.workspacePath) {
      throw new Error(`Project ${projectId} has no workspace initialized.`);
    }
    const rootPath = status.workspacePath;

    // 2. Create or Update Repo Record
    let repo = await prisma.repo.findUnique({ where: { projectId } });
    if (!repo) {
      repo = await prisma.repo.create({
        data: { projectId, rootPath }
      });
    }

    // 3. Walk Directory
    const files = await this.walkDir(rootPath);
    console.log(`[RepoIndexer] Found ${files.length} files.`);

    // 4. Process Each File
    for (const filePath of files) {
      const relativePath = path.relative(rootPath, filePath);
      
      // Skip node_modules, .git, etc.
      if (relativePath.includes('node_modules') || relativePath.includes('.git') || relativePath.includes('dist') || relativePath.includes('.next')) {
        continue;
      }

      await this.processFile(repo.id, filePath, relativePath);
    }
    
    console.log(`[RepoIndexer] ✅ Indexing complete for ${projectId}`);
  }

  private async walkDir(dir: string, exts = ['.js', '.ts', '.jsx', '.tsx']): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const it of items) {
        const full = path.join(dir, it.name);
        if (it.isDirectory()) {
          if (it.name === 'node_modules' || it.name === '.git' || it.name === '.next' || it.name === 'dist') {
            continue;
          }
          files.push(...await this.walkDir(full, exts));
        } else if (exts.includes(path.extname(it.name))) {
          files.push(full);
        }
      }
    } catch (e) {
      // Ignore errors (e.g. permission denied)
    }
    return files;
  }

  private async processFile(repoId: string, absolutePath: string, relativePath: string) {
    try {
      const content = await fs.readFile(absolutePath, 'utf8');
      const stats = await fs.stat(absolutePath);
      
      console.log(`[RepoIndexer] Processing file: ${relativePath}`);

      // Create/Update RepoFile
      // Note: In real app, check contentHash to skip unchanged files
      const fileRecord = await prisma.repoFile.create({
        data: {
          repoId,
          path: relativePath,
          ext: path.extname(relativePath),
          size: stats.size,
          mtime: stats.mtime,
          contentHash: 'TODO_HASH' // Implement hash check
        }
      });

      // Extract Symbols
      const { symbols } = await this.extractSymbols(content);
      
      // Store Symbols
      for (const sym of symbols) {
        await prisma.symbol.create({
          data: {
            repoId,
            fileId: fileRecord.id,
            name: sym.name,
            kind: sym.kind,
            startLine: sym.startLine,
            endLine: sym.endLine
          }
        });
      }

      // Chunk and Index (RAG)
      await this.chunkAndIndex(repoId, fileRecord.id, content, symbols);

    } catch (error) {
      console.error(`[RepoIndexer] Failed to process ${relativePath}:`, error);
    }
  }

  private async extractSymbols(sourceCode: string) {
    const symbols: any[] = [];
    try {
      const ast = recast.parse(sourceCode, {
        parser: {
          parse(code: string) {
            return parser.parse(code, {
              sourceType: 'module',
              plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties'],
              tokens: true
            });
          }
        }
      });

      visit(ast, {
        visitFunctionDeclaration(path) {
          if (path.node.id) {
            const startLine = path.node.loc?.start.line ?? RepoIndexer.getLineFromOffset(sourceCode, path.node.start as number);
            const endLine = path.node.loc?.end.line ?? RepoIndexer.getLineFromOffset(sourceCode, path.node.end as number);
            symbols.push({
              name: path.node.id.name,
              kind: 'function',
              startLine,
              endLine
            });
            console.log(`[RepoIndexer] Extracted function: ${path.node.id.name}`);
          }
          this.traverse(path);
        },
        visitClassDeclaration(path) {
          if (path.node.id) {
            const startLine = path.node.loc?.start.line ?? RepoIndexer.getLineFromOffset(sourceCode, path.node.start as number);
            const endLine = path.node.loc?.end.line ?? RepoIndexer.getLineFromOffset(sourceCode, path.node.end as number);
            symbols.push({
              name: path.node.id.name,
              kind: 'class',
              startLine,
              endLine
            });
          }
          this.traverse(path);
        },
        visitVariableDeclarator(path) {
           // Handle const foo = () => {}
           if (path.node.id.type === 'Identifier' && path.node.init && 
              (path.node.init.type === 'ArrowFunctionExpression' || path.node.init.type === 'FunctionExpression')) {
               const startLine = path.node.loc?.start.line ?? RepoIndexer.getLineFromOffset(sourceCode, path.node.start as number);
               const endLine = path.node.loc?.end.line ?? RepoIndexer.getLineFromOffset(sourceCode, path.node.end as number);
               symbols.push({
                 name: path.node.id.name,
                 kind: 'function',
                 startLine,
                 endLine
               });
           }
           this.traverse(path);
        }
      });
    } catch (e) {
      console.error('Parse error:', e);
    }
    return { symbols };
  }

  private static getLineFromOffset(source: string, offset: number): number {
    if (typeof offset !== 'number') return 0;
    return source.substring(0, offset).split('\n').length;
  }

  private async chunkAndIndex(repoId: string, fileId: string, content: string, symbols: any[]) {
    const lines = content.split('\n');
    
    // Strategy: Chunk by symbol, fallback to fixed window
    // For MVP, we just chunk by symbol
    for (const sym of symbols) {
      const chunkText = lines.slice(sym.startLine - 1, sym.endLine).join('\n');
      
      // Store in Vector DB (Mock/Real)
      const vectorId = await vectorDb.store(chunkText); // This returns a pointer, in real app it returns vector ID
      
      await prisma.fileChunk.create({
        data: {
          repoId,
          fileId,
          symbolId: sym.name, // We don't have symbol ID yet, maybe store name or link to Symbol record
          startLine: sym.startLine,
          endLine: sym.endLine,
          text: chunkText,
          vectorId: vectorId,
          contentHash: 'TODO_HASH'
        }
      });
    }
  }
}

export const repoIndexer = new RepoIndexer();
