import axios from 'axios';
import { BusinessProfile } from '../types/compliance.types';

interface SonarSearchResult {
  url: string;
  title: string;
  snippet?: string;
  score?: number;
}

interface SonarResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  search_results?: SonarSearchResult[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class PerplexitySonarService {
  private apiKey: string;
  private baseUrl = 'https://api.perplexity.ai';

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY is not configured');
    }
  }

  /**
   * Build targeted query for federal requirements
   */
  private buildFederalQuery(businessProfile: BusinessProfile): string {
    const { industry, naicsCode, employeeCount, annualRevenue, specialFactors } = businessProfile;
    
    return `Find ALL federal compliance requirements, licenses, permits, and registrations required for a ${industry} business ${naicsCode ? `(NAICS ${naicsCode})` : ''} in the United States.

Business characteristics:
- Industry: ${industry}
- Employees: ${employeeCount || 'not specified'}
- Annual Revenue: ${annualRevenue ? `$${annualRevenue.toLocaleString()}` : 'not specified'}
${specialFactors.length > 0 ? `- Special factors: ${specialFactors.join(', ')}` : ''}

I need COMPREHENSIVE information on:
1. IRS tax requirements (EIN, tax forms, filing schedules)
2. Department of Labor requirements (FLSA, wage laws, workplace posters)
3. OSHA safety requirements specific to ${industry}
4. EEOC and employment law compliance
5. EPA environmental requirements if applicable
6. FDA requirements if handling food/beverages
7. FTC requirements if accepting online payments
8. Industry-specific federal licenses or permits
9. ADA compliance requirements
10. Healthcare and benefits requirements

Return the OFFICIAL .gov URLs for each requirement. Focus on requirements that DEFINITELY apply to this specific business type and size.`;
  }

  /**
   * Build targeted query for state requirements
   */
  private buildStateQuery(businessProfile: BusinessProfile): string {
    const { state, industry, naicsCode, employeeCount, specialFactors } = businessProfile;
    
    return `Find ALL ${state} state compliance requirements, licenses, permits, and registrations for a ${industry} business ${naicsCode ? `(NAICS ${naicsCode})` : ''}.

Business details:
- State: ${state}
- Industry: ${industry}
- Employees: ${employeeCount || 'not specified'}
${specialFactors.length > 0 ? `- Special factors: ${specialFactors.join(', ')}` : ''}

I need COMPREHENSIVE ${state} state requirements for:
1. State business registration and licensing
2. State tax registration and requirements
3. State employment laws and workers' compensation
4. State-specific safety regulations
5. Professional licenses required in ${state}
6. State environmental permits if applicable
7. State sales tax permit if selling products
8. State unemployment insurance
9. State disability insurance requirements
10. Industry-specific state regulations

Return the OFFICIAL ${state}.gov URLs. Focus on requirements specific to ${state} state that apply to ${industry} businesses.`;
  }

  /**
   * Build targeted query for local/city requirements
   */
  private buildLocalQuery(businessProfile: BusinessProfile): string {
    const { state, city, industry, naicsCode, specialFactors } = businessProfile;
    
    const location = city ? `${city}, ${state}` : state;
    
    return `Find ALL local government compliance requirements, business licenses, permits, and regulations for a ${industry} business in ${location} ${naicsCode ? `(NAICS ${naicsCode})` : ''}.

Location: ${location}
Industry: ${industry}
${specialFactors.length > 0 ? `Special factors: ${specialFactors.join(', ')}` : ''}

I need COMPREHENSIVE local requirements including:
1. City/County business license requirements
2. Local zoning permits and regulations
3. Building and occupancy permits
4. Health department permits (especially for ${industry})
5. Fire department permits and inspections
6. Local tax registrations
7. Signage permits
8. Special use permits
9. Home occupation permits if applicable
10. Local environmental or noise ordinances

Search for official city, county, and municipal government websites for ${location}. Include both city-specific and county-level requirements.`;
  }

  /**
   * Build targeted query for industry-specific requirements
   */
  private buildIndustryQuery(businessProfile: BusinessProfile): string {
    const { industry, naicsCode, state, specialFactors } = businessProfile;
    
    return `Find ALL industry-specific compliance requirements, standards, certifications, and regulations for a ${industry} business ${naicsCode ? `(NAICS ${naicsCode})` : ''} operating in ${state}.

Industry: ${industry}
NAICS: ${naicsCode || 'not specified'}
State: ${state}
${specialFactors.length > 0 ? `Special factors: ${specialFactors.join(', ')}` : ''}

I need COMPREHENSIVE industry requirements including:
1. Industry-specific licenses and certifications
2. Professional association requirements
3. Industry standards and best practices
4. Trade association regulations
5. Industry-specific insurance requirements
6. Quality standards and certifications
7. Industry-specific training requirements
8. Equipment and facility standards
9. Industry-specific reporting requirements
10. Customer protection regulations for ${industry}

Focus on requirements specific to the ${industry} industry. Include both mandatory regulations and important industry standards.`;
  }

  /**
   * Search for compliance URLs using Perplexity Sonar
   * Now with PARALLEL API calls for 4x faster performance
   */
  async searchForComplianceUrls(
    businessProfile: BusinessProfile,
    eventEmitter?: (event: any) => void
  ): Promise<{
    urls: SonarSearchResult[];
    content: string;
    usage: any;
  }> {
    try {
      if (eventEmitter) {
        eventEmitter({
          type: 'query-building',
          message: 'Preparing multi-stage compliance search strategy...',
          progress: 2
        });
      }

      const allUrls: SonarSearchResult[] = [];
      let totalUsage = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };
      let allContent = '';

      // Emit clear event that we're searching the internet
      if (eventEmitter) {
        eventEmitter({
          type: 'sonar-searching',
          message: 'Searching the internet for compliance requirements...',
          progress: 10,
          details: `Querying federal, state (${businessProfile.state}), local (${businessProfile.city || 'county'}), and ${businessProfile.industry} industry databases simultaneously`
        });
      }

      console.log('Starting PARALLEL API calls for all 4 search types...');

      // Build all queries
      const federalQuery = this.buildFederalQuery(businessProfile);
      const stateQuery = this.buildStateQuery(businessProfile);
      const localQuery = this.buildLocalQuery(businessProfile);
      const industryQuery = this.buildIndustryQuery(businessProfile);

      // Execute all 4 API calls in PARALLEL using Promise.all
      const startTime = Date.now();
      const [federalResponse, stateResponse, localResponse, industryResponse] = await Promise.all([
        // Federal search
        axios.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: 'sonar-reasoning',
            messages: [
              {
                role: 'user',
                content: federalQuery
              }
            ],
            search_domain_filter: [
              'irs.gov', 'dol.gov', 'osha.gov', 'eeoc.gov', 'ftc.gov',
              'fda.gov', 'epa.gov', 'sba.gov', 'healthcare.gov', 'ada.gov'
            ],
            web_search_options: {
              search_context_size: 'high'
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        ),
        
        // State search
        axios.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: 'sonar-reasoning',
            messages: [
              {
                role: 'user',
                content: stateQuery
              }
            ],
            search_domain_filter: [
              `${businessProfile.state.toLowerCase()}.gov`,
              `state.${businessProfile.state.toLowerCase()}.us`,
              'tax.gov', 'labor.gov'
            ],
            web_search_options: {
              search_context_size: 'high'
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        ),
        
        // Local search
        axios.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: 'sonar-reasoning',
            messages: [
              {
                role: 'user',
                content: localQuery
              }
            ],
            web_search_options: {
              search_context_size: 'medium'
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        ),
        
        // Industry search
        axios.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: 'sonar-reasoning',
            messages: [
              {
                role: 'user',
                content: industryQuery
              }
            ],
            web_search_options: {
              search_context_size: 'medium'
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        )
      ]);
      
      const parallelTime = Date.now() - startTime;
      console.log(`✅ All 4 API calls completed in ${parallelTime}ms (parallel execution)`);

      // Process all responses
      const federalData: SonarResponse = federalResponse.data;
      const federalUrls = federalData.search_results || [];
      allUrls.push(...federalUrls);
      totalUsage.prompt_tokens += federalData.usage?.prompt_tokens || 0;
      totalUsage.completion_tokens += federalData.usage?.completion_tokens || 0;
      allContent += `Federal Requirements:\n${federalData.choices[0]?.message?.content || ''}\n\n`;
      console.log(`  Federal search returned ${federalUrls.length} URLs`);

      const stateData: SonarResponse = stateResponse.data;
      const stateUrls = stateData.search_results || [];
      allUrls.push(...stateUrls);
      totalUsage.prompt_tokens += stateData.usage?.prompt_tokens || 0;
      totalUsage.completion_tokens += stateData.usage?.completion_tokens || 0;
      allContent += `State Requirements:\n${stateData.choices[0]?.message?.content || ''}\n\n`;
      console.log(`  State search returned ${stateUrls.length} URLs`);

      const localData: SonarResponse = localResponse.data;
      const localUrls = localData.search_results || [];
      allUrls.push(...localUrls);
      totalUsage.prompt_tokens += localData.usage?.prompt_tokens || 0;
      totalUsage.completion_tokens += localData.usage?.completion_tokens || 0;
      allContent += `Local Requirements:\n${localData.choices[0]?.message?.content || ''}\n\n`;
      console.log(`  Local search returned ${localUrls.length} URLs`);

      const industryData: SonarResponse = industryResponse.data;
      const industryUrls = industryData.search_results || [];
      allUrls.push(...industryUrls);
      totalUsage.prompt_tokens += industryData.usage?.prompt_tokens || 0;
      totalUsage.completion_tokens += industryData.usage?.completion_tokens || 0;
      allContent += `Industry Requirements:\n${industryData.choices[0]?.message?.content || ''}\n\n`;
      console.log(`  Industry search returned ${industryUrls.length} URLs`);

      // Deduplicate all URLs
      const uniqueUrls = Array.from(
        new Map(allUrls.map(item => [item.url, item])).values()
      );

      console.log(`\nTotal URLs collected: ${allUrls.length}`);
      console.log(`Unique URLs after deduplication: ${uniqueUrls.length}`);
      
      // Log breakdown
      const govUrls = uniqueUrls.filter(r => r.url.includes('.gov'));
      const stateSpecificUrls = uniqueUrls.filter(r => 
        r.url.includes(`.${businessProfile.state.toLowerCase()}.`) ||
        r.url.includes(`/${businessProfile.state.toLowerCase()}/`)
      );
      const cityUrls = uniqueUrls.filter(r => 
        businessProfile.city && r.url.toLowerCase().includes(businessProfile.city.toLowerCase())
      );
      
      console.log(`  - Federal .gov URLs: ${govUrls.filter(u => 
        u.url.includes('irs.gov') || u.url.includes('dol.gov') || 
        u.url.includes('osha.gov') || u.url.includes('epa.gov')
      ).length}`);
      console.log(`  - State-specific URLs: ${stateSpecificUrls.length}`);
      console.log(`  - City-specific URLs: ${cityUrls.length}`);
      console.log(`  - Other sources: ${uniqueUrls.filter(u => !u.url.includes('.gov')).length}`);

      // Emit search complete event with breakdown
      if (eventEmitter) {
        const searchTimeSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
        
        eventEmitter({
          type: 'search-complete',
          message: `Found ${uniqueUrls.length} compliance sources from 4 parallel searches in ${searchTimeSeconds}s`,
          count: uniqueUrls.length,
          progress: 18,
          breakdown: {
            federal: federalUrls.length,
            state: stateUrls.length,
            local: localUrls.length,
            industry: industryUrls.length
          },
          searchTime: searchTimeSeconds
        });

        // Emit individual URL events (all at once since they were found simultaneously)
        uniqueUrls.forEach((result, index) => {
          eventEmitter({
            type: 'url-found',
            url: result.url,
            title: result.title,
            index: index + 1,
            total: uniqueUrls.length
          });
        });

        // Now emit the discovered URLs summary event
        eventEmitter({
          type: 'urls-discovered',
          count: uniqueUrls.length,
          message: `Analyzing ${uniqueUrls.length} authoritative sources`,
          progress: 20
        });
      }

      totalUsage.total_tokens = totalUsage.prompt_tokens + totalUsage.completion_tokens;

      console.log(`\n📊 API Usage Summary:`);
      console.log(`  Prompt tokens: ${totalUsage.prompt_tokens}`);
      console.log(`  Completion tokens: ${totalUsage.completion_tokens}`);
      console.log(`  Total tokens: ${totalUsage.total_tokens}`);

      return {
        urls: uniqueUrls,
        content: allContent,
        usage: totalUsage
      };

    } catch (error) {
      console.error('Error in Perplexity Sonar search:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Perplexity API authentication failed. Please check your API key.');
        } else if (error.response?.status === 429) {
          throw new Error('Perplexity API rate limit exceeded. Please try again later.');
        } else if (error.response?.data) {
          console.error('Perplexity API error response:', error.response.data);
          throw new Error(`Perplexity API error: ${JSON.stringify(error.response.data)}`);
        }
      }
      
      throw error;
    }
  }
}