import { z } from 'zod';
import { Requirement as ComplianceRequirement } from '../types/compliance.types';
import { CoverageReport } from './coverage-analyzer.service';
import { GapAnalysis } from './gap-analysis.service';

const RecommendationSchema = z.object({
  id: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.enum(['gap', 'deadline', 'verification', 'optimization', 'cost_saving']),
  title: z.string(),
  description: z.string(),
  action: z.string(),
  impact: z.string(),
  timeframe: z.enum(['immediate', 'within_7_days', 'within_30_days', 'within_90_days', 'annual']),
  estimatedEffort: z.enum(['minimal', 'moderate', 'significant']),
  relatedRequirements: z.array(z.string()).optional(),
  potentialSavings: z.string().optional(),
});

const DeadlineSchema = z.object({
  requirement: z.string(),
  deadline: z.string(),
  daysUntilDue: z.number(),
  category: z.enum(['overdue', 'due_soon', 'upcoming', 'recurring']),
  penalty: z.string().optional(),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;
export type Deadline = z.infer<typeof DeadlineSchema>;

export class RecommendationService {
  generateRecommendations(
    coverage: CoverageReport,
    requirements: ComplianceRequirement[],
    gaps?: GapAnalysis[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    let idCounter = 1;

    // 1. Critical gaps (immediate action required)
    if (gaps && gaps.length > 0) {
      const criticalGaps = gaps.filter(gap => gap.severity === 'critical');
      for (const gap of criticalGaps.slice(0, 3)) {
        recommendations.push({
          id: `rec-${idCounter++}`,
          priority: 'critical',
          category: 'gap',
          title: `Missing Critical Requirement: ${gap.requirement}`,
          description: gap.description,
          action: `Immediately research and implement ${gap.requirement} compliance. ${
            gap.penalty ? `Non-compliance penalty: ${gap.penalty}` : ''
          }`,
          impact: 'Legal compliance and risk mitigation',
          timeframe: 'immediate',
          estimatedEffort: 'significant',
          relatedRequirements: gap.suggestedIntents,
        });
      }
    }

    // 2. Upcoming deadlines (time-sensitive)
    const deadlines = this.detectUpcomingDeadlines(requirements);
    for (const deadline of deadlines.filter(d => d.category === 'overdue' || d.category === 'due_soon')) {
      recommendations.push({
        id: `rec-${idCounter++}`,
        priority: deadline.category === 'overdue' ? 'critical' : 'high',
        category: 'deadline',
        title: deadline.category === 'overdue' 
          ? `OVERDUE: ${deadline.requirement}`
          : `Due Soon: ${deadline.requirement}`,
        description: `This requirement is ${
          deadline.category === 'overdue' 
            ? `overdue by ${Math.abs(deadline.daysUntilDue)} days`
            : `due in ${deadline.daysUntilDue} days`
        }`,
        action: `Complete and submit required filing or action immediately`,
        impact: deadline.penalty || 'Avoid penalties and maintain compliance',
        timeframe: 'immediate',
        estimatedEffort: 'moderate',
      });
    }

    // 3. Low confidence areas (need verification)
    const lowConfidenceReqs = requirements.filter(req => req.confidence === 'LOW');
    if (lowConfidenceReqs.length > 0) {
      const topLowConfidence = lowConfidenceReqs.slice(0, 5);
      recommendations.push({
        id: `rec-${idCounter++}`,
        priority: 'medium',
        category: 'verification',
        title: `Verify ${topLowConfidence.length} Low-Confidence Requirements`,
        description: `${topLowConfidence.length} requirements need manual verification to ensure accuracy`,
        action: 'Review and verify these requirements with official sources or legal counsel',
        impact: 'Ensure compliance accuracy and reduce risk',
        timeframe: 'within_7_days',
        estimatedEffort: 'moderate',
        relatedRequirements: topLowConfidence.map(req => req.requirement),
      });
    }

    // 4. Cost-saving opportunities
    const costSavingOpps = this.identifyCostSavings(requirements, coverage);
    for (const opp of costSavingOpps.slice(0, 2)) {
      recommendations.push({
        id: `rec-${idCounter++}`,
        priority: 'low',
        category: 'cost_saving',
        title: opp.title,
        description: opp.description,
        action: opp.action,
        impact: 'Reduce compliance costs',
        timeframe: 'within_30_days',
        estimatedEffort: 'minimal',
        potentialSavings: opp.savings,
      });
    }

    // 5. Compliance optimizations
    const optimizations = this.identifyOptimizations(coverage, requirements);
    for (const opt of optimizations.slice(0, 3)) {
      recommendations.push({
        id: `rec-${idCounter++}`,
        priority: 'medium',
        category: 'optimization',
        title: opt.title,
        description: opt.description,
        action: opt.action,
        impact: 'Improve compliance efficiency',
        timeframe: 'within_90_days',
        estimatedEffort: opt.effort as 'minimal' | 'moderate' | 'significant',
      });
    }

    // Coverage-based recommendations
    if (coverage.overallScore < 60) {
      recommendations.push({
        id: `rec-${idCounter++}`,
        priority: 'high',
        category: 'gap',
        title: 'Low Overall Compliance Coverage',
        description: `Your compliance coverage is at ${coverage.overallScore}%, indicating significant gaps`,
        action: 'Conduct a comprehensive compliance audit with professional assistance',
        impact: 'Identify and address all compliance gaps',
        timeframe: 'within_7_days',
        estimatedEffort: 'significant',
      });
    }

    // Federal compliance gaps
    if (coverage.federal.score < 70) {
      recommendations.push({
        id: `rec-${idCounter++}`,
        priority: 'high',
        category: 'gap',
        title: 'Federal Compliance Gaps',
        description: `Federal compliance is at ${coverage.federal.score}% (${coverage.federal.found}/${coverage.federal.expected} requirements found)`,
        action: 'Review IRS, DOL, and other federal agency requirements',
        impact: 'Avoid federal penalties and enforcement actions',
        timeframe: 'immediate',
        estimatedEffort: 'significant',
      });
    }

    // State compliance gaps
    if (coverage.state.score < 70) {
      recommendations.push({
        id: `rec-${idCounter++}`,
        priority: 'high',
        category: 'gap',
        title: 'State Compliance Gaps',
        description: `State compliance is at ${coverage.state.score}% (${coverage.state.found}/${coverage.state.expected} requirements found)`,
        action: 'Review state-specific business requirements and registrations',
        impact: 'Maintain state business authorization',
        timeframe: 'within_7_days',
        estimatedEffort: 'moderate',
      });
    }

    // Industry compliance gaps
    if (coverage.industry.score < 60) {
      recommendations.push({
        id: `rec-${idCounter++}`,
        priority: 'medium',
        category: 'gap',
        title: 'Industry-Specific Compliance Gaps',
        description: `Industry compliance is at ${coverage.industry.score}% (${coverage.industry.found}/${coverage.industry.expected} requirements found)`,
        action: 'Consult industry associations and specialized compliance resources',
        impact: 'Meet industry standards and requirements',
        timeframe: 'within_30_days',
        estimatedEffort: 'moderate',
      });
    }

    return this.prioritizeRecommendations(recommendations);
  }

  detectUpcomingDeadlines(requirements: ComplianceRequirement[]): Deadline[] {
    const deadlines: Deadline[] = [];
    const today = new Date();

    for (const req of requirements) {
      if (!req.deadline) continue;

      const deadlineInfo = this.parseDeadline(req.deadline);
      if (!deadlineInfo) continue;

      const daysUntilDue = Math.ceil(
        (deadlineInfo.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      let category: 'overdue' | 'due_soon' | 'upcoming' | 'recurring';
      if (daysUntilDue < 0) {
        category = 'overdue';
      } else if (daysUntilDue <= 7) {
        category = 'due_soon';
      } else if (daysUntilDue <= 30) {
        category = 'upcoming';
      } else {
        category = deadlineInfo.isRecurring ? 'recurring' : 'upcoming';
      }

      deadlines.push({
        requirement: req.requirement,
        deadline: req.deadline,
        daysUntilDue,
        category,
        penalty: req.penalty,
      });
    }

    // Sort by urgency
    return deadlines.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  private parseDeadline(deadline: string): { date: Date; isRecurring: boolean } | null {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Common deadline patterns
    const patterns = [
      // Quarterly patterns
      { regex: /Q1|first quarter/i, date: new Date(currentYear, 2, 31), recurring: true },
      { regex: /Q2|second quarter/i, date: new Date(currentYear, 5, 30), recurring: true },
      { regex: /Q3|third quarter/i, date: new Date(currentYear, 8, 30), recurring: true },
      { regex: /Q4|fourth quarter/i, date: new Date(currentYear, 11, 31), recurring: true },
      
      // Monthly patterns
      { regex: /monthly|each month|every month/i, date: new Date(currentYear, today.getMonth() + 1, 0), recurring: true },
      
      // Annual patterns
      { regex: /April 15|tax day/i, date: new Date(currentYear, 3, 15), recurring: true },
      { regex: /March 15/i, date: new Date(currentYear, 2, 15), recurring: true },
      { regex: /January 31/i, date: new Date(currentYear + 1, 0, 31), recurring: true },
      { regex: /December 31|year end/i, date: new Date(currentYear, 11, 31), recurring: true },
      
      // Specific date patterns
      { regex: /(\d{1,2})\/(\d{1,2})\/(\d{4})/i, date: null, recurring: false },
      { regex: /within (\d+) days/i, date: null, recurring: false },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(deadline)) {
        if (pattern.date) {
          // If the date has passed this year, use next year
          if (pattern.date < today && pattern.recurring) {
            pattern.date.setFullYear(currentYear + 1);
          }
          return { date: pattern.date, isRecurring: pattern.recurring };
        }
        
        // Parse specific date
        const match = deadline.match(pattern.regex);
        if (match) {
          if (deadline.includes('within')) {
            const days = parseInt(match[1]);
            const futureDate = new Date(today);
            futureDate.setDate(today.getDate() + days);
            return { date: futureDate, isRecurring: false };
          } else if (match.length === 4) {
            // MM/DD/YYYY format
            const date = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
            return { date, isRecurring: false };
          }
        }
      }
    }

    return null;
  }

  private identifyCostSavings(
    requirements: ComplianceRequirement[],
    coverage: CoverageReport
  ): Array<{ title: string; description: string; action: string; savings: string }> {
    const opportunities = [];

    // Check for duplicate or overlapping requirements
    const requirementMap = new Map<string, ComplianceRequirement[]>();
    for (const req of requirements) {
      const key = this.normalizeRequirement(req.requirement);
      if (!requirementMap.has(key)) {
        requirementMap.set(key, []);
      }
      requirementMap.get(key)!.push(req);
    }

    // Find duplicates
    for (const [key, reqs] of requirementMap) {
      if (reqs.length > 1) {
        opportunities.push({
          title: 'Consolidate Duplicate Requirements',
          description: `Found ${reqs.length} similar requirements that may be consolidated`,
          action: 'Review and consolidate overlapping compliance efforts',
          savings: 'Reduce redundant compliance work by 20-30%',
        });
        break;
      }
    }

    // Check for automation opportunities
    const recurringReqs = requirements.filter(req => 
      req.deadline && (req.deadline.includes('quarterly') || req.deadline.includes('monthly'))
    );
    if (recurringReqs.length > 3) {
      opportunities.push({
        title: 'Automate Recurring Compliance Tasks',
        description: `${recurringReqs.length} requirements have recurring deadlines`,
        action: 'Implement compliance automation tools for recurring tasks',
        savings: 'Save 10-15 hours per month on compliance tasks',
      });
    }

    // Check for bulk filing opportunities
    const taxRelated = requirements.filter(req => 
      req.requirement.toLowerCase().includes('tax') || 
      req.requirement.includes('941') || 
      req.requirement.includes('W-2')
    );
    if (taxRelated.length > 2) {
      opportunities.push({
        title: 'Consolidate Tax Filings',
        description: 'Multiple tax-related requirements could be handled together',
        action: 'Use integrated tax software or service for all tax compliance',
        savings: 'Reduce tax compliance costs by 25-40%',
      });
    }

    return opportunities;
  }

  private identifyOptimizations(
    coverage: CoverageReport,
    requirements: ComplianceRequirement[]
  ): Array<{ title: string; description: string; action: string; effort: string }> {
    const optimizations = [];

    // Compliance management system
    if (requirements.length > 20) {
      optimizations.push({
        title: 'Implement Compliance Management System',
        description: `Managing ${requirements.length} compliance requirements manually is inefficient`,
        action: 'Deploy a compliance management platform to track all requirements',
        effort: 'moderate',
      });
    }

    // Documentation improvement
    const lowConfidence = requirements.filter(req => req.confidence === 'LOW').length;
    const medConfidence = requirements.filter(req => req.confidence === 'MEDIUM').length;
    if (lowConfidence + medConfidence > 10) {
      optimizations.push({
        title: 'Improve Compliance Documentation',
        description: `${lowConfidence + medConfidence} requirements need better documentation`,
        action: 'Create a centralized compliance documentation repository',
        effort: 'moderate',
      });
    }

    // Training needs
    const complexReqs = requirements.filter(req => 
      req.actionRequired && req.actionRequired.length > 200
    );
    if (complexReqs.length > 5) {
      optimizations.push({
        title: 'Compliance Training Program',
        description: 'Multiple complex requirements indicate training needs',
        action: 'Develop compliance training for staff on critical requirements',
        effort: 'significant',
      });
    }

    // Compliance calendar
    const deadlineReqs = requirements.filter(req => req.deadline).length;
    if (deadlineReqs > 5) {
      optimizations.push({
        title: 'Create Compliance Calendar',
        description: `${deadlineReqs} requirements have specific deadlines to track`,
        action: 'Implement a compliance calendar with automated reminders',
        effort: 'minimal',
      });
    }

    // Vendor consolidation
    const vendorRelated = requirements.filter(req => 
      req.requirement.toLowerCase().includes('insurance') ||
      req.requirement.toLowerCase().includes('permit') ||
      req.requirement.toLowerCase().includes('license')
    );
    if (vendorRelated.length > 5) {
      optimizations.push({
        title: 'Consolidate Compliance Vendors',
        description: 'Multiple permits, licenses, and insurance requirements',
        action: 'Use a single compliance service provider for multiple requirements',
        effort: 'moderate',
      });
    }

    return optimizations;
  }

  prioritizeRecommendations(recommendations: Recommendation[]): Recommendation[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const timeframeOrder = { 
      immediate: 0, 
      within_7_days: 1, 
      within_30_days: 2, 
      within_90_days: 3, 
      annual: 4 
    };

    return recommendations.sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by timeframe
      return timeframeOrder[a.timeframe] - timeframeOrder[b.timeframe];
    });
  }

  private normalizeRequirement(requirement: string): string {
    return requirement
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20); // Take first 20 chars for comparison
  }
}