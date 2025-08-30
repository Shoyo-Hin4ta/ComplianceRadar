import { z } from 'zod';
import { CoverageReport } from './coverage-analyzer.service';
import { Requirement as ComplianceRequirement } from '../types/compliance.types';
import { Recommendation, Deadline } from './recommendation.service';
import { GapAnalysis } from './gap-analysis.service';

const VisualizationDataSchema = z.object({
  coverageWheel: z.object({
    labels: z.array(z.string()),
    datasets: z.array(z.object({
      label: z.string(),
      data: z.array(z.number()),
      backgroundColor: z.array(z.string()),
      borderColor: z.array(z.string()),
      borderWidth: z.number(),
    })),
  }),
  confidenceHeatmap: z.object({
    categories: z.array(z.string()),
    confidenceLevels: z.array(z.string()),
    data: z.array(z.array(z.number())),
    colors: z.object({
      high: z.string(),
      medium: z.string(),
      low: z.string(),
      none: z.string(),
    }),
  }),
  complianceTimeline: z.object({
    overdue: z.array(z.object({
      date: z.string(),
      requirement: z.string(),
      daysOverdue: z.number(),
      severity: z.string(),
    })),
    upcoming: z.array(z.object({
      date: z.string(),
      requirement: z.string(),
      daysUntil: z.number(),
      category: z.string(),
    })),
    recurring: z.array(z.object({
      frequency: z.string(),
      requirement: z.string(),
      nextDue: z.string(),
    })),
  }),
  riskMatrix: z.object({
    axes: z.object({
      x: z.object({ label: z.string(), values: z.array(z.string()) }),
      y: z.object({ label: z.string(), values: z.array(z.string()) }),
    }),
    data: z.array(z.object({
      x: z.number(),
      y: z.number(),
      value: z.number(),
      items: z.array(z.string()),
      color: z.string(),
    })),
  }),
  summary: z.object({
    totalRequirements: z.number(),
    byConfidence: z.object({
      high: z.number(),
      medium: z.number(),
      low: z.number(),
    }),
    byCategory: z.object({
      federal: z.number(),
      state: z.number(),
      local: z.number(),
      industry: z.number(),
    }),
    criticalGaps: z.number(),
    upcomingDeadlines: z.number(),
    overallHealth: z.enum(['excellent', 'good', 'fair', 'poor', 'critical']),
  }),
  progressIndicators: z.object({
    coverageProgress: z.array(z.object({
      category: z.string(),
      current: z.number(),
      target: z.number(),
      percentage: z.number(),
      color: z.string(),
    })),
    complianceScore: z.object({
      score: z.number(),
      trend: z.enum(['improving', 'stable', 'declining']),
      label: z.string(),
      color: z.string(),
    }),
  }),
});

export type VisualizationData = z.infer<typeof VisualizationDataSchema>;

export class CoverageVisualizationService {
  generateVisualizationData(
    coverage: CoverageReport,
    requirements: ComplianceRequirement[] = [],
    gaps: GapAnalysis[] = [],
    deadlines: Deadline[] = [],
    recommendations: Recommendation[] = []
  ): VisualizationData {
    return {
      coverageWheel: this.generateCoverageWheel(coverage),
      confidenceHeatmap: this.generateConfidenceHeatmap(requirements),
      complianceTimeline: this.generateComplianceTimeline(deadlines, requirements),
      riskMatrix: this.generateRiskMatrix(gaps, requirements, recommendations),
      summary: this.generateSummary(coverage, requirements, gaps, deadlines),
      progressIndicators: this.generateProgressIndicators(coverage),
    };
  }

