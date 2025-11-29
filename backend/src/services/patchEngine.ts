import * as recast from 'recast';
import * as parser from '@babel/parser';
import { visit } from 'ast-types';
import * as path from 'path';

export type PatchOperation = 
  | { type: 'replace_function'; name: string; newCode: string }
  | { type: 'add_import'; code: string }
  | { type: 'replace_file'; code: string }; // Fallback

export class PatchEngine {
  /**
   * Apply a list of patch operations to a file
   */
  applyPatchesToFile(filePath: string, sourceCode: string, operations: PatchOperation[]): string {
    const ext = path.extname(filePath);
    
    // Route to language-specific handler
    if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) {
      return this.applyJSPatches(sourceCode, operations);
    } else if (ext === '.py') {
      return this.applyPythonPatches(sourceCode, operations);
    } else if (['.sh', '.bash'].includes(ext)) {
      return this.applyBashPatches(sourceCode, operations);
    }
    
    // Fallback: text-based replacement
    return this.applyTextPatches(sourceCode, operations);
  }

  /**
   * Legacy method for backward compatibility (assumes JS/TS)
   */
  applyPatches(sourceCode: string, operations: PatchOperation[]): string {
    return this.applyJSPatches(sourceCode, operations);
  }

  // ============================================
  // JavaScript/TypeScript Support (existing)
  // ============================================

  private applyJSPatches(sourceCode: string, operations: PatchOperation[]): string {
    let ast: any;
    
    try {
      ast = recast.parse(sourceCode, {
        parser: {
          parse(code: string) {
            return parser.parse(code, {
              sourceType: 'module',
              plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'estree'],
              tokens: true // Recast needs tokens
            });
          }
        }
      });
    } catch (e) {
      console.error('Failed to parse JS/TS AST:', e);
      // Fallback: if we can't parse, check if there's a full replace
      const fullReplace = operations.find(op => op.type === 'replace_file');
      if (fullReplace && fullReplace.type === 'replace_file') {
        return fullReplace.code;
      }
      throw new Error('AST Parse Failed and no full replace fallback provided.');
    }

    // Apply operations
    for (const op of operations) {
      try {
        switch (op.type) {
          case 'replace_function':
            this.replaceFunctionJS(ast, op.name, op.newCode);
            break;
          case 'add_import':
            this.addImportJS(ast, op.code);
            break;
          case 'replace_file':
            // If mixed with others, this overrides everything
            return op.code;
        }
      } catch (err) {
        console.error(`Failed to apply JS patch ${op.type}:`, err);
        throw err;
      }
    }

    return recast.print(ast).code;
  }

  private replaceFunctionJS(ast: any, functionName: string, newCode: string) {
    // Parse new code to get the node
    const newAst = recast.parse(newCode, {
      parser: {
        parse(code: string) {
          return parser.parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'estree'],
            tokens: true
          });
        }
      }
    });
    
    // Extract the function node from newAst
    let newNode: any = null;
    visit(newAst, {
      visitFunctionDeclaration(path) {
        newNode = path.node;
        return false; // Stop traversal
      },
      visitVariableDeclarator(path) {
         // Handle const foo = () => {}
         if (path.node.id.type === 'Identifier' && path.node.init && 
            (path.node.init.type === 'ArrowFunctionExpression' || path.node.init.type === 'FunctionExpression')) {
             newNode = path.parent.node; // The VariableDeclaration
             return false;
         }
         this.traverse(path);
      }
    });

    if (!newNode) {
        throw new Error(`Could not parse new function code for ${functionName}`);
    }

    let found = false;
    
    // Find and replace in original AST
    visit(ast, {
      visitFunctionDeclaration(path) {
        if (path.node.id?.name === functionName) {
          path.replace(newNode);
          found = true;
          return false;
        }
        this.traverse(path);
      },
      visitVariableDeclarator(path) {
         if (path.node.id.type === 'Identifier' && path.node.id.name === functionName) {
             // Replace the entire VariableDeclaration (const x = ...)
             path.parent.replace(newNode);
             found = true;
             return false;
         }
         this.traverse(path);
      }
    });

    if (!found) {
      throw new Error(`Function ${functionName} not found in source.`);
    }
  }

  private addImportJS(ast: any, importCode: string) {
    const newAst = recast.parse(importCode, {
        parser: {
            parse(code: string) {
                return parser.parse(code, {
                    sourceType: 'module',
                    plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'estree'],
                    tokens: true
                });
            }
        }
    });
    const newImport = newAst.program.body[0];

    // Prepend to body
    ast.program.body.unshift(newImport);
  }

  // ============================================
  // Python Support
  // ============================================

  private applyPythonPatches(sourceCode: string, operations: PatchOperation[]): string {
    // For MVP, use text-based approach for Python
    // Future: Use python-ast-parser or similar
    
    let result = sourceCode;
    
    for (const op of operations) {
      try {
        switch (op.type) {
          case 'replace_function':
            result = this.replaceFunctionPython(result, op.name, op.newCode);
            break;
          case 'add_import':
            result = this.addImportPython(result, op.code);
            break;
          case 'replace_file':
            return op.code;
        }
      } catch (err) {
        console.error(`Failed to apply Python patch ${op.type}:`, err);
        throw err;
      }
    }
    
    return result;
  }

  private replaceFunctionPython(sourceCode: string, functionName: string, newCode: string): string {
    // Match Python function definition: "def functionName(...):
    // This is a simplified regex-based approach
    
    // Pattern: def functionName(...):\n    body (with proper indentation)
    const functionRegex = new RegExp(
      `^([ \\t]*)def ${functionName}\\([^)]*\\):.*?(?=^\\1(?:def |class |$)|\\Z)`,
      'gms'
    );
    
    const match = sourceCode.match(functionRegex);
    
    if (!match) {
      throw new Error(`Function ${functionName} not found in Python source.`);
    }
    
    // Extract indentation from original
    const indentation = match[1];
    
    // Apply same indentation to new code
    const indentedNewCode = newCode.split('\n')
      .map(line => line ? indentation + line : line)
      .join('\n');
    
    // Replace
    return sourceCode.replace(functionRegex, indentedNewCode);
  }

  private addImportPython(sourceCode: string, importCode: string): string {
    // Add import at the top, after any existing imports
    const lines = sourceCode.split('\n');
    
    // Find the last import line
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') || line.startsWith('from ')) {
        lastImportIndex = i;
      } else if (line && !line.startsWith('#') && lastImportIndex !== -1) {
        // Found non-import, non-comment line after imports
        break;
      }
    }
    
    // Insert after last import, or at the top if no imports
    const insertIndex = lastImportIndex === -1 ? 0 : lastImportIndex + 1;
    lines.splice(insertIndex, 0, importCode);
    
    return lines.join('\n');
  }

  // ============================================
  // Bash Support
  // ============================================

  private applyBashPatches(sourceCode: string, operations: PatchOperation[]): string {
    let result = sourceCode;
    
    for (const op of operations) {
      try {
        switch (op.type) {
          case 'replace_function':
            result = this.replaceFunctionBash(result, op.name, op.newCode);
            break;
          case 'add_import':
            // Bash doesn't have imports, but we can add source statements
            result = this.addSourceBash(result, op.code);
            break;
          case 'replace_file':
            return op.code;
        }
      } catch (err) {
        console.error(`Failed to apply Bash patch ${op.type}:`, err);
        throw err;
      }
    }
    
    return result;
  }

  private replaceFunctionBash(sourceCode: string, functionName: string, newCode: string): string {
    // Match Bash function: functionName() { ... }
    // Two patterns: function name() {} or name() {}
    
    const patterns = [
      new RegExp(`^function ${functionName}\\s*\\(\\)\\s*\\{[^}]*\\}`, 'gm'),
      new RegExp(`^${functionName}\\s*\\(\\)\\s*\\{[^}]*\\}`, 'gm')
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(sourceCode)) {
        return sourceCode.replace(pattern, newCode);
      }
    }
    
    throw new Error(`Function ${functionName} not found in Bash source.`);
  }

  private addSourceBash(sourceCode: string, sourceStatement: string): string {
    // Add source/import at the top
    const lines = sourceCode.split('\n');
    
    // Skip shebang if present
    let insertIndex = 0;
    if (lines[0]?.startsWith('#!')) {
      insertIndex = 1;
    }
    
    lines.splice(insertIndex, 0, sourceStatement);
    return lines.join('\n');
  }

  // ============================================
  // Text-based Fallback
  // ============================================

  private applyTextPatches(sourceCode: string, operations: PatchOperation[]): string {
    // For unsupported languages, only support replace_file
    const fullReplace = operations.find(op => op.type === 'replace_file');
    if (fullReplace && fullReplace.type === 'replace_file') {
      return fullReplace.code;
    }
    
    console.warn('Text-based patching only supports replace_file operations');
    return sourceCode;
  }
}

export const patchEngine = new PatchEngine();
