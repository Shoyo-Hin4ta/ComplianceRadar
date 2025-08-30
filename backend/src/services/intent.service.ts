import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { BusinessProfile } from "../types/compliance.types";
import { IntentValidatorService, ValidatedIntent } from "./intent-validator.service";

const IntentsResponseSchema = z.object({
  intents: z.array(z.string()),
  reasoning: z.string()
});

export interface CategorizedIntent extends ValidatedIntent {
  originalQuery: string;
  enhancedQuery?: string;
}

export class IntentDiscoveryService {
  private model: ChatOpenAI;
  private validator: IntentValidatorService;
  
  // Industry-specific intent templates for better coverage
  private readonly industryIntentTemplates: Record<string, string[]> = {
    restaurant: [
      'health permit requirements',
      'food handler license requirements',
      'ABC alcohol license requirements',
      'outdoor dining permit requirements',
      'grease trap and waste disposal requirements',
      'food safety and HACCP compliance'
    ],
    construction: [
      'contractor license requirements',
      'building permit requirements',
      'OSHA construction safety standards',
      'prevailing wage requirements',
      'bond and insurance requirements',
      'environmental compliance requirements'
    ],
    healthcare: [
      'HIPAA privacy and security compliance',
      'medical waste disposal requirements',
      'professional licensing requirements',
      'Medicare/Medicaid provider requirements',
      'clinical laboratory requirements',
      'controlled substances regulations'
    ],
    retail: [
      'sales tax permit requirements',
      'resale certificate requirements',
      'consumer protection compliance',
      'product labeling requirements',
      'PCI compliance for payment processing',
      'return and refund policy requirements'
    ],
    technology: [
      'data privacy compliance requirements',
      'software licensing compliance',
      'export control regulations',
      'intellectual property requirements',
      'cybersecurity compliance standards',
      'terms of service requirements'
    ],
    manufacturing: [
      'environmental permits and EPA compliance',
      'OSHA manufacturing safety standards',
      'product safety standards',
      'import/export compliance',
      'hazardous materials handling',
      'quality control certifications'
    ]
  };

  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-4o-mini",
      temperature: 0.3,
    });
    this.validator = new IntentValidatorService();
  }

  async discoverIntents(businessProfile: BusinessProfile): Promise<string[]> {
    const categorizedIntents = await this.discoverIntentsEnhanced(businessProfile);
    return categorizedIntents.map(intent => intent.enhancedQuery || intent.intent);
  }

  async discoverIntentsEnhanced(businessProfile: BusinessProfile): Promise<CategorizedIntent[]> {
    try {
      const specialFactorsText = businessProfile.specialFactors.length > 0 
        ? `Special circumstances: ${businessProfile.specialFactors.join(", ")}`
        : "";

      const prompt = `You are an expert compliance consultant analyzing a US business to determine EXACTLY what compliance requirements apply.

Business Profile:
- State: ${businessProfile.state}
- City: ${businessProfile.city || "Not specified"}
- Industry: ${businessProfile.industry}
- NAICS Code: ${businessProfile.naicsCode || "Not specified"}
- Number of Employees: ${businessProfile.employeeCount}
- Annual Revenue: ${businessProfile.annualRevenue ? `$${businessProfile.annualRevenue.toLocaleString()}` : "Not specified"}
${specialFactorsText}

Generate SMART search queries that will find ACTUAL compliance pages on .gov sites. Each query should:
1. Target a SPECIFIC requirement (not general topics)
2. Include the exact government site when known (e.g., "site:irs.gov")
3. Use official terminology that appears on government websites
4. Be concise (3-7 words) to avoid over-constraining the search

Focus on HIGH-PRIORITY requirements that DEFINITELY apply:

${businessProfile.industry.toLowerCase().includes('construction') ? `
CONSTRUCTION-SPECIFIC:
- OSHA construction safety standards site:osha.gov
- ${businessProfile.state} contractor license requirements site:${businessProfile.state.toLowerCase()}.gov
- Building permits ${businessProfile.city || businessProfile.state}
- Prevailing wage requirements site:dol.gov
- Workers compensation insurance ${businessProfile.state}` : ''}

${businessProfile.industry.toLowerCase().includes('restaurant') || businessProfile.industry.toLowerCase().includes('food') ? `
FOOD SERVICE-SPECIFIC:
- Food handler permit ${businessProfile.state} site:${businessProfile.state.toLowerCase()}.gov
- Health permit restaurant ${businessProfile.city || businessProfile.state}
- ABC liquor license ${businessProfile.state}
- FDA food safety requirements site:fda.gov
- Grease trap requirements ${businessProfile.city || businessProfile.state}` : ''}

${businessProfile.employeeCount >= 1 ? `
EMPLOYER REQUIREMENTS:
- EIN federal tax number site:irs.gov
- Form 941 quarterly taxes site:irs.gov
- I-9 employment verification site:uscis.gov
- Workers compensation ${businessProfile.state} site:${businessProfile.state.toLowerCase()}.gov
- ${businessProfile.state} unemployment insurance` : ''}

${businessProfile.employeeCount >= 15 ? `
- ADA compliance 15 employees site:ada.gov
- Title VII discrimination site:eeoc.gov` : ''}

${businessProfile.employeeCount >= 50 ? `
- FMLA family leave site:dol.gov
- ACA health insurance site:irs.gov
- Form 1095-C site:irs.gov` : ''}

ALWAYS INCLUDE:
- ${businessProfile.state} business registration site:${businessProfile.state.toLowerCase()}.gov
- ${businessProfile.city ? `${businessProfile.city} business license` : `${businessProfile.state} business license`}
- ${businessProfile.state} sales tax permit
- Federal business taxes site:irs.gov

Generate 8-12 TARGETED queries that will find REAL compliance pages.

Return JSON:
{
  "intents": ["query1", "query2", ...],
  "reasoning": "Why these specific requirements apply"
}`;

      const response = await this.model.invoke(prompt);
      
      let parsedResponse: z.infer<typeof IntentsResponseSchema>;
      
      try {
        const content = response.content as string;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = IntentsResponseSchema.parse(JSON.parse(jsonMatch[0]));
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (parseError) {
        console.error("Failed to parse AI response, using fallback", parseError);
        parsedResponse = this.getFallbackIntents(businessProfile);
      }

      console.log(`Generated ${parsedResponse.intents.length} intents for ${businessProfile.industry} in ${businessProfile.state}`);
      console.log("Reasoning:", parsedResponse.reasoning);

      // Validate and categorize intents
      const validatedIntents = await this.validator.validateIntents(
        parsedResponse.intents.slice(0, 15),
        businessProfile
      );

      // Enhance intents with categorization
      const categorizedIntents = this.categorizePrioritizeIntents(validatedIntents, businessProfile);
      
      // Add industry-specific intents if missing
      this.addIndustrySpecificIntents(categorizedIntents, businessProfile);
      
      // Ensure balanced coverage across jurisdictions
      this.balanceJurisdictionCoverage(categorizedIntents, businessProfile);
      
      console.log(`Final intent distribution:`);
      console.log(`  Federal: ${categorizedIntents.filter(i => i.category === 'federal').length}`);
      console.log(`  State: ${categorizedIntents.filter(i => i.category === 'state').length}`);
      console.log(`  Local: ${categorizedIntents.filter(i => i.category === 'local').length}`);
      console.log(`  Industry: ${categorizedIntents.filter(i => i.category === 'industry').length}`);
      
      return categorizedIntents;
    } catch (error) {
      console.error("Error discovering intents:", error);
      const fallback = this.getFallbackIntents(businessProfile);
      const validatedIntents = await this.validator.validateIntents(fallback.intents, businessProfile);
      return this.categorizePrioritizeIntents(validatedIntents, businessProfile);
    }
  }
  
  private categorizePrioritizeIntents(
    validatedIntents: ValidatedIntent[],
    businessProfile: BusinessProfile
  ): CategorizedIntent[] {
    return validatedIntents.map(intent => {
      const categorized: CategorizedIntent = {
        ...intent,
        originalQuery: intent.intent,
        enhancedQuery: this.enhanceIntentQuery(intent, businessProfile)
      };
      return categorized;
    }).sort((a, b) => {
      // Sort by priority, then by confidence
      const priorityOrder = { critical: 0, required: 1, recommended: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });
  }
  
  private enhanceIntentQuery(intent: ValidatedIntent, profile: BusinessProfile): string {
    let enhanced = intent.intent;
    
    // Clean up the query first
    enhanced = enhanced.replace(/\s+/g, ' ').trim();
    
    // Smart enhancement based on known .gov sites
    const govSiteMap: Record<string, string> = {
      'irs': 'site:irs.gov',
      'osha': 'site:osha.gov',
      'ada': 'site:ada.gov',
      'eeoc': 'site:eeoc.gov',
      'dol': 'site:dol.gov',
      'fmla': 'site:dol.gov',
      'sba': 'site:sba.gov',
      'epa': 'site:epa.gov',
      'fda': 'site:fda.gov'
    };
    
    // Add site: operator if not present and we know the site
    if (!enhanced.includes('site:')) {
      for (const [keyword, site] of Object.entries(govSiteMap)) {
        if (enhanced.toLowerCase().includes(keyword)) {
          enhanced += ` ${site}`;
          break;
        }
      }
    }
    
    // Add state .gov for state-specific queries
    if (intent.category === 'state' && !enhanced.includes('site:')) {
      const stateGov = `site:${profile.state.toLowerCase()}.gov`;
      if (!enhanced.includes(stateGov)) {
        enhanced += ` ${stateGov}`;
      }
    }
    
    // Make queries more specific but not too long
    if (enhanced.split(' ').length > 8) {
      // Trim to essential keywords
      const essential = enhanced.split(' ').filter(word => 
        word.includes('site:') || 
        word.length > 3 || 
        /\d+/.test(word) // Keep numbers
      ).slice(0, 8);
      enhanced = essential.join(' ');
    }
    
    return enhanced;
  }
  
  private addIndustrySpecificIntents(
    intents: CategorizedIntent[],
    profile: BusinessProfile
  ): void {
    const industry = profile.industry.toLowerCase();
    let templates: string[] = [];
    
    // Find matching industry templates
    for (const [key, value] of Object.entries(this.industryIntentTemplates)) {
      if (industry.includes(key)) {
        templates = value;
        break;
      }
    }
    
    if (templates.length === 0) return;
    
    // Add missing industry-specific intents
    for (const template of templates.slice(0, 3)) { // Add top 3 industry intents
      const intentText = `${profile.state} ${template}`;
      
      // Check if similar intent already exists
      const exists = intents.some(i => 
        i.intent.toLowerCase().includes(template.split(' ')[0]) ||
        i.enhancedQuery?.toLowerCase().includes(template.split(' ')[0])
      );
      
      if (!exists) {
        intents.push({
          intent: intentText,
          category: 'industry',
          priority: 'required',
          estimatedComplexity: 'medium',
          searchStrategy: 'exact',
          confidence: 0.85,
          source: 'industry_template',
          originalQuery: intentText,
          enhancedQuery: `${profile.state} ${profile.industry} ${template}`
        });
      }
    }
  }
  
  private balanceJurisdictionCoverage(
    intents: CategorizedIntent[],
    profile: BusinessProfile
  ): void {
    const counts = {
      federal: intents.filter(i => i.category === 'federal').length,
      state: intents.filter(i => i.category === 'state').length,
      local: intents.filter(i => i.category === 'local').length,
      industry: intents.filter(i => i.category === 'industry').length
    };
    
    // Ensure minimum coverage for each jurisdiction
    const minCoverage = {
      federal: 3,
      state: 3,
      local: profile.city ? 1 : 0,
      industry: 2
    };
    
    // Add generic intents if coverage is lacking
    if (counts.federal < minCoverage.federal) {
      intents.push({
        intent: "Federal business tax requirements and forms",
        category: 'federal',
        priority: 'required',
        estimatedComplexity: 'medium',
        searchStrategy: 'broad',
        confidence: 0.7,
        source: 'fallback',
        originalQuery: "Federal business tax requirements",
        enhancedQuery: `Federal business tax requirements for ${profile.industry} with ${profile.employeeCount} employees`
      });
    }
    
    if (counts.state < minCoverage.state) {
      intents.push({
        intent: `${profile.state} business registration and compliance`,
        category: 'state',
        priority: 'required',
        estimatedComplexity: 'medium',
        searchStrategy: 'broad',
        confidence: 0.7,
        source: 'fallback',
        originalQuery: `${profile.state} business requirements`,
        enhancedQuery: `${profile.state} ${profile.industry} business compliance requirements`
      });
    }
  }

  private getFallbackIntents(businessProfile: BusinessProfile): z.infer<typeof IntentsResponseSchema> {
    const intents = [
      `EIN employer identification number site:irs.gov`,
      `Form 941 quarterly taxes site:irs.gov`,
      `${businessProfile.state} business registration site:${businessProfile.state.toLowerCase()}.gov`,
      `${businessProfile.state} sales tax permit`,
      `Workers compensation ${businessProfile.state}`,
      `I-9 employment eligibility site:uscis.gov`
    ];

    // Industry-specific
    if (businessProfile.industry.toLowerCase().includes('construction')) {
      intents.push(`OSHA construction standards site:osha.gov`);
      intents.push(`${businessProfile.state} contractor license`);
    } else if (businessProfile.industry.toLowerCase().includes('restaurant') || businessProfile.industry.toLowerCase().includes('food')) {
      intents.push(`${businessProfile.state} food handler permit`);
      intents.push(`${businessProfile.state} health permit restaurant`);
    } else {
      intents.push(`OSHA workplace safety site:osha.gov`);
    }

    // Employee thresholds
    if (businessProfile.employeeCount >= 15) {
      intents.push("ADA compliance site:ada.gov");
      intents.push("Title VII EEOC site:eeoc.gov");
    }

    if (businessProfile.employeeCount >= 50) {
      intents.push("FMLA family leave site:dol.gov");
      intents.push("ACA Form 1095-C site:irs.gov");
    }

    if (businessProfile.city) {
      intents.push(`${businessProfile.city} business license`);
    }

    return {
      intents: intents.slice(0, 12), // Limit to 12 queries
      reasoning: "Core compliance requirements based on business profile"
    };
  }
}