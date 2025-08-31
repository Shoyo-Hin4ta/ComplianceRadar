import { v4 as uuidv4 } from "uuid";
import { BusinessProfile, Requirement } from "../types/compliance.types";
import { PerplexitySonarService } from "./perplexity-sonar.service";
import { FirecrawlBatchService } from "./firecrawl-batch.service";
import { registerJob } from "../routes/webhook.routes";
import { ChatOpenAI } from "@langchain/openai";

interface ClassifiedUrl {
  url: string;
  title: string;
  category: 'federal' | 'state' | 'city' | 'industry';
  relevant: boolean;
}

export class ComplianceV2Service {
  private perplexitySonar: PerplexitySonarService;
  private firecrawlBatch: FirecrawlBatchService;
  private aiModel: ChatOpenAI;

  constructor() {
    this.perplexitySonar = new PerplexitySonarService();
    this.firecrawlBatch = new FirecrawlBatchService();
    this.aiModel = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-4o",
      temperature: 0.1,
    });
  }

  async runComplianceCheck(
    businessProfile: BusinessProfile,
    checkId: string,
    emit: (event: any) => void
  ): Promise<{
    requirements: Requirement[];
    statistics: any;
    organized: any;
  }> {
    try {
      // Step 1: Build query
      emit({
        type: "query-building",
        message: "Building comprehensive compliance query...",
        progress: 2,
        details: `Analyzing ${businessProfile.industry} in ${businessProfile.city}, ${businessProfile.state}`
      });

      // Step 2: Search for compliance information using Perplexity Sonar
      emit({
        type: "fetching-urls",
        message: "Searching for compliance information...",
        progress: 5
      });

      const searchResult = await this.perplexitySonar.searchForComplianceUrls(
        businessProfile,
        (event) => emit(event)
      );

      const urls = searchResult.urls.map(u => ({
        url: u.url,
        title: u.title
      }));

      emit({
        type: "urls-received",
        count: urls.length,
        message: `Found ${urls.length} sources from search`,
        progress: 20
      });

      if (urls.length === 0) {
        throw new Error("No compliance sources found. Please try again.");
      }

      // Step 3: Filter and classify URLs using AI
      emit({
        type: "filtering-urls",
        message: "Analyzing relevance of sources...",
        progress: 22
      });

      const classifiedUrls = await this.classifyUrlsWithAI(urls, businessProfile, (event) => emit(event));

      // Filter only relevant URLs
      const relevantUrls = classifiedUrls.filter(u => u.relevant);

      // Group by category for statistics
      const breakdown = {
        federal: relevantUrls.filter(u => u.category === 'federal').length,
        state: relevantUrls.filter(u => u.category === 'state').length,
        city: relevantUrls.filter(u => u.category === 'city').length,
        industry: relevantUrls.filter(u => u.category === 'industry').length
      };

      emit({
        type: "urls-filtered",
        selected: relevantUrls.length,
        total: urls.length,
        message: `Selected ${relevantUrls.length} most authoritative sources`,
        progress: 25,
        breakdown
      });

      // Step 4: Batch scrape URLs with Firecrawl
      emit({
        type: "batch-starting",
        message: "Starting to scrape compliance data...",
        progress: 25
      });

      const urlsToScrape = relevantUrls.map(u => u.url);
      
      if (urlsToScrape.length === 0) {
        throw new Error("No URLs to scrape after filtering");
      }

      // Register job for webhook tracking
      const jobId = uuidv4();
      registerJob(jobId, checkId, urlsToScrape);

      const scrapedResults = await this.firecrawlBatch.batchScrapeWithExtraction(
        urlsToScrape,
        (event) => emit(event)
      );
      
      // Create a map to lookup category by URL
      const urlCategoryMap = new Map<string, string>();
      relevantUrls.forEach(u => urlCategoryMap.set(u.url, u.category));

      const successCount = scrapedResults.filter(r => r.success).length;
      const totalRequirements = scrapedResults.reduce((sum, r) => sum + r.requirements.length, 0);

      emit({
        type: "scraping-complete",
        successCount,
        failedCount: scrapedResults.length - successCount,
        totalRequirements,
        message: `Scraped ${successCount}/${urlsToScrape.length} sources, found ${totalRequirements} requirements`,
        progress: 85
      });

      // Step 5: Aggregate and deduplicate requirements
      emit({
        type: "processing-data",
        message: "Extracting and organizing requirements...",
        progress: 87
      });

      const allRequirements: Requirement[] = [];
      
      for (const result of scrapedResults) {
        if (result.success && result.requirements) {
          // Get the category from our AI classification
          const urlCategory = urlCategoryMap.get(result.url) || 'industry';
          
          for (const req of result.requirements) {
            allRequirements.push({
              id: uuidv4(),
              category: this.categorizeRequirement(req, result.url),
              name: req.name || "Unnamed requirement",
              description: req.description || "",
              source: req.agency || this.extractAgency(result.url),
              sourceUrl: req.sourceUrl || result.url,
              sourceType: urlCategory as any, // Use AI-classified category
              formNumber: req.formNumber,
              deadline: req.deadline,
              frequency: req.frequency,
              penalty: req.penalty,
              appliesTo: req.appliesWhen,
              relevanceScore: 0,
              metadata: {
                extractedAt: result.extractedAt,
                jurisdiction: urlCategory
              },
              verified: false
            });
          }
        }
      }

      const uniqueRequirements = this.deduplicateRequirements(allRequirements);

      emit({
        type: "aggregation-complete",
        totalFound: allRequirements.length,
        afterDedup: uniqueRequirements.length,
        message: `Processed ${uniqueRequirements.length} unique requirements`,
        progress: 90
      });

      // Step 5.5: AI Classification of requirements (fine-tune if needed)
      emit({
        type: "processing-requirements",
        message: "Processing extracted requirements...",
        progress: 92
      });

      console.log(`Starting AI classification for ${uniqueRequirements.length} requirements...`);
      let classifiedRequirements = uniqueRequirements;
      
      try {
        classifiedRequirements = await this.classifyRequirementsWithAI(uniqueRequirements, businessProfile);
        console.log(`AI classification completed successfully`);
      } catch (classificationError) {
        console.error('AI classification failed, using fallback sourceType:', classificationError);
        // Ensure all requirements have a valid sourceType even if classification fails
        classifiedRequirements = uniqueRequirements.map(req => {
          if (!req.sourceType || !['federal', 'state', 'city', 'industry'].includes(req.sourceType)) {
            req.sourceType = this.inferSourceType(req) as any;
          }
          return req;
        });
      }

      // Organize results
      const organized = this.organizeRequirements(classifiedRequirements);

      // Calculate statistics
      const statistics = {
        total: classifiedRequirements.length,
        federal: organized.federal.length,
        state: organized.state.length,
        city: organized.city.length,
        industry: organized.industry.length,
        sourcesScraped: successCount
      };

      emit({
        type: "complete",
        totalRules: statistics.total,
        sources: statistics.sourcesScraped,
        message: `Complete! Found ${statistics.total} requirements from ${statistics.sourcesScraped} sources`,
        progress: 100,
        stats: statistics
      });

      console.log(`Returning ${classifiedRequirements.length} classified requirements`);
      return {
        requirements: classifiedRequirements,
        statistics,
        organized
      };

    } catch (error) {
      emit({
        type: "error",
        message: "Compliance check failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
      throw error;
    }
  }

  private categorizeRequirement(req: any, url: string): string {
    if (req.agency) {
      const agency = req.agency.toLowerCase();
      if (agency.includes('irs')) return 'Tax';
      if (agency.includes('dol') || agency.includes('labor')) return 'Employment';
      if (agency.includes('osha')) return 'Safety';
      if (agency.includes('epa')) return 'Environmental';
      if (agency.includes('fda')) return 'Health';
    }
    
    if (url.includes('tax')) return 'Tax';
    if (url.includes('labor') || url.includes('employment')) return 'Employment';
    if (url.includes('safety') || url.includes('osha')) return 'Safety';
    if (url.includes('license') || url.includes('permit')) return 'Licensing';
    
    return 'General';
  }

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


  private deduplicateRequirements(requirements: Requirement[]): Requirement[] {
    const seen = new Map<string, Requirement>();
    
    for (const req of requirements) {
      // Create a unique key based on form number or name + agency
      const key = req.formNumber 
        ? `form:${req.formNumber}` 
        : `${req.source}:${req.name}`.toLowerCase();
      
      if (!seen.has(key)) {
        seen.set(key, req);
      } else {
        // If duplicate, merge information
        const existing = seen.get(key)!;
        if (!existing.deadline && req.deadline) {
          existing.deadline = req.deadline;
        }
        if (!existing.penalty && req.penalty) {
          existing.penalty = req.penalty;
        }
      }
    }
    
    return Array.from(seen.values());
  }

  private organizeRequirements(requirements: Requirement[]) {
    return {
      federal: requirements.filter(r => r.sourceType === 'federal'),
      state: requirements.filter(r => r.sourceType === 'state'),
      city: requirements.filter(r => r.sourceType === 'city'),
      industry: requirements.filter(r => r.sourceType === 'industry'),
      all: requirements
    };
  }

  /**
   * Classify and filter URLs using AI
   */
  private async classifyUrlsWithAI(
    urls: Array<{url: string, title: string}>, 
    businessProfile: BusinessProfile,
    eventEmitter?: (event: any) => void
  ): Promise<ClassifiedUrl[]> {
    try {
      if (eventEmitter) {
        eventEmitter({
          type: 'categorizing-urls',
          message: 'Categorizing sources by jurisdiction...',
          progress: 23
        });
      }

      // Extract business structure from specialFactors
      const businessStructure = businessProfile.specialFactors.find(f => 
        f.includes('Business structure:'))?.replace('Business structure: ', '') || 'unknown';
      const otherFactors = businessProfile.specialFactors.filter(f => 
        !f.includes('Business structure:')).join('; ') || 'none';

      const prompt = `You are a US business compliance analyst. Classify and filter URLs for THIS specific business.

BUSINESS PROFILE:
- Industry: ${businessProfile.industry}${businessProfile.naicsCode ? ` (NAICS ${businessProfile.naicsCode})` : ''}
- Location: ${businessProfile.city || 'City not specified'}, ${businessProfile.state}
- Employees: ${businessProfile.employeeCount || 0}
- Revenue: ${businessProfile.annualRevenue ? `$${businessProfile.annualRevenue.toLocaleString()}` : 'unspecified'}
- Structure: ${businessStructure}
- Special Factors: ${otherFactors}

URLs TO ANALYZE:
${urls.map((u, i) => `${i}. ${u.title}: ${u.url}`).join('\n')}

CLASSIFICATION INSTRUCTIONS:
For each URL, determine:

1. RELEVANCE: Is this URL relevant to compliance obligations for THIS specific business?
   Consider:
   - Location match (${businessProfile.state}, ${businessProfile.city || 'local'})
   - Industry match (${businessProfile.industry})
   - Employee thresholds (${businessProfile.employeeCount || 0} employees)
   ${businessProfile.annualRevenue ? `- Revenue thresholds ($${businessProfile.annualRevenue.toLocaleString()})` : ''}
   - Special factors: ${otherFactors}
   - Business structure: ${businessStructure}
   
2. CATEGORY (if relevant):
   - "federal": US federal government (IRS, DOL, OSHA, EPA, FDA, FTC, EEOC, etc.)
   - "state": ${businessProfile.state} state-level requirement
   - "city": ANY local government including city, municipal, county, township, parish (IMPORTANT: Use "city" for ALL local government levels including county)
   - "industry": Industry associations, standards bodies, trade organizations
   
   CRITICAL: There is NO "county" category. County-level requirements MUST be classified as "city".

Return JSON array (relevant URLs only):
[{
  "index": 0,
  "url": "...",
  "category": "federal|state|city|industry",
  "relevant": true
}]

EXCLUDE:
- News articles, blogs without official citations
- Pages unrelated to this location/industry
- General information without specific requirements
- Duplicate content (keep most authoritative)`;

      const response = await this.aiModel.invoke(prompt);
      const content = response.content as string;
      
      // Parse AI response
      const classifications = JSON.parse(
        content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      );
      
      // Build classified URLs array
      const classifiedUrls: ClassifiedUrl[] = [];
      
      classifications.forEach((classification: any) => {
        const index = classification.index;
        if (index >= 0 && index < urls.length && classification.relevant) {
          classifiedUrls.push({
            url: urls[index].url,
            title: urls[index].title,
            category: classification.category as any,
            relevant: true
          });
        }
      });
      
      console.log(`AI classified ${classifiedUrls.length} relevant URLs from ${urls.length} total`);
      
      return classifiedUrls;
    } catch (error) {
      console.error('Error classifying URLs with AI:', error);
      // Fallback to basic classification if AI fails
      return urls.map(u => ({
        url: u.url,
        title: u.title,
        category: this.getBasicCategory(u.url) as any,
        relevant: true
      }));
    }
  }

  /**
   * Fallback category classification based on URL
   */
  private getBasicCategory(url: string): 'federal' | 'state' | 'city' | 'industry' {
    const lower = url.toLowerCase();
    if (lower.includes('.gov')) {
      if (lower.includes('irs.') || lower.includes('dol.') || lower.includes('osha.') || 
          lower.includes('epa.') || lower.includes('fda.') || lower.includes('sba.')) {
        return 'federal';
      }
      if (lower.includes('.state.') || lower.includes('state.')) {
        return 'state';
      }
      if (lower.includes('.city.') || lower.includes('local')) {
        return 'city';
      }
    }
    return 'industry';
  }

  private async classifyRequirementsWithAI(requirements: Requirement[], businessProfile: BusinessProfile): Promise<Requirement[]> {
    try {
      // Batch requirements for efficient processing
      const batchSize = 20;
      const classifiedRequirements: Requirement[] = [];
      
      for (let i = 0; i < requirements.length; i += batchSize) {
        const batch = requirements.slice(i, i + batchSize);
        
        // Extract business structure from specialFactors
        const businessStructure = businessProfile.specialFactors.find(f => 
          f.includes('Business structure:'))?.replace('Business structure: ', '') || 'unknown';
        const otherFactors = businessProfile.specialFactors.filter(f => 
          !f.includes('Business structure:')).join('; ') || 'none';

        const prompt = `You are a compliance expert. Classify requirements by jurisdiction for THIS specific business.

BUSINESS PROFILE:
- Location: ${businessProfile.city || 'City not specified'}, ${businessProfile.state}
- Industry: ${businessProfile.industry}${businessProfile.naicsCode ? ` (NAICS ${businessProfile.naicsCode})` : ''}
- Employees: ${businessProfile.employeeCount || 0}
- Revenue: ${businessProfile.annualRevenue ? `$${businessProfile.annualRevenue.toLocaleString()}` : 'unspecified'}
- Structure: ${businessStructure}
- Factors: ${otherFactors}

REQUIREMENTS TO CLASSIFY:
${JSON.stringify(batch.map((r, idx) => ({
  index: idx,
  name: r.name,
  description: r.description,
  source: r.source,
  agency: r.metadata?.agency,
  url: r.sourceUrl
})), null, 2)}

For each requirement, identify the sourceType:
- "federal": US federal requirement (IRS, DOL, OSHA, EPA, FDA, FTC, SBA, EEOC, etc.)
- "state": ${businessProfile.state} state requirement
- "city": ALL local government requirements (city, municipal, county, township, parish - ANY local/regional government below state level)
- "industry": Industry association or private standard

CRITICAL INSTRUCTION: 
- Use "city" for ALL local government entities including counties
- NEVER return "county" as a sourceType - it is NOT a valid option
- County departments (like "Maricopa County Environmental Services") MUST be classified as "city"

Consider:
- Agency name and jurisdiction
- URL domain (.gov levels)
- Requirement content and scope
- Which level of government enforces this

CRITICAL: Return ONLY a valid JSON array with no additional text or explanation.
The response must start with [ and end with ]
Format: [{"index": 0, "sourceType": "federal"}, {"index": 1, "sourceType": "state"}, ...]`;

        const response = await this.aiModel.invoke(prompt);
        const content = response.content as string;
        
        // Parse AI response - handle potential text before JSON
        try {
          // Try to extract JSON array from the response
          let jsonContent = content.trim();
          
          // If response contains markdown code blocks, extract the JSON
          if (jsonContent.includes('```')) {
            const match = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (match) {
              jsonContent = match[1].trim();
            }
          }
          
          // If response starts with explanatory text, find the array
          if (!jsonContent.startsWith('[')) {
            const arrayMatch = jsonContent.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
              jsonContent = arrayMatch[0];
            }
          }
          
          const classifications = JSON.parse(jsonContent);
          
          // Apply classifications to batch
          classifications.forEach((classification: any) => {
            const index = classification.index;
            if (index >= 0 && index < batch.length) {
              batch[index].sourceType = classification.sourceType as any;
            }
          });
        } catch (parseError) {
          console.error('Error parsing AI classification response:', parseError);
          console.error('AI Response was:', content);
          // Ensure all requirements have a valid sourceType even if parsing fails
          batch.forEach(req => {
            if (!req.sourceType || req.sourceType === 'unknown') {
              // Use the inferSourceType fallback method
              req.sourceType = this.inferSourceType(req) as any;
            }
          });
        }
        
        classifiedRequirements.push(...batch);
      }
      
      // Final validation - ensure all requirements have a valid sourceType
      classifiedRequirements.forEach(req => {
        if (!req.sourceType || !['federal', 'state', 'city', 'industry'].includes(req.sourceType)) {
          req.sourceType = this.inferSourceType(req) as any;
        }
      });
      
      return classifiedRequirements;
    } catch (error) {
      console.error('Error classifying requirements with AI:', error);
      // Return original requirements with inferred sourceType if AI classification fails
      return requirements.map(req => {
        if (!req.sourceType || !['federal', 'state', 'city', 'industry'].includes(req.sourceType)) {
          req.sourceType = this.inferSourceType(req) as any;
        }
        return req;
      });
    }
  }
}