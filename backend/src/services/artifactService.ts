import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Configuration
const EXECUTION_MODE = process.env.EXECUTION_MODE || (process.env.NODE_ENV === 'production' ? 'CLOUD' : 'LOCAL');
const ARTIFACT_STORAGE_PATH = process.env.ARTIFACT_STORAGE_PATH || './artifacts';
const S3_BUCKET_NAME = process.env.ARTIFACT_BUCKET_NAME || 'tholai-artifacts';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// S3 Client (Lazy initialized or conditional)
const s3Client = EXECUTION_MODE === 'CLOUD' ? new S3Client({ region: AWS_REGION }) : null;

export class ArtifactService {
  constructor() {
    if (EXECUTION_MODE === 'LOCAL') {
      this.ensureStorageDir();
    }
  }

  private async ensureStorageDir() {
    try {
      await fs.mkdir(ARTIFACT_STORAGE_PATH, { recursive: true });
    } catch (err) {
      console.error('Failed to create artifact storage directory', err);
    }
  }

  async storeArtifact(content: string | Buffer, extension: string = 'json', metadata?: any): Promise<string> {
    const id = randomUUID();
    const filename = `${id}.${extension}`;

    console.log(`[ArtifactService] Storing ${filename} in ${EXECUTION_MODE} mode...`);

    if (EXECUTION_MODE === 'CLOUD' && s3Client) {
      return this.storeInS3(filename, content, metadata);
    } else {
      return this.storeLocally(filename, content, metadata);
    }
  }

  async getArtifact(ref: string): Promise<Buffer | null> {
    // ref format: artifact://uuid/filename OR s3://bucket/filename
    
    if (EXECUTION_MODE === 'CLOUD' && s3Client) {
       // Extract filename from ref (assuming simple filename storage for now)
       const filename = ref.split('/').pop(); 
       if (!filename) return null;
       return this.getFromS3(filename);
    } else {
       const match = ref.match(/artifact:\/\/([^\/]+)\/(.+)/);
       if (!match) return null;
       const filename = match[2];
       return this.getFromLocal(filename);
    }
  }

  // --- LOCAL STRATEGY ---
  private async storeLocally(filename: string, content: string | Buffer, metadata?: any): Promise<string> {
    const filePath = path.join(ARTIFACT_STORAGE_PATH, filename);
    await fs.writeFile(filePath, content);
    
    if (metadata) {
      await fs.writeFile(filePath + '.meta.json', JSON.stringify(metadata, null, 2));
    }
    return `artifact://${filename.split('.')[0]}/${filename}`;
  }

  private async getFromLocal(filename: string): Promise<Buffer | null> {
    const filePath = path.join(ARTIFACT_STORAGE_PATH, filename);
    try {
      return await fs.readFile(filePath);
    } catch (err) {
      return null;
    }
  }

  // --- S3 STRATEGY ---
  private async storeInS3(filename: string, content: string | Buffer, metadata?: any): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: filename,
        Body: content,
        Metadata: metadata ? { ...metadata } : undefined,
        ContentType: this.getContentType(filename)
      });

      await s3Client!.send(command);
      return `s3://${S3_BUCKET_NAME}/${filename}`;
    } catch (error) {
      console.error('[ArtifactService] S3 Upload Failed:', error);
      throw error;
    }
  }

  private async getFromS3(filename: string): Promise<Buffer | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: filename
      });

      const response = await s3Client!.send(command);
      if (!response.Body) return null;
      
      // Convert stream to buffer
      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (error) {
      console.error('[ArtifactService] S3 Download Failed:', error);
      return null;
    }
  }

  private getContentType(filename: string): string {
    if (filename.endsWith('.json')) return 'application/json';
    if (filename.endsWith('.txt')) return 'text/plain';
    if (filename.endsWith('.pdf')) return 'application/pdf';
    if (filename.endsWith('.png')) return 'image/png';
    return 'application/octet-stream';
  }
}

export const artifactService = new ArtifactService();
