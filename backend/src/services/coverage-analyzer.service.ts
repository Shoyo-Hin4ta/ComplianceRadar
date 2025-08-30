import { BusinessProfile, Requirement } from "../types/compliance.types";

export interface CoverageDetail {
  found: number;
  expected: number;
  percentage: number;
  requirements: string[];
  missingRequirements: string[];
}

export interface CoverageReport {
  overallScore: number;
  jurisdictionCoverage: {
    federal: CoverageDetail;
    state: CoverageDetail;
    local: CoverageDetail;
  };
  industryCoverage: {
    score: number;
    expectedRequirements: string[];
    foundRequirements: string[];
    missingRequirements: string[];
  };
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
    unverified: number;
  };
  gaps: GapAnalysis[];
  recommendations: string[];
  riskAssessment: 'low' | 'medium' | 'high' | 'critical';
  completenessScore: number;
  dataQualityScore: number;
}

export interface GapAnalysis {
  area: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  expectedRequirement: string;
  potentialPenalty?: string;
  suggestedAction: string;
  searchIntent?: string;
}

export interface ExpectedRequirement {
  category: 'federal' | 'state' | 'local' | 'industry';
  requirement: string;
  conditions: {
    minEmployees?: number;
    maxEmployees?: number;
    industry?: string[];
    state?: string[];
    revenue?: number;
  };
  priority: 'critical' | 'required' | 'recommended';
  commonName?: string;
  citation?: string;
}

export class CoverageAnalyzerService {
  // Comprehensive database of expected requirements
  private readonly expectedRequirements: ExpectedRequirement[] = [
    // Federal Requirements - All Businesses
    {
      category: 'federal',
      requirement: 'Employer Identification Number (EIN)',
      conditions: {},
      priority: 'critical',
      commonName: 'Federal Tax ID',
      citation: '26 USC § 6109'
    },
    {
      category: 'federal',
      requirement: 'Federal Income Tax Filing',
      conditions: {},
      priority: 'critical',
      commonName: 'Form 1040, 1065, or 1120',
      citation: '26 USC § 6011'
    },
    
    // Federal Requirements - With Employees
    {
      category: 'federal',
      requirement: 'Form 941 - Quarterly Federal Tax Return',
      conditions: { minEmployees: 1 },
      priority: 'critical',
      commonName: 'Payroll Tax Filing',
      citation: '26 CFR 31.6011(a)-1'
    },
    {
      category: 'federal',
      requirement: 'Form W-2 - Wage and Tax Statement',
      conditions: { minEmployees: 1 },
      priority: 'critical',
      citation: '26 USC § 6051'
    },
    {
      category: 'federal',
      requirement: 'Form I-9 - Employment Eligibility Verification',
      conditions: { minEmployees: 1 },
      priority: 'critical',
      citation: '8 USC § 1324a'
    },
    {
      category: 'federal',
      requirement: 'Workers Compensation Insurance',
      conditions: { minEmployees: 1 },
      priority: 'critical'
    },
    
    // Federal Threshold-Based Requirements
    {
      category: 'federal',
      requirement: 'ADA Compliance',
      conditions: { minEmployees: 15 },
      priority: 'critical',
      commonName: 'Americans with Disabilities Act',
      citation: '42 USC § 12111'
    },
    {
      category: 'federal',
      requirement: 'Title VII - Equal Employment',
      conditions: { minEmployees: 15 },
      priority: 'critical',
      citation: '42 USC § 2000e'
    },
    {
      category: 'federal',
      requirement: 'COBRA Health Coverage',
      conditions: { minEmployees: 20 },
      priority: 'required',
      citation: '29 USC § 1161'
    },
    {
      category: 'federal',
      requirement: 'FMLA - Family Medical Leave',
      conditions: { minEmployees: 50 },
      priority: 'required',
      citation: '29 USC § 2601'
    },
    {
      category: 'federal',
      requirement: 'ACA - Affordable Care Act',
      conditions: { minEmployees: 50 },
      priority: 'critical',
      citation: '26 USC § 4980H'
    },
    {
      category: 'federal',
      requirement: 'EEO-1 Report',
      conditions: { minEmployees: 100 },
      priority: 'required',
      citation: '42 USC § 2000e-8'
    },
    
    // Industry-Specific Federal
    {
      category: 'industry',
      requirement: 'FDA Food Safety Compliance',
      conditions: { industry: ['restaurant', 'food service', 'food manufacturing'] },
      priority: 'critical',
      citation: '21 CFR Part 110'
    },
    {
      category: 'industry',
      requirement: 'OSHA Construction Standards',
      conditions: { industry: ['construction', 'contractor'] },
      priority: 'critical',
      citation: '29 CFR Part 1926'
    },
    {
      category: 'industry',
      requirement: 'HIPAA Privacy & Security',
      conditions: { industry: ['healthcare', 'medical', 'dental'] },
      priority: 'critical',
      citation: '45 CFR Part 160, 164'
    }
  ];

