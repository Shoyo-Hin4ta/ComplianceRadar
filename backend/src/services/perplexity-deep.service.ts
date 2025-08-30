import axios from 'axios';
import { BusinessProfile } from '../types/compliance.types';

interface PerplexityAsyncRequest {
  id: string;
  status: 'CREATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created_at: number;
  started_at?: number;
  completed_at?: number;
  response?: PerplexityResponse;
  error_message?: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    citation_tokens?: number;
    num_search_queries?: number;
    reasoning_tokens?: number;
  };
  citations?: string[];
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
}

export class PerplexityDeepResearchService {
  private apiKey: string;
  private baseUrl = 'https://api.perplexity.ai';

  constructor() {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Build a comprehensive compliance query from business profile
   */
  buildComplianceQuery(profile: BusinessProfile): string {
    const query = `
Find ALL legal compliance requirements for a ${profile.industry} business in ${profile.city}, ${profile.state} with the following characteristics:
- Industry: ${profile.industry} (NAICS: ${profile.naicsCode || 'N/A'})
- Employees: ${profile.employeeCount} employees
- Annual Revenue: $${profile.annualRevenue?.toLocaleString() || 'Not specified'}
- Business Structure: ${profile.businessStructure || 'General corporation'}
${profile.specialFactors?.length ? `- Special Circumstances: ${profile.specialFactors.join(', ')}` : ''}

Please provide COMPREHENSIVE compliance requirements including:

1. FEDERAL REQUIREMENTS:
   - IRS tax obligations (all applicable forms, filing deadlines, payment schedules)
   - Department of Labor (DOL) requirements
   - OSHA workplace safety requirements
   - EEOC and ADA requirements (if 15+ employees)
   - Healthcare requirements (ACA if 50+ employees)
   - EPA environmental regulations (if applicable)
   - FDA regulations (if food/drug related)
   - FTC regulations (if consumer-facing)
   - Any industry-specific federal requirements

2. STATE REQUIREMENTS for ${profile.state}:
   - State business registration and licensing
   - State tax obligations (income, sales, payroll)
   - Workers' compensation insurance requirements
   - State-specific employment laws
   - Professional/occupational licenses
   - State environmental regulations
   - Any state-specific industry regulations

3. LOCAL REQUIREMENTS for ${profile.city}, ${profile.state}:
   - City/county business permits and licenses
   - Local tax obligations
   - Zoning compliance and permits
   - Health department permits (if applicable)
   - Fire department permits
   - Local employment ordinances
   - Any city-specific regulations

4. INDUSTRY-SPECIFIC REQUIREMENTS:
   - Professional certifications and licenses
   - Industry association standards
   - Insurance requirements (general liability, professional, etc.)
   - Bonding requirements
   - Industry-specific compliance deadlines

For EACH requirement, please provide:
- Requirement name and description
- Applicable government agency
- Specific form numbers (e.g., Form 941, Form 1095-C)
- Filing deadlines (specific dates or frequencies)
- Penalties for non-compliance (dollar amounts if available)
- Official source/website for more information
- Conditions when it applies (e.g., "if employees > 50")

Also identify:
- Requirements that are LEGAL OBLIGATIONS (with penalties for non-compliance)
- Requirements that are INDUSTRY STANDARDS (expected but not legally required)
- Requirements that are BEST PRACTICES (recommended but optional)

Include requirements triggered at common employee thresholds: 1, 10, 15, 20, 50, 100, 200, 500 employees.

Please search comprehensively across all relevant .gov websites and official sources to ensure complete coverage.`;

    return query.trim();
  }

  /**
   * Submit an async deep research request to Perplexity
   */
  async submitDeepResearch(
    query: string,
    eventEmitter?: (event: any) => void
  ): Promise<string> {
    try {
      // Emit the full query for transparency
      if (eventEmitter) {
        eventEmitter({
          type: 'query-prepared',
          query: query,
          length: query.length,
          message: '📝 Prepared comprehensive compliance query'
        });
      }

      // Perplexity async API requires a request wrapper
      const requestBody = {
        request: {
          model: 'sonar-deep-research',
          messages: [
            {
              role: 'user',
              content: query
            }
          ],
          reasoning_effort: 'high',
          stream: false
        }
      };

      console.log('Submitting async request to Perplexity:', JSON.stringify(requestBody, null, 2));

      const response = await axios.post(`${this.baseUrl}/async/chat/completions`, requestBody, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.status !== 200) {
        throw new Error(`Perplexity API error: ${response.status} - ${response.statusText}`);
      }

      const result = response.data;
      console.log('Async request created successfully:', JSON.stringify(result, null, 2));

      if (eventEmitter) {
        eventEmitter({
          type: 'research-started',
          requestId: result.id || result,
          model: 'sonar-deep-research',
          estimatedTime: '3-5 minutes',
          message: '🔍 Deep research initiated - this will take 3-5 minutes for comprehensive analysis'
        });
      }

      // The API might return just the ID as a string
      return result.id || result;
    } catch (error: any) {
      console.error('Error submitting deep research:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        
        if (error.response.status === 401) {
          throw new Error('Perplexity API key is invalid or expired. Please update PERPLEXITY_API_KEY in your .env file with a valid key from https://www.perplexity.ai/settings/api');
        }
      }
      throw error;
    }
  }

  /**
   * Poll for async request completion
   */
  async pollForCompletion(
    requestId: string,
    eventEmitter?: (event: any) => void,
    maxAttempts: number = 60, // 5 minutes with 5-second intervals
    intervalMs: number = 5000
  ): Promise<PerplexityResponse> {
    let attempts = 0;
    const startTime = Date.now(); // Track when polling started
    
    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/async/chat/completions/${requestId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            }
          }
        );

