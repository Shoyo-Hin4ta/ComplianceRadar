import { BusinessProfile } from "../types/compliance.types";

export interface ValidatedIntent {
  intent: string;
  category: 'federal' | 'state' | 'local' | 'industry';
  priority: 'critical' | 'required' | 'recommended';
  estimatedComplexity: 'low' | 'medium' | 'high';
  searchStrategy: 'exact' | 'broad' | 'reasoning';
  confidence: number;
  source: 'ai_generated' | 'threshold_based' | 'industry_template' | 'fallback';
}

export class IntentValidatorService {
  // Federal domain whitelist - authoritative sources
  private readonly federalDomains = [
    'irs.gov',      // Internal Revenue Service
    'dol.gov',      // Department of Labor
    'osha.gov',     // Occupational Safety and Health Administration
    'eeoc.gov',     // Equal Employment Opportunity Commission
    'epa.gov',      // Environmental Protection Agency
    'sba.gov',      // Small Business Administration
    'ftc.gov',      // Federal Trade Commission
    'ada.gov',      // Americans with Disabilities Act
    'hhs.gov',      // Health and Human Services
    'cms.gov',      // Centers for Medicare & Medicaid Services
    'uscis.gov',    // U.S. Citizenship and Immigration Services
    'nlrb.gov',     // National Labor Relations Board
    'federalregister.gov',
    'ecfr.gov'      // Electronic Code of Federal Regulations
  ];

  // Employee thresholds that trigger specific compliance requirements
  private readonly employeeThresholds = {
    // Federal requirements
    ADA: 15,        // Americans with Disabilities Act
    TITLEIV: 15,   // Title VII Civil Rights Act
    ADEA: 20,       // Age Discrimination in Employment Act
    COBRA: 20,      // Consolidated Omnibus Budget Reconciliation Act
    FMLA: 50,       // Family Medical Leave Act
    ACA: 50,        // Affordable Care Act
    WARN: 100,      // Worker Adjustment and Retraining Notification
    EEO1: 100,      // EEO-1 Report filing
    
    // Common state thresholds
    STATE_DISABILITY: 1,   // Most states require from 1 employee
    WORKERS_COMP: 1,       // Most states require from 1 employee
    UNEMPLOYMENT: 1,       // All states require
    STATE_FAMILY_LEAVE: 5  // Various state family leave laws
  };

  // State domain patterns
  private getStateDomains(state: string): string[] {
    const stateAbbr = this.getStateAbbreviation(state).toLowerCase();
    const stateName = state.toLowerCase().replace(/\s+/g, '');
    
    return [
      `${stateAbbr}.gov`,
      `${stateName}.gov`,
      `state.${stateAbbr}.us`,
      `${stateAbbr}.us`,
      // Common department patterns
      `labor.${stateAbbr}.gov`,
      `tax.${stateAbbr}.gov`,
      `sos.${stateAbbr}.gov`,
      `dor.${stateAbbr}.gov`,
      `dos.${stateAbbr}.gov`
    ];
  }