  private generateCoverageWheel(coverage: CoverageReport): VisualizationData['coverageWheel'] {
    return {
      labels: ['Federal', 'State', 'Local', 'Industry'],
      datasets: [
        {
          label: 'Coverage Score',
          data: [
            coverage.federal.score,
            coverage.state.score,
            coverage.local.score,
            coverage.industry.score,
          ],
          backgroundColor: [
            this.getColorForScore(coverage.federal.score, 0.6),
            this.getColorForScore(coverage.state.score, 0.6),
            this.getColorForScore(coverage.local.score, 0.6),
            this.getColorForScore(coverage.industry.score, 0.6),
          ],
          borderColor: [
            this.getColorForScore(coverage.federal.score, 1),
            this.getColorForScore(coverage.state.score, 1),
            this.getColorForScore(coverage.local.score, 1),
            this.getColorForScore(coverage.industry.score, 1),
          ],
          borderWidth: 2,
        },
        {
          label: 'Requirements Found',
          data: [
            (coverage.federal.found / coverage.federal.expected) * 100,
            (coverage.state.found / coverage.state.expected) * 100,
            (coverage.local.found / coverage.local.expected) * 100,
            (coverage.industry.found / coverage.industry.expected) * 100,
          ],
          backgroundColor: [
            'rgba(59, 130, 246, 0.3)',
            'rgba(59, 130, 246, 0.3)',
            'rgba(59, 130, 246, 0.3)',
            'rgba(59, 130, 246, 0.3)',
          ],
          borderColor: [
            'rgba(59, 130, 246, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(59, 130, 246, 1)',
          ],
          borderWidth: 2,
        },
      ],
    };
  }

  private generateConfidenceHeatmap(requirements: ComplianceRequirement[]): VisualizationData['confidenceHeatmap'] {
    const categories = ['Federal', 'State', 'Local', 'Industry'];
    const confidenceLevels = ['HIGH', 'MEDIUM', 'LOW'];
    
    // Initialize data matrix
    const data: number[][] = categories.map(() => [0, 0, 0]);
    
    // Count requirements by category and confidence
    for (const req of requirements) {
      const catIndex = categories.findIndex(cat => cat.toLowerCase() === req.category);
      const confIndex = confidenceLevels.indexOf(req.confidence);
      
      if (catIndex >= 0 && confIndex >= 0) {
        data[catIndex][confIndex]++;
      }
    }

    return {
      categories,
      confidenceLevels,
      data,
      colors: {
        high: '#10b981',   // green
        medium: '#f59e0b', // yellow
        low: '#ef4444',    // red
        none: '#e5e7eb',   // gray
      },
    };
  }

  private generateComplianceTimeline(
    deadlines: Deadline[],
    requirements: ComplianceRequirement[]
  ): VisualizationData['complianceTimeline'] {
    const overdue = deadlines
      .filter(d => d.category === 'overdue')
      .slice(0, 5)
      .map(d => ({
        date: this.formatDate(new Date(Date.now() + d.daysUntilDue * 24 * 60 * 60 * 1000)),
        requirement: d.requirement,
        daysOverdue: Math.abs(d.daysUntilDue),
        severity: 'critical',
      }));

    const upcoming = deadlines
      .filter(d => d.category === 'due_soon' || d.category === 'upcoming')
      .slice(0, 10)
      .map(d => ({
        date: this.formatDate(new Date(Date.now() + d.daysUntilDue * 24 * 60 * 60 * 1000)),
        requirement: d.requirement,
        daysUntil: d.daysUntilDue,
        category: d.category,
      }));

    const recurring = deadlines
      .filter(d => d.category === 'recurring')
      .slice(0, 5)
      .map(d => ({
        frequency: this.extractFrequency(d.deadline),
        requirement: d.requirement,
        nextDue: this.formatDate(new Date(Date.now() + d.daysUntilDue * 24 * 60 * 60 * 1000)),
      }));

    return { overdue, upcoming, recurring };
  }