        if (response.status !== 200) {
          throw new Error(`Failed to check status: ${response.status}`);
        }

        const result = response.data;
        console.log(`Polling attempt ${attempts + 1}, response:`, JSON.stringify(result, null, 2));

        // Emit progress updates
        if (eventEmitter) {
          const elapsedMs = Date.now() - startTime;
          const elapsedSeconds = Math.floor(elapsedMs / 1000);
          eventEmitter({
            type: 'research-progress',
            status: result.status || 'PROCESSING',
            elapsed: elapsedSeconds,
            message: `⏳ Researching... (${elapsedSeconds} seconds elapsed)`,
            details: 'Analyzing federal, state, and local compliance requirements'
          });
        }

        // Check for completion - the response structure might be different
        if ((result.status === 'COMPLETED' || result.status === 'completed' || result.status === 'COMPLETE') && result.response) {
          // Emit completion with statistics
          if (eventEmitter) {
            eventEmitter({
              type: 'research-complete',
              sourcesAnalyzed: result.response.usage?.num_search_queries || 0,
              citations: result.response.citations?.length || 0,
              totalTokens: result.response.usage?.total_tokens || 0,
              message: `✅ Research complete! Analyzed ${result.response.usage?.num_search_queries || 0} sources`
            });
          }
          return result.response;
        }
        
        // The response might be the completion object directly
        if (result.choices && result.choices.length > 0) {
          console.log('Direct response received:', result);
          if (eventEmitter) {
            eventEmitter({
              type: 'research-complete',
              sourcesAnalyzed: result.usage?.num_search_queries || 0,
              citations: result.citations?.length || 0,
              totalTokens: result.usage?.total_tokens || 0,
              message: `✅ Research complete!`
            });
          }
          return result as PerplexityResponse;
        }

        if (result.status === 'FAILED' || result.status === 'failed') {
          throw new Error(`Research failed: ${result.error_message || result.error || 'Unknown error'}`);
        }

        attempts++;
        await this.sleep(intervalMs);
      } catch (error) {
        console.error(`Polling attempt ${attempts} failed:`, error);
        if (attempts >= maxAttempts - 1) {
          throw error;
        }
        attempts++;
        await this.sleep(intervalMs);
      }
    }

    throw new Error('Research timeout: Processing took longer than expected');
  }

  /**
   * Execute complete deep research flow
   */
  async executeDeepResearch(
    businessProfile: BusinessProfile,
    eventEmitter?: (event: any) => void
  ): Promise<{
    content: string;
    citations: string[];
    usage: any;
    requestId: string;
  }> {
    // Build the comprehensive query
    const query = this.buildComplianceQuery(businessProfile);

    // Submit async request
    const requestId = await this.submitDeepResearch(query, eventEmitter);

    // Poll for completion
    const response = await this.pollForCompletion(requestId, eventEmitter);

    // Extract content from response
    const content = response.choices[0]?.message?.content || '';
    
    if (!content) {
      throw new Error('No content received from Perplexity');
    }

    // Emit sources found event
    if (eventEmitter && response.citations) {
      eventEmitter({
        type: 'sources-found',
        count: response.usage?.num_search_queries || 0,
        citations: response.citations.length,
        sources: response.citations.slice(0, 10), // Show first 10 sources
        message: `📚 Found ${response.citations.length} authoritative sources`
      });
    }

    return {
      content,
      citations: response.citations || [],
      usage: response.usage,
      requestId
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}