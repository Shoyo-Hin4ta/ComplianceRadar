import FirecrawlApp from "@mendable/firecrawl-js";
import pLimit from 'p-limit';
import Bottleneck from 'bottleneck';
import { ExtractedContent } from "../types/compliance.types";
import {
  ComplianceRequirementSchema,
  GovernmentPageExtractionSchema,
  BusinessLicenseSchema,
  TaxRequirementSchema,
  selectExtractionSchema,
  BatchExtractionResultSchema
} from "../schemas/extraction.schemas";

export class FirecrawlService {
  private app: FirecrawlApp;
  private limiter: Bottleneck;
  private concurrencyLimit: any;

  constructor() {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY is required");
    }
    
    this.app = new FirecrawlApp({ apiKey });
    
    // Hobby plan limits: 100 requests/min, 5 concurrent
    const rateLimit = parseInt(process.env.FIRECRAWL_RATE_LIMIT || "100");
    const concurrentLimit = parseInt(process.env.FIRECRAWL_CONCURRENT_LIMIT || "5");
    
    // Bottleneck for rate limiting (100 req/min = 1 request every 600ms)
    this.limiter = new Bottleneck({
      minTime: Math.ceil(60000 / rateLimit), // milliseconds between requests
      maxConcurrent: concurrentLimit,
      reservoir: rateLimit, // initial available requests
      reservoirRefreshAmount: rateLimit,
      reservoirRefreshInterval: 60 * 1000, // refill every minute
    });
    
    // p-limit for simpler concurrency control
    this.concurrencyLimit = pLimit(concurrentLimit);
    
