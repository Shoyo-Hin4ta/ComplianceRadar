import { z } from 'zod';
import { BusinessProfile, Requirement as ComplianceRequirement } from '../types/compliance.types';

const GapAnalysisSchema = z.object({
  category: z.enum(['federal', 'state', 'local', 'industry']),
  requirement: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  penalty: z.string().optional(),
  description: z.string(),
  suggestedIntents: z.array(z.string()),
  applicableConditions: z.object({
    minEmployees: z.number().optional(),
    maxEmployees: z.number().optional(),
    industry: z.string().optional(),
    state: z.string().optional(),
    hasPhysicalLocation: z.boolean().optional(),
    revenue: z.number().optional(),
  }),
});

export type GapAnalysis = z.infer<typeof GapAnalysisSchema>;

interface ExpectedRequirement {
  id: string;
  category: 'federal' | 'state' | 'local' | 'industry';
  requirement: string;
  conditions: {
    minEmployees?: number;
    maxEmployees?: number;
    industry?: string;
    state?: string;
    hasPhysicalLocation?: boolean;
    revenue?: number;
  };
  priority: 'critical' | 'required' | 'recommended';
  citation?: string;
  penalty?: string;
  description: string;
}

export class GapAnalysisService {
  private knowledgeBase: ExpectedRequirement[] = [
    // Federal Requirements - All Businesses
    {
      id: 'fed-ein',
      category: 'federal',
      requirement: 'Employer Identification Number (EIN)',
      conditions: {},
      priority: 'critical',
      citation: '26 USC 6109',
      penalty: 'Unable to operate legally without EIN',
      description: 'Required for tax filing and hiring employees',
    },
    {
      id: 'fed-income-tax',
      category: 'federal',
      requirement: 'Federal Income Tax Filing',
      conditions: {},
      priority: 'critical',
      citation: '26 USC 1',
      penalty: 'Penalties and interest on unpaid taxes',
      description: 'Annual tax return filing requirement',
    },
    
    // Federal Requirements - With Employees
    {
      id: 'fed-w4',
      category: 'federal',
      requirement: 'Form W-4 for Employees',
      conditions: { minEmployees: 1 },
      priority: 'critical',
      citation: '26 USC 3402',
      penalty: 'Up to $250 per W-4 not filed',
      description: 'Employee withholding certificate',
    },
    {
      id: 'fed-i9',
      category: 'federal',
      requirement: 'Form I-9 Employment Eligibility',
      conditions: { minEmployees: 1 },
      priority: 'critical',
      citation: '8 USC 1324a',
      penalty: '$234-$2,332 per employee',
      description: 'Verify employment authorization',
    },
    {
      id: 'fed-workers-comp',
      category: 'federal',
      requirement: 'Workers Compensation Insurance',
      conditions: { minEmployees: 1 },
      priority: 'critical',
      penalty: 'Varies by state, can include criminal charges',
      description: 'Required in most states for businesses with employees',
    },
    {
      id: 'fed-941',
      category: 'federal',
      requirement: 'Form 941 - Quarterly Employment Tax',
      conditions: { minEmployees: 1 },
      priority: 'critical',
      citation: '26 CFR 31.6011(a)-1',
      penalty: 'Up to 15% of unpaid taxes',
      description: 'Report wages and withhold taxes quarterly',
    },
    
    // Federal Requirements - 15+ Employees
    {
      id: 'fed-ada',
      category: 'federal',
      requirement: 'ADA Compliance',
      conditions: { minEmployees: 15 },
      priority: 'critical',
      citation: '42 USC 12111',
      penalty: 'Up to $75,000 first violation, $150,000 subsequent',
      description: 'Americans with Disabilities Act compliance',
    },
    {
      id: 'fed-title-vii',
      category: 'federal',
      requirement: 'Title VII Civil Rights Compliance',
      conditions: { minEmployees: 15 },
      priority: 'critical',
      citation: '42 USC 2000e',
      penalty: 'Compensatory and punitive damages up to $300,000',
      description: 'Prohibit discrimination based on protected characteristics',
    },
    
    // Federal Requirements - 20+ Employees
    {
      id: 'fed-adea',
      category: 'federal',
      requirement: 'Age Discrimination Act Compliance',
      conditions: { minEmployees: 20 },
      priority: 'critical',
      citation: '29 USC 621',
      penalty: 'Back pay, liquidated damages, attorney fees',
      description: 'Prohibit age discrimination for workers 40+',
    },
    {
      id: 'fed-cobra',
      category: 'federal',
      requirement: 'COBRA Health Insurance',
      conditions: { minEmployees: 20 },
      priority: 'required',
      citation: '29 USC 1161',
      penalty: '$100-200 per day per beneficiary',
      description: 'Continuation of health coverage',
    },
    
    // Federal Requirements - 50+ Employees
    {
      id: 'fed-fmla',
      category: 'federal',
      requirement: 'Family Medical Leave Act',
      conditions: { minEmployees: 50 },
      priority: 'critical',
      citation: '29 USC 2601',
      penalty: 'Back pay, liquidated damages, attorney fees',
      description: '12 weeks unpaid leave for qualifying events',
    },
    {
      id: 'fed-eeo1',
      category: 'federal',
      requirement: 'EEO-1 Report Filing',
      conditions: { minEmployees: 50 },
      priority: 'required',
      citation: '42 USC 2000e-8',
      penalty: 'Court orders, contempt charges',
      description: 'Annual workforce demographics report',
    },
    {
      id: 'fed-aca',
      category: 'federal',
      requirement: 'Affordable Care Act',
      conditions: { minEmployees: 50 },
      priority: 'critical',
      citation: '26 USC 4980H',
      penalty: '$2,970 per employee annually',
      description: 'Provide health insurance or pay penalty',
    },
    
    // Federal Requirements - 100+ Employees
    {
      id: 'fed-warn',
      category: 'federal',
      requirement: 'WARN Act Notice',
      conditions: { minEmployees: 100 },
      priority: 'critical',
      citation: '29 USC 2101',
      penalty: 'Back pay and benefits for up to 60 days',
      description: '60-day notice for mass layoffs',
    },
    {
      id: 'fed-eeo-federal-contractor',
      category: 'federal',
      requirement: 'Federal Contractor Compliance',
      conditions: { minEmployees: 100 },
      priority: 'required',
      citation: '41 CFR 60',
      penalty: 'Contract cancellation, debarment',
      description: 'Affirmative action requirements for federal contractors',
    },
    
    // Industry-Specific Requirements
    {
      id: 'ind-food-permit',
      category: 'industry',
      requirement: 'Food Service Permit',
      conditions: { industry: 'restaurant' },
      priority: 'critical',
      penalty: 'Immediate closure, fines up to $10,000',
      description: 'Health department permit for food service',
    },
    {
      id: 'ind-food-handler',
      category: 'industry',
      requirement: 'Food Handler Certification',
      conditions: { industry: 'restaurant' },
      priority: 'critical',
      penalty: 'Fines $100-1,000 per violation',
      description: 'Staff food safety certification',
    },
    {
      id: 'ind-liquor-license',
      category: 'industry',
      requirement: 'Liquor License',
      conditions: { industry: 'restaurant' },
      priority: 'required',
      penalty: 'Criminal charges, fines up to $10,000',
      description: 'Required for alcohol sales',
    },
    {
      id: 'ind-construction-license',
      category: 'industry',
      requirement: 'Contractor License',
      conditions: { industry: 'construction' },
      priority: 'critical',
      penalty: 'Fines up to $15,000, criminal charges',
      description: 'State contractor licensing',
    },
    {
      id: 'ind-osha-construction',
      category: 'industry',
      requirement: 'OSHA Construction Standards',
      conditions: { industry: 'construction' },
      priority: 'critical',
      citation: '29 CFR 1926',
      penalty: 'Up to $156,259 per violation',
      description: 'Construction safety standards',
    },
    {
      id: 'ind-hipaa',
      category: 'industry',
      requirement: 'HIPAA Compliance',
      conditions: { industry: 'healthcare' },
      priority: 'critical',
      citation: '45 CFR 160-164',
      penalty: '$100-$50,000 per violation, max $2M/year',
      description: 'Patient privacy and security',
    },
    {
      id: 'ind-retail-sales-permit',
      category: 'industry',
      requirement: 'Sales Tax Permit',
      conditions: { industry: 'retail' },
      priority: 'critical',
      penalty: 'Fines, criminal charges, business closure',
      description: 'Permit to collect sales tax',
    },
    
    // State-Specific Requirements (California)
    {
      id: 'ca-business-license',
      category: 'state',
      requirement: 'California Business License',
      conditions: { state: 'CA' },
      priority: 'critical',
      penalty: 'Fines up to $1,000, business closure',
      description: 'State business registration',
    },
    {
      id: 'ca-llc-tax',
      category: 'state',
      requirement: 'California LLC Tax ($800)',
      conditions: { state: 'CA' },
      priority: 'critical',
      penalty: 'Penalties and interest on unpaid tax',
      description: 'Annual minimum franchise tax',
    },
    {
      id: 'ca-workers-comp',
      category: 'state',
      requirement: 'California Workers Comp',
      conditions: { state: 'CA', minEmployees: 1 },
      priority: 'critical',
      penalty: 'Up to $100,000 fine, imprisonment',
      description: 'Mandatory workers compensation insurance',
    },
    {
      id: 'ca-wage-order',
      category: 'state',
      requirement: 'California Wage Orders',
      conditions: { state: 'CA', minEmployees: 1 },
      priority: 'critical',
      penalty: '$50-$200 per employee per pay period',
      description: 'Minimum wage, overtime, meal/rest breaks',
    },
    {
      id: 'ca-harassment-training',
      category: 'state',
      requirement: 'CA Harassment Prevention Training',
      conditions: { state: 'CA', minEmployees: 5 },
      priority: 'required',
      citation: 'CA Gov Code 12950.1',
      penalty: 'DFEH enforcement action',
      description: 'Biennial sexual harassment training',
    },
    {
      id: 'ca-prop65',
      category: 'state',
      requirement: 'Proposition 65 Warnings',
      conditions: { state: 'CA', minEmployees: 10 },
      priority: 'required',
      penalty: 'Up to $2,500 per day per violation',
      description: 'Chemical exposure warnings',
    },
    
    // State-Specific Requirements (Texas)
    {
      id: 'tx-franchise-tax',
      category: 'state',
      requirement: 'Texas Franchise Tax',
      conditions: { state: 'TX' },
      priority: 'critical',
      penalty: 'Penalties and interest on unpaid tax',
      description: 'Annual franchise tax report',
    },
    {
      id: 'tx-sales-permit',
      category: 'state',
      requirement: 'Texas Sales Tax Permit',
      conditions: { state: 'TX' },
      priority: 'critical',
      penalty: 'Criminal charges, fines',
      description: 'Permit for collecting sales tax',
    },
    
    // State-Specific Requirements (New York)
    {
      id: 'ny-business-cert',
      category: 'state',
      requirement: 'NY Business Certificate',
      conditions: { state: 'NY' },
      priority: 'critical',
      penalty: 'Unable to enforce contracts',
      description: 'DBA filing requirement',
    },
    {
      id: 'ny-workers-comp',
      category: 'state',
      requirement: 'NY Workers Compensation',
      conditions: { state: 'NY', minEmployees: 1 },
      priority: 'critical',
      penalty: '$1,000-$5,000 per 10 days',
      description: 'Mandatory workers comp coverage',
    },
    {
      id: 'ny-disability',
      category: 'state',
      requirement: 'NY Disability Insurance',
      conditions: { state: 'NY', minEmployees: 1 },
      priority: 'critical',
      penalty: '0.5% of wages as penalty',
      description: 'Short-term disability coverage',
    },
    {
      id: 'ny-paid-family-leave',
      category: 'state',
      requirement: 'NY Paid Family Leave',
      conditions: { state: 'NY', minEmployees: 1 },
      priority: 'critical',
      penalty: 'Penalties and employee lawsuits',
      description: 'Paid family leave insurance',
    },
    {
      id: 'ny-sexual-harassment',
      category: 'state',
      requirement: 'NY Sexual Harassment Policy',
      conditions: { state: 'NY', minEmployees: 1 },
      priority: 'required',
      penalty: 'State enforcement action',
      description: 'Written policy and annual training',
    },
  ];

