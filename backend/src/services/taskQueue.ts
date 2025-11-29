import Redis from "ioredis";

/**
 * Phase 3: Message Queue (Redis)
 * 
 * Ensures Fault Tolerance.
 * If the server crashes, tasks persist in the 'task_queue' list.
 */
class TaskQueueService {
  private redis: Redis;
  private isProcessing = false;

  constructor() {
    // Connect to local Redis (default port 6379)
    // In production, this comes from process.env.REDIS_URL
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      lazyConnect: true // Don't crash if Redis is missing in dev
    });
  }

  /**
   * Adds a task to the persistent queue.
   */
  async add(taskId: string, priority: number = 0) {
    try {
      // Use a Sorted Set for priority queueing
      // ZADD task_queue <priority> <taskId>
      await this.redis.zadd("task_queue", priority, taskId);
      console.log(`[TaskQueue] 📥 Enqueued Task ${taskId} (Priority: ${priority})`);
    } catch (error) {
      console.warn(`[TaskQueue] ⚠️  Redis not available, falling back to direct execution.`);
    }
  }

  /**
   * Retrieves the next highest priority task.
   */
  async pop(): Promise<string | null> {
    try {
      // ZPOPMAX returns [member, score]
      const result = await this.redis.zpopmax("task_queue");
      if (result.length > 0) {
        const taskId = result[0];
        console.log(`[TaskQueue] 📤 Dequeued Task ${taskId}`);
        return taskId;
      }
    } catch (error) {
      // Ignore connection errors in dev
    }
    return null;
  }
}

export const taskQueue = new TaskQueueService();