  analyzeCoverage(
    requirements: Requirement[],
    businessProfile: BusinessProfile
  ): CoverageReport {
    // Get expected requirements for this business
    const expected = this.getExpectedRequirements(businessProfile);
    
    // Calculate jurisdiction coverage
    const jurisdictionCoverage = this.calculateJurisdictionCoverage(requirements, expected, businessProfile);
    
    // Calculate industry coverage
    const industryCoverage = this.calculateIndustryCoverage(requirements, expected, businessProfile);
    
    // Calculate confidence distribution
    const confidenceDistribution = this.calculateConfidenceDistribution(requirements);
    
    // Identify gaps
    const gaps = this.identifyGaps(requirements, expected, businessProfile);
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore(
      jurisdictionCoverage,
      industryCoverage,
      confidenceDistribution
    );
    
    // Assess risk level
    const riskAssessment = this.assessRisk(gaps, overallScore);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(gaps, requirements);
    
    // Calculate completeness and quality scores
    const completenessScore = this.calculateCompletenessScore(requirements, expected);
    const dataQualityScore = this.calculateDataQualityScore(requirements);
    
    return {
      overallScore,
      jurisdictionCoverage,
      industryCoverage,
      confidenceDistribution,
      gaps,
      recommendations,
      riskAssessment,
      completenessScore,
      dataQualityScore
    };
  }

  private getExpectedRequirements(profile: BusinessProfile): ExpectedRequirement[] {
    return this.expectedRequirements.filter(req => {
      const conditions = req.conditions;
      
      // Check employee count
      if (conditions.minEmployees && profile.employeeCount < conditions.minEmployees) {
        return false;
      }
      if (conditions.maxEmployees && profile.employeeCount > conditions.maxEmployees) {
        return false;
      }
      
      // Check industry
      if (conditions.industry && conditions.industry.length > 0) {
        const industryLower = profile.industry.toLowerCase();
        if (!conditions.industry.some(ind => industryLower.includes(ind))) {
          return false;
        }
      }
      
      // Check state
      if (conditions.state && conditions.state.length > 0) {
        if (!conditions.state.includes(profile.state)) {
          return false;
        }
      }
      
      // Check revenue
      if (conditions.revenue && profile.annualRevenue) {
        if (profile.annualRevenue < conditions.revenue) {
          return false;
        }
      }
      
      return true;
    });
  }

  private calculateJurisdictionCoverage(
    requirements: Requirement[],
    expected: ExpectedRequirement[],
    profile: BusinessProfile
  ): CoverageReport['jurisdictionCoverage'] {
    const coverage = {
      federal: this.calculateCategoryDetail('federal', requirements, expected),
      state: this.calculateCategoryDetail('state', requirements, expected, profile.state),
      local: this.calculateCategoryDetail('local', requirements, expected, profile.city)
    };
    
    return coverage;
  }

  private calculateCategoryDetail(
    category: string,
    requirements: Requirement[],
    expected: ExpectedRequirement[],
    location?: string
  ): CoverageDetail {
    const categoryRequirements = requirements.filter(r => {
      const sourceType = r.sourceType?.toLowerCase() || '';
      if (category === 'federal') return sourceType.includes('federal');
      if (category === 'state') return sourceType.includes('state');
      if (category === 'local') return sourceType.includes('local') || sourceType.includes('city');
      return false;
    });
    
    const expectedCategory = expected.filter(e => e.category === category);
    
    const foundRequirements = categoryRequirements.map(r => r.name);
    const expectedRequirements = expectedCategory.map(e => e.commonName || e.requirement);
    
    const missingRequirements = expectedRequirements.filter(
      req => !foundRequirements.some(found => 
        this.requirementMatches(found, req)
      )
    );
    
    const found = categoryRequirements.length;
    const expectedCount = expectedCategory.filter(e => e.priority !== 'recommended').length;
    const percentage = expectedCount > 0 ? (found / expectedCount) * 100 : 100;
    
    return {
      found,
      expected: expectedCount,
      percentage: Math.min(100, Math.round(percentage)),
      requirements: foundRequirements,
      missingRequirements
    };
  }