  analyzeGaps(
    foundRequirements: ComplianceRequirement[],
    businessProfile: BusinessProfile
  ): GapAnalysis[] {
    const expectedRequirements = this.getExpectedRequirements(businessProfile);
    const gaps: GapAnalysis[] = [];

    // Create a map of found requirements for quick lookup
    const foundMap = new Map(
      foundRequirements.map(req => [
        this.normalizeRequirementKey(req.requirement),
        req,
      ])
    );

    // Check each expected requirement
    for (const expected of expectedRequirements) {
      const found = this.findMatchingRequirement(expected, foundRequirements, foundMap);
      
      if (!found) {
        gaps.push({
          category: expected.category,
          requirement: expected.requirement,
          severity: this.calculateSeverity(expected),
          penalty: expected.penalty,
          description: expected.description,
          suggestedIntents: this.generateSearchIntents(expected, businessProfile),
          applicableConditions: expected.conditions,
        });
      }
    }

    return this.prioritizeGaps(gaps);
  }

  private getExpectedRequirements(profile: BusinessProfile): ExpectedRequirement[] {
    return this.knowledgeBase.filter(req => {
      const conditions = req.conditions;
      
      // Check employee count
      if (conditions.minEmployees !== undefined && profile.employees < conditions.minEmployees) {
        return false;
      }
      if (conditions.maxEmployees !== undefined && profile.employees > conditions.maxEmployees) {
        return false;
      }
      
      // Check state
      if (conditions.state && profile.state !== conditions.state) {
        return false;
      }
      
      // Check industry
      if (conditions.industry && profile.industry !== conditions.industry) {
        return false;
      }
      
      // Check physical location
      if (conditions.hasPhysicalLocation !== undefined && 
          profile.hasPhysicalLocation !== conditions.hasPhysicalLocation) {
        return false;
      }
      
      // Check revenue
      if (conditions.revenue !== undefined && profile.revenue && 
          profile.revenue < conditions.revenue) {
        return false;
      }
      
      return true;
    });
  }

