import { Router, Request, Response } from 'express';
import { FirecrawlBatchService } from '../services/firecrawl-batch.service';
import { WebSocketService } from '../services/websocket.service';

const router = Router();
const firecrawlBatchService = new FirecrawlBatchService();
let websocketService: WebSocketService | null = null;

// Store active job sessions
const activeJobs = new Map<string, {
  checkId: string;
  startTime: number;
  urls: string[];
  completed: number;
  requirements: any[];
}>();

/**
 * Set WebSocket service for real-time updates
 */
export function setWebSocketService(service: WebSocketService) {
  websocketService = service;
}

/**
 * Register a new job for tracking
 */
export function registerJob(jobId: string, checkId: string, urls: string[]) {
  activeJobs.set(jobId, {
    checkId,
    startTime: Date.now(),
    urls,
    completed: 0,
    requirements: []
  });
}

/**
 * Firecrawl webhook endpoint
 */
router.post('/webhook/firecrawl', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    console.log('Received Firecrawl webhook:', {
      type: payload.type,
      id: payload.id,
      metadata: payload.metadata
    });

    // Extract job info from metadata
    const jobId = payload.metadata?.jobId;
    const job = jobId ? activeJobs.get(jobId) : null;

    // Process different webhook event types
    switch (payload.type) {
      case 'batch_scrape.started':
        if (websocketService && job) {
          websocketService.emitToCheck(job.checkId, {
            type: 'batch-scrape-started',
            message: 'Batch scraping initiated',
            totalUrls: payload.total || job.urls.length
          });
        }
        break;

      case 'batch_scrape.page':
        if (payload.data) {
          // Process the scraped page
          const requirements = firecrawlBatchService.processWebhookCallback(
            payload,
            (event) => {
              if (websocketService && job) {
                websocketService.emitToCheck(job.checkId, event);
              }
            }
          );

          // Update job progress
          if (job) {
            job.completed++;
            job.requirements.push(...requirements);
            
            const progress = 25 + Math.floor((60 * job.completed) / job.urls.length);
            
            if (websocketService) {
              websocketService.emitToCheck(job.checkId, {
                type: 'site-scraped-webhook',
                url: payload.data.metadata?.sourceURL || payload.metadata?.originalUrl,
                index: job.completed,
                total: job.urls.length,
                rulesFound: requirements.length,
                progress: progress,
                message: `Processed ${job.completed}/${job.urls.length} sources`
              });
            }
          }
        }
        break;

      case 'batch_scrape.completed':
        if (job) {
          const duration = Math.round((Date.now() - job.startTime) / 1000);
          
          if (websocketService) {
            websocketService.emitToCheck(job.checkId, {
              type: 'batch-scrape-completed-webhook',
              totalUrls: job.urls.length,
              completed: job.completed,
              totalRequirements: job.requirements.length,
              duration: duration,
              message: `Batch scraping completed: ${job.requirements.length} requirements found`
            });
          }
          
          // Clean up job
          activeJobs.delete(jobId);
        }
        break;

      case 'batch_scrape.failed':
        if (job && websocketService) {
          websocketService.emitToCheck(job.checkId, {
            type: 'batch-scrape-failed',
            error: payload.error || 'Batch scraping failed',
            completed: job.completed,
            total: job.urls.length
          });
          
          // Clean up job
          activeJobs.delete(jobId);
        }
        break;

      default:
        console.log('Unknown webhook event type:', payload.type);
    }

    // Always respond with 200 OK to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing Firecrawl webhook:', error);
    // Still return 200 to prevent retries
    res.status(200).json({ received: true, error: 'Processing error' });
  }
});

/**
 * Health check endpoint for webhook
 */
router.get('/webhook/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    activeJobs: activeJobs.size,
    timestamp: new Date().toISOString()
  });
});

/**
 * Debug endpoint to view active jobs
 */
router.get('/webhook/jobs', (req: Request, res: Response) => {
  const jobs = Array.from(activeJobs.entries()).map(([id, job]) => ({
    id,
    checkId: job.checkId,
    startTime: new Date(job.startTime).toISOString(),
    urlCount: job.urls.length,
    completed: job.completed,
    requirementsFound: job.requirements.length,
    duration: Math.round((Date.now() - job.startTime) / 1000) + 's'
  }));
  
  res.json({ jobs });
});

export default router;