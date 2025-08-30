import axios from "axios";
import pLimit from 'p-limit';
import Bottleneck from 'bottleneck';
import { SearchResult } from "../types/compliance.types";

interface PerplexityResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  citations?: string[];
  search_results?: Array<{
    url: string;
    title: string;
    snippet: string;
    date?: string;
    last_updated?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    search_context_size?: string;
  };
}

type SearchContextSize = 'low' | 'medium' | 'high';
type SonarModel = 'sonar' | 'sonar-pro' | 'sonar-reasoning' | 'sonar-reasoning-pro';

interface SearchOptions {
  model?: SonarModel;
  searchContextSize?: SearchContextSize;
  searchDomainFilter?: string[];
  searchRecencyFilter?: string;
  searchAfterDate?: string;
  searchBeforeDate?: string;
  temperature?: number;
  maxTokens?: number;
  topK?: number;
}

export class PerplexityService {
  private apiKey: string;
  private baseUrl = "https://api.perplexity.ai";
  private limiter: Bottleneck;
  private concurrencyLimit: any;

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("PERPLEXITY_API_KEY is required");
    }
    
    // Perplexity seems to have ~20-30 req/min limit based on errors
    const rateLimit = parseInt(process.env.PERPLEXITY_RATE_LIMIT || "30");
    const concurrentLimit = parseInt(process.env.PERPLEXITY_CONCURRENT_LIMIT || "5");
    
    // Bottleneck for rate limiting
    this.limiter = new Bottleneck({
      minTime: Math.ceil(60000 / rateLimit), // milliseconds between requests
      maxConcurrent: concurrentLimit,
      reservoir: rateLimit, // initial available requests
      reservoirRefreshAmount: rateLimit,
      reservoirRefreshInterval: 60 * 1000, // refill every minute
    });
    
    // p-limit for simpler concurrency control
    this.concurrencyLimit = pLimit(concurrentLimit);
    
    console.log(`Perplexity configured: ${rateLimit} req/min, ${concurrentLimit} concurrent`);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 2000
  ): Promise<T | null> {
    let lastError: any;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limit error
        if (error?.response?.status === 429 || error?.status === 429) {
          const delay = initialDelay * Math.pow(2, i); // Exponential backoff
          console.log(`Perplexity rate limited. Retrying in ${delay}ms (attempt ${i + 1}/${maxRetries})`);
          await this.sleep(delay);
        } else {
          // Non-rate-limit error, log but continue
          console.error('Perplexity API error:', error.message);
          return null;
        }
      }
    }
    
    console.error('Max retries exceeded for Perplexity:', lastError?.message);
    return null;
  }

  private determineSearchComplexity(intent: string): SearchContextSize {
    // Analyze intent complexity
    const complexKeywords = ['comprehensive', 'all', 'complete', 'detailed', 'every', 'full'];
    const simpleKeywords = ['basic', 'simple', 'quick', 'main', 'primary'];
    
    const lowerIntent = intent.toLowerCase();
    
    if (complexKeywords.some(keyword => lowerIntent.includes(keyword))) {
      return 'high';
    }
    
    if (simpleKeywords.some(keyword => lowerIntent.includes(keyword))) {
      return 'low';
    }
    
    // Check for multiple requirements in the intent
    const requirementCount = (intent.match(/and|plus|also|with|including/gi) || []).length;
    if (requirementCount >= 2) {
      return 'high';
    }
    
    return 'medium';
  }

  private selectOptimalModel(intent: string, complexity: SearchContextSize): SonarModel {
    // Select model based on query complexity and type
    const reasoningKeywords = ['why', 'how', 'explain', 'analyze', 'compare', 'evaluate'];
    const deepResearchKeywords = ['comprehensive analysis', 'deep dive', 'exhaustive', 'thorough research'];
    
    const lowerIntent = intent.toLowerCase();
    
    // Check if deep reasoning is needed
    if (deepResearchKeywords.some(keyword => lowerIntent.includes(keyword))) {
      return 'sonar-reasoning-pro';
    }
    
    // Check if reasoning is needed
    if (reasoningKeywords.some(keyword => lowerIntent.includes(keyword))) {
      return 'sonar-reasoning';
    }
    
    // Use Pro for complex searches
    if (complexity === 'high') {
      return 'sonar-pro';
    }
    
    // Default to base sonar for simple searches
    return 'sonar';
  }

  async searchWithSonar(intent: string, state: string, options?: SearchOptions): Promise<SearchResult[]> {
    return this.limiter.schedule(async () => {
      return this.retryWithBackoff(async () => {
        try {
          const domains = this.getDomainsForState(state);
      
      const searchPrompt = `Find official government sources and requirements for: ${intent}

Focus on:
1. Official .gov websites only
2. Current, active requirements (not historical)
3. Specific compliance requirements, forms, deadlines, and penalties
4. Citations to specific regulations (CFR, state codes, etc.)

Return the most relevant official government sources with their URLs.`;

      // Determine optimal settings
      const complexity = options?.searchContextSize || this.determineSearchComplexity(intent);
      const model = options?.model || this.selectOptimalModel(intent, complexity);
      
      console.log(`Using model: ${model} with search context: ${complexity}`);

      const response = await axios.post<PerplexityResponse>(
        `${this.baseUrl}/chat/completions`,
        {
          model: model,
          messages: [
            {
              role: "system",
              content: "You are a compliance research assistant specializing in US business regulations. Only return information from official government sources (.gov domains). Be precise about requirements, deadlines, and penalties."
            },
            {
              role: "user",
              content: searchPrompt
            }
          ],
          web_search_options: {
            search_context_size: complexity,
            search_domain_filter: options?.searchDomainFilter || domains,
            search_recency_filter: options?.searchRecencyFilter || "year",
            search_after_date: options?.searchAfterDate,
            search_before_date: options?.searchBeforeDate
          },
          temperature: options?.temperature || 0.1,
          max_tokens: options?.maxTokens || 2000,
          top_k: options?.topK || 5
        },
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );

      const results: SearchResult[] = [];
      
      if (response.data.citations) {
        response.data.citations.forEach((citation, index) => {
          if (this.isValidGovUrl(citation)) {
            results.push({
              url: citation,
              source: this.extractDomain(citation),
              intent: intent,
              title: `Source ${index + 1} for ${intent}`,
              snippet: ""
            });
          }
        });
      }

      if (response.data.search_results) {
        response.data.search_results.forEach(result => {
          if (this.isValidGovUrl(result.url) && !results.find(r => r.url === result.url)) {
            results.push({
              url: result.url,
              source: this.extractDomain(result.url),
              intent: intent,
              title: result.title,
              snippet: result.snippet
            });
          }
        });
      }

      const content = response.data.choices[0]?.message?.content || "";
      const urlMatches = content.match(/https?:\/\/[^\s\)]+\.gov[^\s\)]*/g);
      
      if (urlMatches) {
        urlMatches.forEach(url => {
          const cleanUrl = url.replace(/[,\.\]\)]+$/, "");
          if (this.isValidGovUrl(cleanUrl) && !results.find(r => r.url === cleanUrl)) {
            results.push({
              url: cleanUrl,
              source: this.extractDomain(cleanUrl),
              intent: intent,
              title: `Additional source for ${intent}`,
              snippet: ""
            });
          }
        });
      }

      // Log usage information
      if (response.data.usage) {
        console.log(`Token usage - Prompt: ${response.data.usage.prompt_tokens}, Completion: ${response.data.usage.completion_tokens}`);
        console.log(`Search context used: ${response.data.usage.search_context_size || complexity}`);
      }
      
          console.log(`Found ${results.length} sources for intent: ${intent}`);
          return results.slice(0, options?.topK || 5);

        } catch (error) {
          console.error("Error searching with Perplexity:", error);
          if (axios.isAxiosError(error)) {
            console.error("Response data:", error.response?.data);
          }
          throw error; // Throw to trigger retry
        }
      }) || [];
    });
  }

  async batchSearch(intents: string[], state: string, options?: SearchOptions): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    const chunkSize = 5; // Process in chunks to avoid overwhelming the API
    
    console.log(`Batch searching ${intents.length} intents in chunks of ${chunkSize}`);
    
    // Process intents in chunks to manage rate limits
    for (let i = 0; i < intents.length; i += chunkSize) {
      const chunk = intents.slice(i, i + chunkSize);
      console.log(`Processing intent chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(intents.length/chunkSize)}`);
      
      // Group by complexity within this chunk
      const intentsByComplexity = chunk.reduce((acc, intent) => {
        const complexity = this.determineSearchComplexity(intent);
        if (!acc[complexity]) acc[complexity] = [];
        acc[complexity].push(intent);
        return acc;
      }, {} as Record<SearchContextSize, string[]>);
      
      const searchPromises = Object.entries(intentsByComplexity).flatMap(([complexity, intentsGroup]) => 
        intentsGroup.map(intent => 
          this.searchWithSonar(intent, state, { 
            ...options, 
            searchContextSize: complexity as SearchContextSize 
          })
            .then(results => {
              console.log(`✓ Found ${results.length} sources for: ${intent.substring(0, 50)}...`);
              return results;
            })
            .catch(err => {
              console.error(`✗ Failed to search: ${intent.substring(0, 50)}...`);
              return [];
            })
        )
      );
      
      const chunkResults = await Promise.all(searchPromises);
      chunkResults.forEach(resultSet => allResults.push(...resultSet));
      
      // Small delay between chunks
      if (i + chunkSize < intents.length) {
        await this.sleep(1000);
      }
    }
    
    // Deduplicate results
    const uniqueUrls = new Map<string, SearchResult>();
    allResults.forEach(result => {
      if (!uniqueUrls.has(result.url)) {
        uniqueUrls.set(result.url, result);
      }
    });
    
    const finalResults = Array.from(uniqueUrls.values());
    
    console.log(`Total unique URLs found: ${finalResults.length}`);
    
    // Sort by relevance (sources with titles and snippets first)
    return finalResults.sort((a, b) => {
      const scoreA = (a.title ? 1 : 0) + (a.snippet ? 1 : 0);
      const scoreB = (b.title ? 1 : 0) + (b.snippet ? 1 : 0);
      return scoreB - scoreA;
    });
  }

  async searchWithStructuredOutput(query: string, state: string, schema: any): Promise<any> {
    try {
      const domains = this.getDomainsForState(state);
      
      const response = await axios.post<any>(
        `${this.baseUrl}/chat/completions`,
        {
          model: "sonar",
          messages: [
            {
              role: "system",
              content: "Extract structured compliance data from search results."
            },
            {
              role: "user",
              content: query
            }
          ],
          web_search_options: {
            search_context_size: "high",
            search_domain_filter: domains
          },
          response_format: {
            type: "json_object",
            schema: schema
          }
        },
        {
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error with structured output search:', error);
      return null;
    }
  }

  private getDomainsForState(state: string): string[] {
    const federalDomains = [
      "irs.gov",
      "dol.gov",
      "osha.gov",
      "eeoc.gov",
      "epa.gov",
      "sba.gov",
      "ftc.gov",
      "ada.gov",
      "hhs.gov",
      "federalregister.gov",
      "ecfr.gov"
    ];

    const stateAbbr = this.getStateAbbreviation(state).toLowerCase();
    const stateName = state.toLowerCase().replace(/\s+/g, "");
    
    const stateDomains = [
      `${stateAbbr}.gov`,
      `${stateName}.gov`,
      `state.${stateAbbr}.us`
    ];

    return [...federalDomains, ...stateDomains];
  }

  private getStateAbbreviation(state: string): string {
    const stateMap: Record<string, string> = {
      "California": "CA", "Texas": "TX", "New York": "NY", "Florida": "FL",
      "Illinois": "IL", "Pennsylvania": "PA", "Ohio": "OH", "Georgia": "GA",
      "North Carolina": "NC", "Michigan": "MI", "New Jersey": "NJ", "Virginia": "VA",
      "Washington": "WA", "Arizona": "AZ", "Massachusetts": "MA", "Tennessee": "TN",
      "Indiana": "IN", "Missouri": "MO", "Maryland": "MD", "Wisconsin": "WI",
      "Colorado": "CO", "Minnesota": "MN", "South Carolina": "SC", "Alabama": "AL",
      "Louisiana": "LA", "Kentucky": "KY", "Oregon": "OR", "Oklahoma": "OK",
      "Connecticut": "CT", "Utah": "UT", "Iowa": "IA", "Nevada": "NV",
      "Arkansas": "AR", "Mississippi": "MS", "Kansas": "KS", "New Mexico": "NM",
      "Nebraska": "NE", "West Virginia": "WV", "Idaho": "ID", "Hawaii": "HI",
      "New Hampshire": "NH", "Maine": "ME", "Montana": "MT", "Rhode Island": "RI",
      "Delaware": "DE", "South Dakota": "SD", "North Dakota": "ND", "Alaska": "AK",
      "Vermont": "VT", "Wyoming": "WY", "District of Columbia": "DC"
    };
    
    return stateMap[state] || state.substring(0, 2).toUpperCase();
  }

  private isValidGovUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes(".gov") || urlObj.hostname.includes(".us");
    } catch {
      return false;
    }
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return "unknown";
    }
  }
}