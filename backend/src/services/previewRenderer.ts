// @ts-nocheck
import puppeteer from 'puppeteer';
import { artifactService } from './artifactService';

export class PreviewRenderer {
  async renderHtmlToImage(html: string, css: string = '', width: number = 1280, height: number = 800): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.setViewport({ width, height });

      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>${css}</style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;

      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
      
      const screenshotBuffer = await page.screenshot({ type: 'png' });
      
      // Store the screenshot as an artifact
      const artifactRef = await artifactService.storeArtifact(screenshotBuffer, 'png', {
        type: 'preview_render',
        timestamp: new Date().toISOString()
      });

      return artifactRef;
    } finally {
      await browser.close();
    }
  }
}

export const previewRenderer = new PreviewRenderer();