  private calculateIndustryCoverage(
    requirements: Requirement[],
    expected: ExpectedRequirement[],
    profile: BusinessProfile
  ): CoverageReport['industryCoverage'] {
    const industryExpected = expected.filter(e => 
      e.category === 'industry' || 
      (e.conditions.industry && e.conditions.industry.length > 0)
    );
    
    const foundIndustryReqs: string[] = [];
    const expectedIndustryReqs = industryExpected.map(e => e.commonName || e.requirement);
    
    // Check if industry requirements are covered
    for (const req of requirements) {
      for (const expectedReq of industryExpected) {
        if (this.requirementMatches(req.name, expectedReq.requirement)) {
          foundIndustryReqs.push(expectedReq.commonName || expectedReq.requirement);
        }
      }
    }
    
    const missingRequirements = expectedIndustryReqs.filter(
      req => !foundIndustryReqs.includes(req)
    );
    
    const score = expectedIndustryReqs.length > 0
      ? (foundIndustryReqs.length / expectedIndustryReqs.length) * 100
      : 100;
    
    return {
      score: Math.round(score),
      expectedRequirements: expectedIndustryReqs,
      foundRequirements: foundIndustryReqs,
      missingRequirements
    };
  }

  private calculateConfidenceDistribution(requirements: Requirement[]): CoverageReport['confidenceDistribution'] {
    const total = requirements.length || 1;
    
    const distribution = {
      high: requirements.filter(r => r.confidenceLevel === 'HIGH').length,
      medium: requirements.filter(r => r.confidenceLevel === 'MEDIUM').length,
      low: requirements.filter(r => r.confidenceLevel === 'LOW').length,
      unverified: requirements.filter(r => !r.confidenceLevel || r.confidenceLevel === 'UNVERIFIED').length
    };
    
    return {
      high: Math.round((distribution.high / total) * 100),
      medium: Math.round((distribution.medium / total) * 100),
      low: Math.round((distribution.low / total) * 100),
      unverified: Math.round((distribution.unverified / total) * 100)
    };
  }