  private generateRiskMatrix(
    gaps: GapAnalysis[],
    requirements: ComplianceRequirement[],
    recommendations: Recommendation[]
  ): VisualizationData['riskMatrix'] {
    const probabilityLevels = ['Low', 'Medium', 'High'];
    const impactLevels = ['Minor', 'Moderate', 'Severe'];
    
    // Initialize risk matrix data
    const matrixData: Array<{
      x: number;
      y: number;
      value: number;
      items: string[];
      color: string;
    }> = [];

    // Map gaps to risk matrix
    for (const gap of gaps) {
      const probability = gap.severity === 'critical' ? 2 : gap.severity === 'high' ? 1 : 0;
      const impact = gap.penalty && gap.penalty.includes('criminal') ? 2 : 
                     gap.penalty && gap.penalty.includes('$') ? 1 : 0;
      
      const existingCell = matrixData.find(cell => cell.x === probability && cell.y === impact);
      if (existingCell) {
        existingCell.value++;
        existingCell.items.push(gap.requirement);
      } else {
        matrixData.push({
          x: probability,
          y: impact,
          value: 1,
          items: [gap.requirement],
          color: this.getRiskColor(probability, impact),
        });
      }
    }

    // Add low confidence requirements to risk matrix
    const lowConfReqs = requirements.filter(req => req.confidence === 'LOW');
    for (const req of lowConfReqs) {
      const probability = 1; // Medium probability for low confidence
      const impact = req.penalty ? 1 : 0;
      
      const existingCell = matrixData.find(cell => cell.x === probability && cell.y === impact);
      if (existingCell) {
        existingCell.value++;
        existingCell.items.push(req.requirement);
      } else {
        matrixData.push({
          x: probability,
          y: impact,
          value: 1,
          items: [req.requirement],
          color: this.getRiskColor(probability, impact),
        });
      }
    }

    return {
      axes: {
        x: { label: 'Likelihood', values: probabilityLevels },
        y: { label: 'Impact', values: impactLevels },
      },
      data: matrixData,
    };
  }

  private generateSummary(
    coverage: CoverageReport,
    requirements: ComplianceRequirement[],
    gaps: GapAnalysis[],
    deadlines: Deadline[]
  ): VisualizationData['summary'] {
    const byConfidence = {
      high: requirements.filter(r => r.confidence === 'HIGH').length,
      medium: requirements.filter(r => r.confidence === 'MEDIUM').length,
      low: requirements.filter(r => r.confidence === 'LOW').length,
    };

    const byCategory = {
      federal: requirements.filter(r => r.category === 'federal').length,
      state: requirements.filter(r => r.category === 'state').length,
      local: requirements.filter(r => r.category === 'local').length,
      industry: requirements.filter(r => r.category === 'industry').length,
    };

    const criticalGaps = gaps.filter(g => g.severity === 'critical').length;
    const upcomingDeadlines = deadlines.filter(d => 
      d.category === 'due_soon' || d.category === 'overdue'
    ).length;

    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    if (coverage.overallScore >= 90 && criticalGaps === 0) {
      overallHealth = 'excellent';
    } else if (coverage.overallScore >= 75 && criticalGaps <= 2) {
      overallHealth = 'good';
    } else if (coverage.overallScore >= 60 && criticalGaps <= 5) {
      overallHealth = 'fair';
    } else if (coverage.overallScore >= 40) {
      overallHealth = 'poor';
    } else {
      overallHealth = 'critical';
    }

    return {
      totalRequirements: requirements.length,
      byConfidence,
      byCategory,
      criticalGaps,
      upcomingDeadlines,
      overallHealth,
    };
  }

  private generateProgressIndicators(coverage: CoverageReport): VisualizationData['progressIndicators'] {
    const categories = [
      { name: 'Federal', data: coverage.federal, color: '#3b82f6' },
      { name: 'State', data: coverage.state, color: '#8b5cf6' },
      { name: 'Local', data: coverage.local, color: '#06b6d4' },
      { name: 'Industry', data: coverage.industry, color: '#10b981' },
    ];

    const coverageProgress = categories.map(cat => ({
      category: cat.name,
      current: cat.data.found,
      target: cat.data.expected,
      percentage: cat.data.score,
      color: cat.data.score >= 80 ? '#10b981' : 
             cat.data.score >= 60 ? '#f59e0b' : '#ef4444',
    }));

    let scoreLabel: string;
    let scoreColor: string;
    if (coverage.overallScore >= 90) {
      scoreLabel = 'Excellent';
      scoreColor = '#10b981';
    } else if (coverage.overallScore >= 75) {
      scoreLabel = 'Good';
      scoreColor = '#3b82f6';
    } else if (coverage.overallScore >= 60) {
      scoreLabel = 'Fair';
      scoreColor = '#f59e0b';
    } else if (coverage.overallScore >= 40) {
      scoreLabel = 'Poor';
      scoreColor = '#f97316';
    } else {
      scoreLabel = 'Critical';
      scoreColor = '#ef4444';
    }

    return {
      coverageProgress,
      complianceScore: {
        score: coverage.overallScore,
        trend: 'stable', // Would need historical data to determine actual trend
        label: scoreLabel,
        color: scoreColor,
      },
    };
  }