  private findMatchingRequirement(
    expected: ExpectedRequirement,
    foundRequirements: ComplianceRequirement[],
    foundMap: Map<string, ComplianceRequirement>
  ): ComplianceRequirement | null {
    // Try exact match first
    const exactMatch = foundMap.get(this.normalizeRequirementKey(expected.requirement));
    if (exactMatch) return exactMatch;
    
    // Try fuzzy matching
    const keywords = this.extractKeywords(expected.requirement);
    for (const found of foundRequirements) {
      const foundKeywords = this.extractKeywords(found.requirement);
      const overlap = this.calculateKeywordOverlap(keywords, foundKeywords);
      
      // If we have significant overlap and matching category
      if (overlap > 0.7 && found.category === expected.category) {
        return found;
      }
      
      // Check if citation matches
      if (expected.citation && found.citation) {
        if (this.normalizeCitation(expected.citation) === this.normalizeCitation(found.citation)) {
          return found;
        }
      }
    }
    
    return null;
  }

  private normalizeRequirementKey(requirement: string): string {
    return requirement
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  private extractKeywords(text: string): Set<string> {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    return new Set(
      text
        .toLowerCase()
        .split(/\s+/)
        .map(word => word.replace(/[^a-z0-9]/g, ''))
        .filter(word => word.length > 2 && !stopWords.has(word))
    );
  }

  private calculateKeywordOverlap(set1: Set<string>, set2: Set<string>): number {
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private normalizeCitation(citation: string): string {
    return citation
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  private calculateSeverity(requirement: ExpectedRequirement): 'critical' | 'high' | 'medium' | 'low' {
    // Critical if it's marked as critical priority
    if (requirement.priority === 'critical') return 'critical';
    
    // High if there's a significant penalty
    if (requirement.penalty && requirement.penalty.includes('criminal')) return 'critical';
    if (requirement.penalty && requirement.penalty.includes('closure')) return 'critical';
    if (requirement.penalty && (
      requirement.penalty.includes('$10,000') ||
      requirement.penalty.includes('$50,000') ||
      requirement.penalty.includes('$100,000')
    )) return 'high';
    
    // Medium if required
    if (requirement.priority === 'required') return 'medium';
    
    // Low otherwise
    return 'low';
  }

  private generateSearchIntents(
    requirement: ExpectedRequirement,
    profile: BusinessProfile
  ): string[] {
    const intents: string[] = [];
    const state = profile.state;
    const industry = profile.industry;
    
    // Generate base intent
    intents.push(`${requirement.requirement} requirements`);
    
    // Add state-specific intent if applicable
    if (requirement.category === 'state' && state) {
      intents.push(`${state} ${requirement.requirement}`);
    }
    
    // Add industry-specific intent
    if (requirement.category === 'industry' && industry) {
      intents.push(`${industry} ${requirement.requirement}`);
    }
    
    // Add citation-based intent if available
    if (requirement.citation) {
      intents.push(`${requirement.citation} compliance requirements`);
    }
    
    // Add employee threshold intent
    if (requirement.conditions.minEmployees) {
      intents.push(`${requirement.requirement} ${requirement.conditions.minEmployees} employees`);
    }
    
    return intents;
  }

  private prioritizeGaps(gaps: GapAnalysis[]): GapAnalysis[] {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const categoryOrder = { federal: 0, state: 1, industry: 2, local: 3 };
    
    return gaps.sort((a, b) => {
      // First sort by severity
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      // Then by category
      return categoryOrder[a.category] - categoryOrder[b.category];
    });
  }

  getKnowledgeBaseStats(): {
    totalRequirements: number;
    byCategory: Record<string, number>;
    byEmployeeThreshold: Record<string, number>;
  } {
    const byCategory: Record<string, number> = {};
    const byEmployeeThreshold: Record<string, number> = {};
    
    for (const req of this.knowledgeBase) {
      byCategory[req.category] = (byCategory[req.category] || 0) + 1;
      
      const threshold = req.conditions.minEmployees || 0;
      const key = `${threshold}+ employees`;
      byEmployeeThreshold[key] = (byEmployeeThreshold[key] || 0) + 1;
    }
    
    return {
      totalRequirements: this.knowledgeBase.length,
      byCategory,
      byEmployeeThreshold,
    };
  }
}