  // Validate and enrich intents with metadata
  async validateIntents(
    intents: string[],
    businessProfile: BusinessProfile
  ): Promise<ValidatedIntent[]> {
    const validatedIntents: ValidatedIntent[] = [];
    
    // Process AI-generated intents
    for (const intent of intents) {
      const validated = this.validateSingleIntent(intent, businessProfile);
      validatedIntents.push(validated);
    }
    
    // Add missing critical intents based on thresholds
    const additionalIntents = this.getThresholdBasedIntents(businessProfile);
    for (const intent of additionalIntents) {
      if (!validatedIntents.some(v => this.similarIntent(v.intent, intent.intent))) {
        validatedIntents.push(intent);
      }
    }
    
    // Add industry-specific required intents
    const industryIntents = this.getIndustryRequiredIntents(businessProfile);
    for (const intent of industryIntents) {
      if (!validatedIntents.some(v => this.similarIntent(v.intent, intent.intent))) {
        validatedIntents.push(intent);
      }
    }
    
    // Ensure coverage of all jurisdictions
    this.ensureJurisdictionCoverage(validatedIntents, businessProfile);
    
    // Sort by priority
    return validatedIntents.sort((a, b) => {
      const priorityOrder = { critical: 0, required: 1, recommended: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private validateSingleIntent(intent: string, profile: BusinessProfile): ValidatedIntent {
    const lowerIntent = intent.toLowerCase();
    
    // Categorize the intent
    const category = this.categorizeIntent(lowerIntent, profile);
    
    // Determine priority
    const priority = this.determinePriority(lowerIntent, profile);
    
    // Estimate complexity
    const complexity = this.estimateComplexity(lowerIntent);
    
    // Assign search strategy
    const searchStrategy = this.assignSearchStrategy(lowerIntent, complexity);
    
    return {
      intent,
      category,
      priority,
      estimatedComplexity: complexity,
      searchStrategy,
      confidence: 0.8, // AI-generated intents have 80% confidence
      source: 'ai_generated'
    };
  }

  private categorizeIntent(intent: string, profile: BusinessProfile): ValidatedIntent['category'] {
    const federalKeywords = ['federal', 'irs', 'osha', 'eeo', 'ada', 'form 94', 'i-9', 'w-'];
    const stateKeywords = ['state', profile.state.toLowerCase(), 'unemployment', 'workers comp'];
    const localKeywords = ['city', 'municipal', 'local', profile.city?.toLowerCase()];
    
    if (federalKeywords.some(kw => intent.includes(kw))) return 'federal';
    if (localKeywords.some(kw => kw && intent.includes(kw))) return 'local';
    if (stateKeywords.some(kw => kw && intent.includes(kw))) return 'state';
    
    // Industry-specific usually maps to multiple jurisdictions
    return 'industry';
  }

  private determinePriority(intent: string, profile: BusinessProfile): ValidatedIntent['priority'] {
    // Critical: Tax, payroll, safety, discrimination
    const criticalKeywords = ['tax', '941', 'payroll', 'safety', 'osha', 'discrimination', 
                             'workers comp', 'unemployment', 'ein', 'business license'];
    
    // Required: Licenses, permits, registrations
    const requiredKeywords = ['license', 'permit', 'registration', 'certificate', 
                             'insurance', 'bond', 'filing'];
    
    if (criticalKeywords.some(kw => intent.includes(kw))) return 'critical';
    if (requiredKeywords.some(kw => intent.includes(kw))) return 'required';
    
    return 'recommended';
  }

  private estimateComplexity(intent: string): ValidatedIntent['estimatedComplexity'] {
    // Complex queries have multiple requirements or need deep analysis
    const complexIndicators = ['comprehensive', 'all', 'complete', 'detailed', 'full', 
                               'and', 'plus', 'with', 'including'];
    
    // Simple queries are direct lookups
    const simpleIndicators = ['form', 'deadline', 'fee', 'address', 'phone', 'basic'];
    
    const complexCount = complexIndicators.filter(ind => intent.includes(ind)).length;
    const simpleCount = simpleIndicators.filter(ind => intent.includes(ind)).length;
    
    if (complexCount >= 2 || intent.length > 50) return 'high';
    if (simpleCount >= 2 || intent.split(' ').length <= 3) return 'low';
    
    return 'medium';
  }

  private assignSearchStrategy(intent: string, complexity: ValidatedIntent['estimatedComplexity']): ValidatedIntent['searchStrategy'] {
    // Reasoning needed for "how", "why", "when" questions
    const reasoningKeywords = ['how to', 'why', 'when', 'what if', 'calculate', 'determine'];
    
    if (reasoningKeywords.some(kw => intent.includes(kw))) {
      return 'reasoning';
    }
    
    // Exact search for specific forms or requirements
    if (intent.match(/form [0-9]/i) || intent.includes('specific')) {
      return 'exact';
    }
    
    // Broad search for comprehensive requirements
    return complexity === 'high' ? 'broad' : 'exact';
  }

  private getThresholdBasedIntents(profile: BusinessProfile): ValidatedIntent[] {
    const intents: ValidatedIntent[] = [];
    const employees = profile.employeeCount || 0;
    
    // Always required for any business
    intents.push({
      intent: "Federal EIN tax identification number requirements",
      category: 'federal',
      priority: 'critical',
      estimatedComplexity: 'low',
      searchStrategy: 'exact',
      confidence: 1.0,
      source: 'threshold_based'
    });
    
    // Employee-based requirements
    if (employees >= 1) {
      intents.push({
        intent: `${profile.state} workers compensation insurance requirements`,
        category: 'state',
        priority: 'critical',
        estimatedComplexity: 'medium',
        searchStrategy: 'exact',
        confidence: 1.0,
        source: 'threshold_based'
      });
      
      intents.push({
        intent: "Form 941 quarterly federal tax return",
        category: 'federal',
        priority: 'critical',
        estimatedComplexity: 'low',
        searchStrategy: 'exact',
        confidence: 1.0,
        source: 'threshold_based'
      });
    }
    
    if (employees >= this.employeeThresholds.ADA) {
      intents.push({
        intent: "ADA Americans with Disabilities Act compliance requirements",
        category: 'federal',
        priority: 'critical',
        estimatedComplexity: 'high',
        searchStrategy: 'broad',
        confidence: 1.0,
        source: 'threshold_based'
      });
    }
    
    if (employees >= this.employeeThresholds.FMLA) {
      intents.push({
        intent: "FMLA Family Medical Leave Act requirements",
        category: 'federal',
        priority: 'required',
        estimatedComplexity: 'medium',
        searchStrategy: 'exact',
        confidence: 1.0,
        source: 'threshold_based'
      });
    }
    
    if (employees >= this.employeeThresholds.ACA) {
      intents.push({
        intent: "ACA Affordable Care Act employer mandate",
        category: 'federal',
        priority: 'critical',
        estimatedComplexity: 'high',
        searchStrategy: 'broad',
        confidence: 1.0,
        source: 'threshold_based'
      });
    }
    
    return intents;
  }

  private getIndustryRequiredIntents(profile: BusinessProfile): ValidatedIntent[] {
    const industry = profile.industry?.toLowerCase() || '';
    const intents: ValidatedIntent[] = [];
    
    // Restaurant/Food Service
    if (industry.includes('restaurant') || industry.includes('food')) {
      intents.push(
        {
          intent: `${profile.state} health permit and food handler license`,
          category: 'state',
          priority: 'critical',
          estimatedComplexity: 'medium',
          searchStrategy: 'exact',
          confidence: 0.9,
          source: 'industry_template'
        },
        {
          intent: "FDA food safety and HACCP requirements",
          category: 'federal',
          priority: 'critical',
          estimatedComplexity: 'high',
          searchStrategy: 'broad',
          confidence: 0.9,
          source: 'industry_template'
        }
      );
      
      if (profile.specialFactors?.includes('alcohol')) {
        intents.push({
          intent: `${profile.state} ABC alcohol beverage control license`,
          category: 'state',
          priority: 'critical',
          estimatedComplexity: 'high',
          searchStrategy: 'exact',
          confidence: 0.95,
          source: 'industry_template'
        });
      }
    }
    
    // Construction
    if (industry.includes('construction') || industry.includes('contractor')) {
      intents.push(
        {
          intent: `${profile.state} contractor license requirements`,
          category: 'state',
          priority: 'critical',
          estimatedComplexity: 'high',
          searchStrategy: 'exact',
          confidence: 0.9,
          source: 'industry_template'
        },
        {
          intent: "OSHA construction industry safety standards",
          category: 'federal',
          priority: 'critical',
          estimatedComplexity: 'high',
          searchStrategy: 'broad',
          confidence: 0.95,
          source: 'industry_template'
        }
      );
    }
    
    // Healthcare
    if (industry.includes('health') || industry.includes('medical')) {
      intents.push(
        {
          intent: "HIPAA privacy and security compliance",
          category: 'federal',
          priority: 'critical',
          estimatedComplexity: 'high',
          searchStrategy: 'broad',
          confidence: 1.0,
          source: 'industry_template'
        },
        {
          intent: `${profile.state} medical waste disposal requirements`,
          category: 'state',
          priority: 'required',
          estimatedComplexity: 'medium',
          searchStrategy: 'exact',
          confidence: 0.9,
          source: 'industry_template'
        }
      );
    }
    
    // Retail
    if (industry.includes('retail') || industry.includes('store')) {
      intents.push({
        intent: `${profile.state} sales tax permit and resale certificate`,
        category: 'state',
        priority: 'critical',
        estimatedComplexity: 'low',
        searchStrategy: 'exact',
        confidence: 0.95,
        source: 'industry_template'
      });
    }
    
    return intents;
  }

  private ensureJurisdictionCoverage(intents: ValidatedIntent[], profile: BusinessProfile): void {
    const categories = new Set(intents.map(i => i.category));
    
    // Ensure we have at least one intent for each jurisdiction
    if (!categories.has('federal')) {
      intents.push({
        intent: "Federal business tax requirements and forms",
        category: 'federal',
        priority: 'required',
        estimatedComplexity: 'medium',
        searchStrategy: 'broad',
        confidence: 0.7,
        source: 'fallback'
      });
    }
    
    if (!categories.has('state')) {
      intents.push({
        intent: `${profile.state} business registration and licensing`,
        category: 'state',
        priority: 'required',
        estimatedComplexity: 'medium',
        searchStrategy: 'broad',
        confidence: 0.7,
        source: 'fallback'
      });
    }
    
    if (!categories.has('local') && profile.city) {
      intents.push({
        intent: `${profile.city} business license and permits`,
        category: 'local',
        priority: 'recommended',
        estimatedComplexity: 'low',
        searchStrategy: 'exact',
        confidence: 0.6,
        source: 'fallback'
      });
    }
  }

  private similarIntent(intent1: string, intent2: string): boolean {
    // Simple similarity check - can be enhanced with better NLP
    const words1 = new Set(intent1.toLowerCase().split(/\s+/));
    const words2 = new Set(intent2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    const jaccard = intersection.size / union.size;
    return jaccard > 0.5; // 50% similarity threshold
  }

  private getStateAbbreviation(state: string): string {
    const stateMap: Record<string, string> = {
      "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
      "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
      "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
      "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
      "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
      "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
      "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
      "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
      "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
      "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
      "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
      "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
      "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC"
    };
    
    return stateMap[state] || state.substring(0, 2).toUpperCase();
  }

  // Get all valid government domains for a business
  getAllValidDomains(state: string): string[] {
    return [...this.federalDomains, ...this.getStateDomains(state)];
  }
}