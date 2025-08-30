import FirecrawlApp from "@mendable/firecrawl-js";
import Bottleneck from 'bottleneck';
import { v4 as uuidv4 } from 'uuid';

interface ComplianceRequirement {
  name: string;
  description: string;
  agency: string;
  formNumber?: string;
  deadline?: string;
  frequency?: string;
  penalty?: string;
  appliesWhen?: string;
  sourceUrl?: string;
}

interface BatchScrapeResult {
  url: string;
  success: boolean;
  requirements: ComplianceRequirement[];
  markdown?: string;
  metadata?: any;
  error?: string;
  extractedAt: string;
}

export class FirecrawlBatchService {
  private app: FirecrawlApp;
  private limiter: Bottleneck;
  private webhookUrl?: string;
  private currentJobId?: string;

  constructor() {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY is required");
    }
    
    this.app = new FirecrawlApp({ apiKey });
    
    // Rate limiting for hobby plan: 100 req/min
    this.limiter = new Bottleneck({
      minTime: 600, // 100 requests per minute = 600ms between requests
      maxConcurrent: 5, // Hobby plan limit
      reservoir: 100,
      reservoirRefreshAmount: 100,
      reservoirRefreshInterval: 60 * 1000
    });

    // Set webhook URL if configured
    this.webhookUrl = process.env.FIRECRAWL_WEBHOOK_URL;
    
