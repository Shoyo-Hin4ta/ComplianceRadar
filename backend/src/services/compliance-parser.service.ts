import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { Requirement } from "../types/compliance.types";

// Schema for structured requirement extraction
const RequirementSchema = z.object({
  name: z.string(),
  description: z.string(),
  agency: z.string().optional(),
  formNumber: z.string().optional(),
  deadline: z.string().optional(),
  penalty: z.string().optional(),
  source: z.string(),
  sourceType: z.enum(['federal', 'state', 'city', 'industry']),
  citation: z.string().optional(),
  appliesWhen: z.string().optional(),
  requirementType: z.enum(['legal_requirement', 'industry_standard', 'best_practice'])
});

const ParsedComplianceSchema = z.object({
  federal: z.array(RequirementSchema),
  state: z.array(RequirementSchema),
  local: z.array(RequirementSchema),
  industry: z.array(RequirementSchema),
  conditional: z.array(z.object({
    condition: z.string(),
    requirements: z.array(RequirementSchema)
  }))
});

export class ComplianceParserService {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-4o-mini",
      temperature: 0.1, // Low temperature for consistent parsing
    });
  }

  /**
   * Parse Perplexity's narrative response into structured requirements
   */
  async parseComplianceNarrative(
    narrativeContent: string,
    eventEmitter?: (event: any) => void
  ): Promise<{
    requirements: Requirement[];
    categorized: any;
    statistics: any;
  }> {
    try {
      if (eventEmitter) {
        eventEmitter({
          type: 'parsing-started',
          message: '📝 Extracting structured requirements from research',
          details: 'Using GPT-4 to parse compliance data'
        });
      }

      const parsingPrompt = `
Extract all compliance requirements from the following text into a structured format.

For each requirement, identify:
- name: The official name of the requirement
- description: What must be done
- agency: The government agency responsible (e.g., IRS, DOL, OSHA)
- formNumber: Any specific form numbers (e.g., Form 941, 1095-C)
- deadline: Specific dates or frequencies (e.g., "Quarterly", "March 31", "Within 30 days")
- penalty: Dollar amounts or consequences for non-compliance
- source: The official website or regulation reference
- sourceType: Whether it's federal, state, city, or industry
- citation: Legal citation if available (e.g., "26 CFR 31.6011(a)-1")
- appliesWhen: Conditions when this applies (e.g., "employees > 50", "interstate commerce")
- requirementType: Whether it's a legal_requirement, industry_standard, or best_practice

Group requirements into:
- federal: Federal government requirements
- state: State-specific requirements
- city: City and local government requirements
- industry: Industry-specific requirements
- conditional: Requirements that only apply under certain conditions

Be comprehensive and extract EVERY requirement mentioned.

Text to parse:
${narrativeContent}`;

      const response = await this.model.invoke(parsingPrompt);
      const content = response.content.toString();

      // Try to extract JSON from the response
      let parsedData;
      try {
        // Look for JSON in the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: use structured output parsing
          parsedData = await this.structuredParse(narrativeContent);
        }
      } catch (parseError) {
        console.error('JSON parsing failed, using structured parsing:', parseError);
        parsedData = await this.structuredParse(narrativeContent);
      }

      // Convert to our Requirement format
      const requirements = this.convertToRequirements(parsedData);

      // Calculate statistics
      const statistics = {
        total: requirements.length,
        federal: requirements.filter(r => r.sourceType === 'federal').length,
        state: requirements.filter(r => r.sourceType === 'state').length,
        local: requirements.filter(r => r.sourceType === 'city').length,
        industry: requirements.filter(r => r.sourceType === 'industry').length,
        legal: requirements.filter(r => (r as any).requirementType === 'legal_requirement').length,
        withDeadlines: requirements.filter(r => r.deadline).length,
        withPenalties: requirements.filter(r => r.penalty).length,
        withForms: requirements.filter(r => r.formNumber).length
      };

      if (eventEmitter) {
        eventEmitter({
          type: 'requirements-found',
          federal: statistics.federal,
          state: statistics.state,
          local: statistics.local,
          industry: statistics.industry,
          total: statistics.total,
          message: `📊 Extracted ${statistics.total} compliance requirements`
        });
      }

      return {
        requirements,
        categorized: parsedData,
        statistics
      };
    } catch (error) {
      console.error('Error parsing compliance narrative:', error);
      throw error;
    }
  }

  /**
   * Structured parsing using function calling
   */
  private async structuredParse(content: string): Promise<any> {
    const extractionPrompt = `
You are a compliance expert. Extract all compliance requirements from the provided text.
Group them by jurisdiction (federal, state, local, industry).
Include all details: forms, deadlines, penalties, agencies, conditions.
Focus on accuracy and completeness.`;

    const response = await this.model.invoke([
      { role: 'system', content: extractionPrompt },
      { role: 'user', content: content }
    ]);

    // Parse the response manually if needed
    return this.manualParse(response.content.toString());
  }

  /**
   * Manual parsing fallback
   */
  private manualParse(content: string): any {
    const result = {
      federal: [],
      state: [],
      local: [],
      industry: [],
      conditional: []
    };

    // Simple regex patterns to extract requirements
    const lines = content.split('\n');
    let currentCategory = 'federal';
    let currentRequirement: any = null;

    for (const line of lines) {
      // Detect category changes
      if (line.toLowerCase().includes('federal')) {
        currentCategory = 'federal';
      } else if (line.toLowerCase().includes('state')) {
        currentCategory = 'state';
      } else if (line.toLowerCase().includes('local') || line.toLowerCase().includes('city')) {
        currentCategory = 'local';
      } else if (line.toLowerCase().includes('industry')) {
        currentCategory = 'industry';
      }

      // Extract form numbers
      const formMatch = line.match(/Form\s+([0-9A-Z-]+)/i);
      if (formMatch && currentRequirement) {
        currentRequirement.formNumber = formMatch[1];
      }

      // Extract deadlines
      const deadlinePatterns = [
        /due\s+(.*?)(?:\.|,|$)/i,
        /deadline:\s*(.*?)(?:\.|,|$)/i,
        /by\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+/i,
        /quarterly/i,
        /annually/i,
        /monthly/i
      ];
      
      for (const pattern of deadlinePatterns) {
        const match = line.match(pattern);
        if (match && currentRequirement) {
          currentRequirement.deadline = match[1] || match[0];
          break;
        }
      }

      // Extract penalties
      const penaltyMatch = line.match(/\$[\d,]+/);
      if (penaltyMatch && currentRequirement) {
        currentRequirement.penalty = penaltyMatch[0];
      }

      // Create new requirement if line looks like a requirement header
      if (line.match(/^[\d\-\*]\s+/) || line.match(/^[A-Z][A-Z\s]+:/)) {
        if (currentRequirement) {
          result[currentCategory].push(currentRequirement);
        }
        currentRequirement = {
          name: line.replace(/^[\d\-\*]\s+/, '').replace(/:.*$/, '').trim(),
          description: line,
          sourceType: currentCategory === 'local' ? 'city' : currentCategory,
          source: 'Perplexity Research',
          requirementType: 'legal_requirement'
        };
      }
    }

    // Add last requirement
    if (currentRequirement) {
      result[currentCategory].push(currentRequirement);
    }

    return result;
  }

  /**
   * Convert parsed data to Requirement format
   */
  private convertToRequirements(parsedData: any): Requirement[] {
    const requirements: Requirement[] = [];

    // Process each category
    const categories = ['federal', 'state', 'local', 'industry'];
    for (const category of categories) {
      if (parsedData[category] && Array.isArray(parsedData[category])) {
        for (const item of parsedData[category]) {
          requirements.push(this.createRequirement(item, category));
        }
      }
    }

    // Process conditional requirements
    if (parsedData.conditional && Array.isArray(parsedData.conditional)) {
      for (const conditional of parsedData.conditional) {
        if (conditional.requirements && Array.isArray(conditional.requirements)) {
          for (const req of conditional.requirements) {
            requirements.push({
              ...this.createRequirement(req, 'federal'),
              appliesCondition: conditional.condition
            } as any);
          }
        }
      }
    }

    return requirements;
  }

  /**
   * Create a single requirement object
   */
  private createRequirement(item: any, category: string): Requirement {
    return {
      name: item.name || 'Unnamed Requirement',
      description: item.description || '',
      source: item.source || 'Perplexity Deep Research',
      sourceType: item.sourceType || (category === 'local' ? 'city' : category) as any,
      citation: item.citation,
      agency: item.agency,
      formNumber: item.formNumber,
      deadline: item.deadline,
      penalty: item.penalty,
      actionRequired: item.description,
      verified: false,
      confidenceLevel: 'MEDIUM', // Will be updated by scorer
      confidenceScore: 0.5 // Will be updated by scorer
    };
  }

  /**
   * Extract key compliance areas from narrative
   */
  async extractComplianceAreas(
    content: string
  ): Promise<string[]> {
    const areas = new Set<string>();

    // Common compliance area keywords
    const areaPatterns = [
      /tax\s+\w+/gi,
      /\bOSHA\b/g,
      /\bADA\b/g,
      /\bEEOC\b/g,
      /workers?\s+comp/gi,
      /business\s+licens/gi,
      /health\s+permit/gi,
      /fire\s+permit/gi,
      /zoning/gi,
      /environmental/gi,
      /FDA/g,
      /EPA/g,
      /FTC/g,
      /payroll/gi,
      /employment/gi,
      /insurance/gi
    ];

    for (const pattern of areaPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => areas.add(match));
      }
    }

    return Array.from(areas);
  }
}