  private identifyGaps(
    requirements: Requirement[],
    expected: ExpectedRequirement[],
    profile: BusinessProfile
  ): GapAnalysis[] {
    const gaps: GapAnalysis[] = [];
    const foundRequirementNames = requirements.map(r => r.name.toLowerCase());
    
    for (const expectedReq of expected) {
      const isFound = foundRequirementNames.some(name => 
        this.requirementMatches(name, expectedReq.requirement)
      );
      
      if (!isFound) {
        gaps.push({
          area: expectedReq.category,
          severity: this.determineSeverity(expectedReq),
          description: `Missing ${expectedReq.commonName || expectedReq.requirement}`,
          expectedRequirement: expectedReq.requirement,
          potentialPenalty: this.estimatePenalty(expectedReq),
          suggestedAction: this.generateSuggestedAction(expectedReq, profile),
          searchIntent: this.generateSearchIntent(expectedReq, profile)
        });
      }
    }
    
    // Sort by severity
    return gaps.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private calculateOverallScore(
    jurisdictionCoverage: CoverageReport['jurisdictionCoverage'],
    industryCoverage: CoverageReport['industryCoverage'],
    confidenceDistribution: CoverageReport['confidenceDistribution']
  ): number {
    // Weighted scoring
    const jurisdictionScore = (
      jurisdictionCoverage.federal.percentage * 0.4 +
      jurisdictionCoverage.state.percentage * 0.3 +
      jurisdictionCoverage.local.percentage * 0.1
    );
    
    const industryScore = industryCoverage.score * 0.2;
    
    // Confidence affects the score
    const confidenceMultiplier = (
      confidenceDistribution.high * 1.0 +
      confidenceDistribution.medium * 0.7 +
      confidenceDistribution.low * 0.4
    ) / 100;
    
    const baseScore = jurisdictionScore + industryScore;
    
    return Math.round(baseScore * confidenceMultiplier);
  }

  private assessRisk(gaps: GapAnalysis[], overallScore: number): CoverageReport['riskAssessment'] {
    const criticalGaps = gaps.filter(g => g.severity === 'critical').length;
    const highGaps = gaps.filter(g => g.severity === 'high').length;
    
    if (criticalGaps > 2 || overallScore < 40) return 'critical';
    if (criticalGaps > 0 || highGaps > 3 || overallScore < 60) return 'high';
    if (highGaps > 0 || overallScore < 80) return 'medium';
    
    return 'low';
  }

  private generateRecommendations(gaps: GapAnalysis[], requirements: Requirement[]): string[] {
    const recommendations: string[] = [];
    
    // Critical gaps first
    const criticalGaps = gaps.filter(g => g.severity === 'critical');
    if (criticalGaps.length > 0) {
      recommendations.push(
        `⚠️ Address ${criticalGaps.length} critical compliance gaps immediately to avoid penalties`
      );
    }
    
    // Low confidence areas
    const lowConfidence = requirements.filter(r => r.confidenceLevel === 'LOW');
    if (lowConfidence.length > 3) {
      recommendations.push(
        `🔍 Verify ${lowConfidence.length} low-confidence requirements with official sources`
      );
    }
    
    // Missing jurisdiction coverage
    if (gaps.some(g => g.area === 'federal')) {
      recommendations.push('📋 Review federal compliance requirements comprehensively');
    }
    
    // Industry-specific recommendations
    const industryGaps = gaps.filter(g => g.area === 'industry');
    if (industryGaps.length > 0) {
      recommendations.push(
        `🏢 Complete industry-specific compliance review for ${industryGaps.length} requirements`
      );
    }
    
    return recommendations;
  }

  private calculateCompletenessScore(requirements: Requirement[], expected: ExpectedRequirement[]): number {
    const criticalExpected = expected.filter(e => e.priority === 'critical');
    const criticalFound = criticalExpected.filter(exp => 
      requirements.some(req => this.requirementMatches(req.name, exp.requirement))
    );
    
    return criticalExpected.length > 0
      ? Math.round((criticalFound.length / criticalExpected.length) * 100)
      : 100;
  }

  private calculateDataQualityScore(requirements: Requirement[]): number {
    if (requirements.length === 0) return 0;
    
    let qualityPoints = 0;
    const maxPoints = requirements.length * 4; // 4 quality factors per requirement
    
    for (const req of requirements) {
      if (req.citation) qualityPoints++;
      if (req.source && req.source.includes('.gov')) qualityPoints++;
      if (req.confidenceLevel === 'HIGH') qualityPoints++;
      if (req.actionRequired) qualityPoints++;
    }
    
    return Math.round((qualityPoints / maxPoints) * 100);
  }

  private requirementMatches(found: string, expected: string): boolean {
    const foundLower = found.toLowerCase();
    const expectedLower = expected.toLowerCase();
    
    // Direct match
    if (foundLower.includes(expectedLower) || expectedLower.includes(foundLower)) {
      return true;
    }
    
    // Key term matching
    const keyTerms = expectedLower.split(/\s+/).filter(term => term.length > 3);
    const matchedTerms = keyTerms.filter(term => foundLower.includes(term));
    
    return matchedTerms.length >= Math.ceil(keyTerms.length * 0.6);
  }

  private determineSeverity(requirement: ExpectedRequirement): GapAnalysis['severity'] {
    if (requirement.priority === 'critical') return 'critical';
    if (requirement.priority === 'required') return 'high';
    return 'medium';
  }

  private estimatePenalty(requirement: ExpectedRequirement): string {
    // Simplified penalty estimates
    const penalties: Record<string, string> = {
      'Form 941': '$5,000+ per quarter',
      'I-9': '$2,500+ per violation',
      'ADA Compliance': '$75,000 first violation',
      'HIPAA': '$50,000 - $1.5M per violation',
      'OSHA': '$14,502 per violation',
      'Workers Compensation': 'Criminal charges possible'
    };
    
    for (const [key, penalty] of Object.entries(penalties)) {
      if (requirement.requirement.includes(key)) {
        return penalty;
      }
    }
    
    return 'Varies by violation';
  }

  private generateSuggestedAction(requirement: ExpectedRequirement, profile: BusinessProfile): string {
    const actions: Record<string, string> = {
      'EIN': 'Apply online at IRS.gov/EIN',
      'Form 941': 'File quarterly with IRS',
      'I-9': 'Complete for all new hires within 3 days',
      'Workers Compensation': `Contact ${profile.state} workers comp board`,
      'Business License': `Apply with ${profile.city || profile.state} licensing department`
    };
    
    for (const [key, action] of Object.entries(actions)) {
      if (requirement.requirement.includes(key)) {
        return action;
      }
    }
    
    return `Research ${requirement.commonName || requirement.requirement} requirements`;
  }

  private generateSearchIntent(requirement: ExpectedRequirement, profile: BusinessProfile): string {
    let intent = requirement.requirement;
    
    if (requirement.category === 'state') {
      intent = `${profile.state} ${intent}`;
    } else if (requirement.category === 'local' && profile.city) {
      intent = `${profile.city} ${intent}`;
    }
    
    if (requirement.conditions.industry && requirement.conditions.industry.length > 0) {
      intent += ` for ${profile.industry}`;
    }
    
    if (requirement.conditions.minEmployees) {
      intent += ` ${profile.employeeCount} employees`;
    }
    
    return intent + ' requirements';
  }
}