    console.log('FirecrawlBatchService initialized with rate limiting');
  }

  /**
   * Create extraction schema for compliance requirements
   */
  private getComplianceExtractionSchema() {
    return {
      type: "object",
      properties: {
        requirements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { 
                type: "string",
                description: "Name of the requirement or form"
              },
              description: { 
                type: "string",
                description: "What needs to be done"
              },
              agency: { 
                type: "string",
                description: "Government agency (IRS, DOL, etc.)"
              },
              formNumber: { 
                type: "string",
                description: "Form number if applicable (e.g., Form 941)"
              },
              deadline: { 
                type: "string",
                description: "Filing deadline or due date"
              },
              frequency: { 
                type: "string",
                description: "How often (annual, quarterly, etc.)"
              },
              penalty: { 
                type: "string",
                description: "Penalty for non-compliance"
              },
              appliesWhen: { 
                type: "string",
                description: "Conditions when this applies"
              }
            },
            required: ["name", "description", "agency"]
          }
        }
      },
      required: ["requirements"]
    };
  }

  /**
   * Create extraction prompt based on URL
   */
  private getExtractionPrompt(url: string): string {
    const basePrompt = `Extract ALL compliance requirements, regulations, forms, deadlines, and penalties from this page. 
Include:
- Tax requirements and forms
- Labor law requirements
- Safety regulations
- Licensing requirements
- Filing deadlines
- Penalties for non-compliance
- Conditions when requirements apply (employee thresholds, revenue, etc.)

Be thorough and extract every requirement mentioned on the page.`;

    if (url.includes('irs.gov')) {
      return basePrompt + '\nFocus on tax forms, payment deadlines, and tax penalties.';
    }
    if (url.includes('dol.gov')) {
      return basePrompt + '\nFocus on labor laws, employee rights, and workplace requirements.';
    }
    if (url.includes('osha.gov')) {
      return basePrompt + '\nFocus on safety requirements, training, and compliance standards.';
    }
    
    return basePrompt;
  }

  /**
   * Batch scrape URLs with structured extraction
   */
  async batchScrapeWithExtraction(
    urls: string[],
    eventEmitter?: (event: any) => void
  ): Promise<BatchScrapeResult[]> {
    this.currentJobId = uuidv4();
    
    if (eventEmitter) {
      eventEmitter({
        type: 'batch-started',
        jobId: this.currentJobId,
        urls: urls,
        count: urls.length,
        message: `Starting to scrape ${urls.length} compliance sources...`,
        progress: 25
      });
    }

    const results: BatchScrapeResult[] = [];
    const startTime = Date.now();

    // Process URLs in chunks to respect rate limits
    const chunkSize = 5; // Process 5 at a time
    
    for (let i = 0; i < urls.length; i += chunkSize) {
      const chunk = urls.slice(i, i + chunkSize);
      const chunkResults = await Promise.allSettled(
        chunk.map((url, index) => 
          this.scrapeUrlWithRetry(
            url, 
            i + index, 
            urls.length,
            eventEmitter
          )
        )
      );

      // Process chunk results
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        } else {
          const url = chunk[index];
          results.push({
            url,
            success: false,
            requirements: [],
            error: result.status === 'rejected' ? result.reason?.message : 'Unknown error',
            extractedAt: new Date().toISOString()
          });
          
          if (eventEmitter) {
            eventEmitter({
              type: 'site-failed',
              url: url,
              error: result.status === 'rejected' ? result.reason?.message : 'Unknown error'
            });
          }
        }
      });

      // Small delay between chunks
      if (i + chunkSize < urls.length) {
        await this.sleep(1000);
      }
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    if (eventEmitter) {
      const successCount = results.filter(r => r.success).length;
      const totalRequirements = results.reduce((sum, r) => sum + r.requirements.length, 0);
      
      eventEmitter({
        type: 'batch-complete',
        jobId: this.currentJobId,
        duration: duration,
        urlsProcessed: urls.length,
        successful: successCount,
        failed: urls.length - successCount,
        totalRequirements: totalRequirements,
        message: `Extracted ${totalRequirements} requirements from ${successCount} sources`,
        progress: 85
      });
    }

    return results;
  }

  /**
   * Scrape a single URL with retry logic
   */
  private async scrapeUrlWithRetry(
    url: string,
    index: number,
    total: number,
    eventEmitter?: (event: any) => void
  ): Promise<BatchScrapeResult | null> {
    return this.limiter.schedule(async () => {
      const progress = 25 + Math.floor((60 * (index + 1)) / total);
      
      if (eventEmitter) {
        eventEmitter({
          type: 'scraping-site',
          url: url,
          index: index + 1,
          total: total,
          message: `Scraping ${this.getDomainName(url)}...`,
          progress: progress
        });
      }

      try {
        // Detect if it's a government site that might need special handling
        const isGovSite = url.includes('.gov') || url.includes('.state.');
        
        // Prepare Firecrawl SDK v3 parameters with json format for structured data
        const params: any = {
          formats: [
            'markdown',
            {
              type: 'json',
              schema: this.getComplianceExtractionSchema(),
              prompt: this.getExtractionPrompt(url)
            }
          ],
          onlyMainContent: true,
          timeout: 30000,
          waitFor: isGovSite ? 3000 : 1000 // Wait for JS to load on gov sites
        };

        // Add webhook if configured
        if (this.webhookUrl) {
          params.webhook = {
            url: this.webhookUrl,
            events: ['page'],
            metadata: {
              jobId: this.currentJobId,
              urlIndex: index,
              originalUrl: url
            }
          };
        }

        console.log(`Scraping ${url} (${isGovSite ? 'government site' : 'standard site'})...`);
        
        // Execute scrape with Firecrawl v3 SDK
        const result = await this.app.scrape(url, params);

        if (!result) {
          throw new Error('Scrape failed - no response');
        }

        // Extract requirements from the structured data
        const requirements = this.extractRequirements(result);
        
        if (eventEmitter) {
          eventEmitter({
            type: 'site-complete',
            url: url,
            rulesFound: requirements.length,
            index: index + 1,
            total: total,
            message: `Found ${requirements.length} requirements from ${this.getDomainName(url)}`,
            progress: progress + 2
          });
        }

        return {
          url,
          success: true,
          requirements,
          markdown: result.markdown || '',
          metadata: result.metadata || {},
          extractedAt: new Date().toISOString()
        };

      } catch (error: any) {
        console.error(`Failed to scrape ${url}:`, error.message);
        
        // Check if it's a rate limit error
        if (error.statusCode === 429 || error.message?.includes('429')) {
          console.log('Rate limited, waiting before retry...');
          await this.sleep(5000);
          
          // Try once more with simpler parameters
          try {
            const retryResult = await this.app.scrape(url, {
              formats: ['markdown'],
              onlyMainContent: true,
              timeout: 30000,
              waitFor: 2000
            });
            
            if (retryResult) {
              // Try to extract requirements from markdown if possible
              const fallbackRequirements = this.extractRequirementsFromMarkdown(
                retryResult.markdown || '',
                url
              );
              
              return {
                url,
                success: true,
                requirements: fallbackRequirements,
                markdown: retryResult.markdown || '',
                metadata: retryResult.metadata || {},
                extractedAt: new Date().toISOString()
              };
            }
          } catch (retryError) {
            console.error(`Retry also failed for ${url}:`, retryError);
          }
        }
        
        return null;
      }
    });
  }

  /**
   * Extract requirements from Firecrawl response
   */
  private extractRequirements(result: any): ComplianceRequirement[] {
    const requirements: ComplianceRequirement[] = [];

    // SDK returns data directly (as per docs: "SDKs will return the data object directly")
    // So we access result.json directly, not result.data.json
    if (result.json?.requirements) {
      requirements.push(...result.json.requirements);
    }

    // Ensure all requirements have the sourceUrl
    const sourceUrl = result.metadata?.sourceURL || '';
    requirements.forEach(req => {
      if (!req.sourceUrl) {
        req.sourceUrl = sourceUrl;
      }
    });

    return requirements;
  }

  /**
   * Extract requirements from markdown content as fallback
   */
  private extractRequirementsFromMarkdown(markdown: string, url: string): ComplianceRequirement[] {
    const requirements: ComplianceRequirement[] = [];
    
    if (!markdown) return requirements;

    // Extract agency from URL
    const agency = this.extractAgency(url);
    
    // Common patterns for requirements in government pages
    const patterns = [
      /Form\s+(\d+[A-Z]?-?[A-Z]?\d*)/gi,  // Form numbers
      /must\s+file\s+([^.]+)/gi,           // Filing requirements
      /required\s+to\s+([^.]+)/gi,         // Required actions
      /deadline[:\s]+([^.]+)/gi,           // Deadlines
      /penalty[:\s]+([^.]+)/gi,            // Penalties
    ];

    // Look for form numbers
    const formMatches = markdown.matchAll(/Form\s+(\d+[A-Z]?-?[A-Z]?\d*)/gi);
    for (const match of formMatches) {
      const formNumber = match[1];
      const context = this.extractContext(markdown, match.index || 0, 200);
      
      requirements.push({
        name: `Form ${formNumber}`,
        description: context,
        agency: agency,
        formNumber: formNumber,
        sourceUrl: url
      });
    }

    // Look for "must" requirements
    const mustMatches = markdown.matchAll(/must\s+(file|submit|register|obtain|maintain|comply)([^.]+)/gi);
    for (const match of mustMatches) {
      const action = match[1];
      const description = match[2].trim();
      
      if (description.length > 10 && description.length < 500) {
        requirements.push({
          name: `${action.charAt(0).toUpperCase() + action.slice(1)} requirement`,
          description: description,
          agency: agency,
          sourceUrl: url
        });
      }
    }

    // Deduplicate based on description similarity
    const uniqueRequirements = this.deduplicateByDescription(requirements);
    
    return uniqueRequirements;
  }

  /**
   * Extract context around a position in text
   */
  private extractContext(text: string, position: number, length: number): string {
    const start = Math.max(0, position - length / 2);
    const end = Math.min(text.length, position + length / 2);
    let context = text.substring(start, end).trim();
    
    // Clean up the context
    context = context.replace(/\s+/g, ' ');
    
    // Add ellipsis if truncated
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    return context;
  }

  /**
   * Deduplicate requirements based on description similarity
   */
  private deduplicateByDescription(requirements: ComplianceRequirement[]): ComplianceRequirement[] {
    const unique: ComplianceRequirement[] = [];
    const seen = new Set<string>();
    
    for (const req of requirements) {
      const key = req.description.toLowerCase().substring(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(req);
      }
    }
    
    return unique;
  }

  /**
   * Extract agency from URL
   */
  private extractAgency(url: string): string {
    if (url.includes('irs.gov')) return 'IRS';
    if (url.includes('dol.gov')) return 'DOL';
    if (url.includes('osha.gov')) return 'OSHA';
    if (url.includes('epa.gov')) return 'EPA';
    if (url.includes('fda.gov')) return 'FDA';
    if (url.includes('sba.gov')) return 'SBA';
    if (url.includes('.state.')) return 'State Agency';
    if (url.includes('.city.') || url.includes('.local.')) return 'Local Agency';
    return 'Government Agency';
  }

  /**
   * Get domain name from URL for display
   */
  private getDomainName(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Process webhook callback from Firecrawl
   */
  processWebhookCallback(payload: any, eventEmitter?: (event: any) => void) {
    const { type, id, data, metadata } = payload;
    
    if (type === 'batch_scrape.page' && data) {
      const requirements = this.extractRequirements({ data });
      
      if (eventEmitter) {
        eventEmitter({
          type: 'webhook-page-complete',
          url: metadata?.originalUrl || data.metadata?.sourceURL,
          rulesFound: requirements.length,
          jobId: metadata?.jobId
        });
      }
      
      return requirements;
    }
    
    return [];
  }
}