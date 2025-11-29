// @ts-nocheck
import { sandbox } from './sandbox';

export class DependencyRepairService {
  
  /**
   * Detect missing package name from error logs.
   * Supports standard Node.js "Cannot find module" and Webpack/Next.js "Module not found".
   */
  detectMissingPackage(logs: string): string | null {
    // Node.js: Error: Cannot find module 'foo'
    const nodeMatch = logs.match(/Error: Cannot find module '(@?[a-z0-9-_\/]+)'/i);
    if (nodeMatch) return nodeMatch[1];

    // Webpack/Next.js: Module not found: Error: Can't resolve 'foo'
    const webpackMatch = logs.match(/Module not found: Error: Can't resolve '(@?[a-z0-9-_\/]+)'/i);
    if (webpackMatch) return webpackMatch[1];

    // TypeScript: Cannot find module 'foo' or its corresponding type declarations.
    const tsMatch = logs.match(/Cannot find module '(@?[a-z0-9-_\/]+)' or its corresponding type declarations/i);
    if (tsMatch) return tsMatch[1];

    return null;
  }

  /**
   * Attempt to fix the missing dependency by installing it in the sandbox.
   */
  async fixDependency(projectId: string, packageName: string): Promise<{ success: boolean; logs: string }> {
    console.log(`[DependencyRepair] 🛠️ Attempting to install missing package: ${packageName}`);
    
    try {
      // We use the sandbox to run npm install.
      // We assume the sandbox session might already exist or we create a new one.
      // For simplicity, we'll just use sandbox.exec which handles session creation if we pass projectId as session ID?
      // Wait, sandbox.exec takes a sessionId. We need to find or create one.
      
      // We'll use the projectId as the sessionId for simplicity in this context, 
      // or we should really be passing the active sessionId from the agent.
      // But since this is a service, maybe we should accept sessionId?
      // For now, let's assume projectId maps to a session.
      
      // We'll use the projectId to find or create the session.
      const containerId = await sandbox.getOrCreateSession(projectId);

      const cmd = `npm install ${packageName}`;
      console.log(`[DependencyRepair] Running: ${cmd}`);
      
      const result = await sandbox.exec(containerId, cmd, 120000); // 120s timeout for install
      
      if (result.exitCode === 0) {
        console.log(`[DependencyRepair] ✅ Successfully installed ${packageName}`);
        return { success: true, logs: result.output };
      } else {
        console.error(`[DependencyRepair] ❌ Failed to install ${packageName}`);
        console.error(`[DependencyRepair] Logs:`, result.output);
        return { success: false, logs: result.output };
      }
    } catch (error: any) {
      console.error(`[DependencyRepair] Error installing package:`, error);
      return { success: false, logs: error.message };
    }
  }
}

export const dependencyRepair = new DependencyRepairService();