  private getColorForScore(score: number, alpha: number = 1): string {
    if (score >= 80) {
      return `rgba(16, 185, 129, ${alpha})`; // green
    } else if (score >= 60) {
      return `rgba(245, 158, 11, ${alpha})`; // yellow
    } else {
      return `rgba(239, 68, 68, ${alpha})`; // red
    }
  }

  private getRiskColor(probability: number, impact: number): string {
    const riskScore = probability + impact;
    if (riskScore >= 4) return '#ef4444'; // High risk - red
    if (riskScore >= 2) return '#f59e0b'; // Medium risk - yellow
    return '#10b981'; // Low risk - green
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private extractFrequency(deadline: string): string {
    if (deadline.toLowerCase().includes('quarterly')) return 'Quarterly';
    if (deadline.toLowerCase().includes('monthly')) return 'Monthly';
    if (deadline.toLowerCase().includes('annual')) return 'Annual';
    if (deadline.toLowerCase().includes('weekly')) return 'Weekly';
    return 'Periodic';
  }

  generateCompactSummary(coverage: CoverageReport): string {
    const health = coverage.overallScore >= 75 ? '✅' : 
                  coverage.overallScore >= 50 ? '⚠️' : '❌';
    
    return `${health} Compliance Health: ${coverage.overallScore}% | ` +
           `Federal: ${coverage.federal.score}% | ` +
           `State: ${coverage.state.score}% | ` +
           `Industry: ${coverage.industry.score}%`;
  }

  generateTextReport(
    coverage: CoverageReport,
    requirements: ComplianceRequirement[],
    gaps: GapAnalysis[],
    recommendations: Recommendation[]
  ): string {
    const report = [];
    
    report.push('=== COMPLIANCE COVERAGE REPORT ===\n');
    report.push(`Overall Score: ${coverage.overallScore}%`);
    report.push(`Date: ${new Date().toLocaleDateString()}\n`);
    
    report.push('Coverage by Jurisdiction:');
    report.push(`  • Federal: ${coverage.federal.score}% (${coverage.federal.found}/${coverage.federal.expected})`);
    report.push(`  • State: ${coverage.state.score}% (${coverage.state.found}/${coverage.state.expected})`);
    report.push(`  • Local: ${coverage.local.score}% (${coverage.local.found}/${coverage.local.expected})`);
    report.push(`  • Industry: ${coverage.industry.score}% (${coverage.industry.found}/${coverage.industry.expected})\n`);
    
    report.push('Requirements by Confidence:');
    const byConf = {
      HIGH: requirements.filter(r => r.confidence === 'HIGH').length,
      MEDIUM: requirements.filter(r => r.confidence === 'MEDIUM').length,
      LOW: requirements.filter(r => r.confidence === 'LOW').length,
    };
    report.push(`  • High Confidence: ${byConf.HIGH}`);
    report.push(`  • Medium Confidence: ${byConf.MEDIUM}`);
    report.push(`  • Low Confidence: ${byConf.LOW}\n`);
    
    if (gaps.length > 0) {
      report.push(`Critical Gaps (${gaps.filter(g => g.severity === 'critical').length} found):`);
      gaps.filter(g => g.severity === 'critical').slice(0, 5).forEach(gap => {
        report.push(`  ⚠️ ${gap.requirement}`);
        if (gap.penalty) {
          report.push(`     Penalty: ${gap.penalty}`);
        }
      });
      report.push('');
    }
    
    if (recommendations.length > 0) {
      report.push(`Top Recommendations:`);
      recommendations.slice(0, 5).forEach((rec, idx) => {
        report.push(`  ${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
        report.push(`     ${rec.action}`);
      });
    }
    
    return report.join('\n');
  }
}