    console.log(`Firecrawl configured: ${rateLimit} req/min, ${concurrentLimit} concurrent`);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T | null> {
    let lastError: any;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error
        if (error?.statusCode === 429 || error?.message?.includes('429')) {
          const delay = initialDelay * Math.pow(2, i); // Exponential backoff
          console.log(`Rate limited. Retrying in ${delay}ms (attempt ${i + 1}/${maxRetries})`);
          await this.sleep(delay);
        } else {
          // Non-rate-limit error, don't retry
          throw error;
        }
      }
    }
    
    console.error('Max retries exceeded:', lastError);
    return null;
  }

  async extractContent(url: string, eventEmitter?: (event: any) => void): Promise<ExtractedContent | null> {
    return this.limiter.schedule(async () => {
      return this.retryWithBackoff(async () => {
        try {
          // Detect URL type
          const isPDF = url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?');
          const isGovSite = url.includes('.gov');
          
          // Emit PDF detection event
          if (isPDF && eventEmitter) {
            eventEmitter({
              type: "pdf-detected",
              url,
              message: "📄 PDF found, reading it for you (this may take 30-60 seconds)..."
            });
          }
          
          console.log(`Extracting content from: ${url} (PDF: ${isPDF}, Gov: ${isGovSite})`);
          
          // Use correct Firecrawl v1 API structure
          // According to the playground and docs, v1 accepts a simpler format
          const params: any = {
            formats: ["markdown"],
          };
          
          // Add wait time for gov sites to let JavaScript load
          if (isGovSite) {
            params.waitFor = 3000;
          }
          
          const result = await this.app.scrapeUrl(url, params);

      if (!result || !result.success) {
        console.error(`Failed to extract content from ${url}`);
        return null;
      }

      // Handle the Firecrawl v1 response structure
      // The response is in result.data directly
      const markdown = result.markdown || result.data?.markdown || "";
      const extracted = result.extract || result.data?.extract || null;
      const metadata = result.metadata || result.data?.metadata || {};

      // Try to get content from either markdown or extract
      let content = markdown;
      
      // If markdown is too short but we have extracted content, use that
      if ((!markdown || markdown.length < 100) && extracted) {
        // Convert extracted data to string if it's an object
        if (typeof extracted === 'object') {
          content = JSON.stringify(extracted, null, 2);
        } else {
          content = String(extracted);
        }
        console.log(`Using extracted content instead of markdown for ${url}`);
      }

      // If still no content, log warning but don't fail immediately
      if (!content || content.length < 50) {
        console.warn(`Content extraction yielded minimal results from ${url}, attempting fallback...`);
        // Try one more time with simpler options
        try {
          const fallbackResult = await this.app.scrapeUrl(url, {
            formats: ["markdown"]
          });
          if (fallbackResult?.markdown || fallbackResult?.data?.markdown) {
            content = fallbackResult.markdown || fallbackResult.data.markdown;
          }
        } catch (fallbackError) {
          console.error(`Fallback extraction also failed for ${url}`);
        }
      }

      // Final check
      if (!content || content.length < 50) {
        console.error(`Unable to extract meaningful content from ${url}`);
        return null;
      }

          return {
            url,
            content: this.cleanMarkdown(content),
            metadata: {
              title: metadata.title || "",
              description: metadata.description || "",
              sourceUrl: metadata.sourceUrl || url,
              pageStatusCode: metadata.pageStatusCode || 200,
              extractedAt: new Date().toISOString(),
              isPDF,
              isGovSite,
              extractMethod: extracted ? 'llm-extract' : 'markdown'
            }
          };
        } catch (error) {
          console.error(`Error extracting content from ${url}:`, error);
          throw error; // Throw to trigger retry
        }
      });
    });
  }

  async batchExtract(urls: string[], eventEmitter?: (event: any) => void): Promise<ExtractedContent[]> {
    const results: ExtractedContent[] = [];
    const chunkSize = 5; // Process in chunks of 5 (Hobby plan concurrent limit)
    
    console.log(`Batch extracting ${urls.length} URLs in chunks of ${chunkSize}`);
    
    // Process URLs in chunks to avoid overwhelming the API
    for (let i = 0; i < urls.length; i += chunkSize) {
      const chunk = urls.slice(i, i + chunkSize);
      console.log(`Processing chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(urls.length/chunkSize)}`);
      
      const chunkPromises = chunk.map(url => 
        this.extractContent(url, eventEmitter)
          .then(content => {
            if (content) {
              results.push(content);
              console.log(`✓ Extracted: ${url}`);
            }
          })
          .catch(err => {
            console.error(`✗ Failed to extract ${url}:`, err.message);
          })
      );
      
      await Promise.all(chunkPromises);
      
      // Small delay between chunks to be respectful
      if (i + chunkSize < urls.length) {
        await this.sleep(1000);
      }
    }
    
    console.log(`Successfully extracted ${results.length} out of ${urls.length} URLs`);
    return results;
  }

  private cleanMarkdown(markdown: string): string {
    let cleaned = markdown
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s*[\r\n]/gm, "")
      .trim();
    
    cleaned = cleaned.replace(/^#+\s*Navigation.*$/gmi, "");
    cleaned = cleaned.replace(/^#+\s*Menu.*$/gmi, "");
    cleaned = cleaned.replace(/^#+\s*Footer.*$/gmi, "");
    cleaned = cleaned.replace(/\[Skip to.*?\]/gi, "");
    
    cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, "");
    
    cleaned = cleaned.replace(/\s+/g, " ");
    
    if (cleaned.length > 50000) {
      cleaned = cleaned.substring(0, 50000) + "\n\n[Content truncated...]";
    }
    
    return cleaned;
  }

  async extractWithStructure(url: string, structure?: any, intent?: string, eventEmitter?: (event: any) => void): Promise<any> {
    return this.limiter.schedule(async () => {
      return this.retryWithBackoff(async () => {
        try {
          // Detect URL type
          const isPDF = url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?');
          const isGovSite = url.includes('.gov');
          
          // Emit PDF detection event
          if (isPDF && eventEmitter) {
            eventEmitter({
              type: "pdf-detected",
              url,
              message: "📄 PDF found, extracting structured data (this may take 30-60 seconds)..."
            });
          }
          
          console.log(`Extracting structured data from: ${url} (PDF: ${isPDF}, Gov: ${isGovSite})`);
          
          // Select appropriate schema based on URL and intent
          const schema = structure || selectExtractionSchema(url, intent);
          
          // For structured extraction with v1 API
          const params: any = {
            formats: ["markdown"]
          };
          
          if (isGovSite) {
            params.waitFor = 3000;
          }
          
          // Add extraction if schema provided
          if (structure) {
            params.formats.push("extract");
            params.extract = {
              schema: schema,
              prompt: this.generateExtractionPrompt(url, intent)
            };
          }
          
          const result = await this.app.scrapeUrl(url, params);

      if (!result || !result.success) {
        console.error(`Failed to extract structured data from ${url}`);
        return null;
      }

          return {
            url,
            markdown: this.cleanMarkdown(result.markdown || result.data?.markdown || ""),
            structured: result.llmExtraction || result.extract || result.data?.extract || {},
            metadata: {
              ...(result.metadata || result.data?.metadata || {}),
              isPDF,
              isGovSite
            },
            schemaUsed: schema === TaxRequirementSchema ? "tax" : 
                        schema === BusinessLicenseSchema ? "license" : "compliance"
          };
        } catch (error) {
          console.error(`Error extracting structured data from ${url}:`, error);
          throw error; // Throw to trigger retry
        }
      });
    });
  }

  private generateExtractionPrompt(url: string, intent?: string): string {
    const basePrompt = "Extract all compliance requirements, forms, deadlines, penalties, and contact information from this government page.";
    
    if (intent) {
      return `${basePrompt} Focus particularly on requirements related to: ${intent}.`;
    }
    
    if (url.includes("irs.gov")) {
      return `${basePrompt} Pay special attention to tax forms, filing deadlines, payment schedules, and penalties.`;
    }
    
    if (url.includes("dol.gov") || url.includes("osha.gov")) {
      return `${basePrompt} Focus on workplace safety requirements, employee rights, and labor law compliance.`;
    }
    
    return basePrompt;
  }

  async batchScrapeUrls(urls: string[], options?: { intent?: string, schema?: any }): Promise<any[]> {
    try {
      console.log(`Batch scraping ${urls.length} URLs with Firecrawl batch API`);
      
      // Prepare extraction schema
      const schema = options?.schema || GovernmentPageExtractionSchema;
      
      // Use Firecrawl's batch scrape with v1 API
      const params: any = {
        formats: ["markdown"]
      };
      
      if (options?.schema) {
        params.formats.push("extract");
        params.extract = {
          schema: schema,
          prompt: `Extract all compliance requirements, deadlines, forms, and penalties. ${options?.intent ? `Focus on: ${options.intent}` : ''}`
        };
      }
      
      const response = await this.app.batchScrapeUrls(urls, params);

      if (!response || !response.data) {
        console.error('Batch scrape failed');
        return [];
      }

      // Process and return results
      const results = response.data.map((item: any, index: number) => ({
        url: urls[index],
        extractedAt: new Date().toISOString(),
        data: item.extract || {},
        markdown: item.markdown || "",
        metadata: item.metadata || {},
        success: item.success || false,
        error: item.error || null
      }));

      console.log(`Successfully batch scraped ${results.filter(r => r.success).length} out of ${urls.length} URLs`);
      return results;
    } catch (error) {
      console.error('Error in batch scraping:', error);
      // Fallback to individual scraping if batch fails
      return this.batchExtract(urls);
    }
  }

  async searchAndExtract(query: string, options?: { limit?: number }): Promise<any[]> {
    try {
      console.log(`Searching and extracting for query: ${query}`);
      
      // Use Firecrawl's search functionality (if available)
      const searchResults = await this.app.search(query, {
        limit: options?.limit || 5,
        searchOptions: {
          domains: [".gov"] // Focus on government domains
        }
      });

      if (!searchResults || searchResults.length === 0) {
        console.log('No search results found');
        return [];
      }

      // Extract URLs from search results
      const urls = searchResults.map((result: any) => result.url);
      
      // Batch extract structured data from found URLs
      return this.batchScrapeUrls(urls, { intent: query });
    } catch (error) {
      console.error('Error in search and extract:', error);
      return [];
    }
  }
}