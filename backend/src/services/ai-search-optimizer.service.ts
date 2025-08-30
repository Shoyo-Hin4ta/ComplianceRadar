import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { BusinessProfile } from "../types/compliance.types";

const OptimizedSearchSchema = z.object({
  searches: z.array(z.object({
    query: z.string(),
    targetSite: z.string().optional(),
    priority: z.enum(['must_have', 'should_have', 'nice_to_have']),
    expectedResults: z.string()
  }))
});

export class AISearchOptimizerService {
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-4o-mini",
      temperature: 0.3,
    });
  }

  /**
   * AI optimizes search queries for better results
   */
  async optimizeSearchQueries(
    intents: string[],
    businessProfile: BusinessProfile
  ): Promise<string[]> {
    const prompt = `You are a search optimization expert for finding government compliance requirements.

Business Context:
- Type: ${businessProfile.industry}
- Location: ${businessProfile.state}${businessProfile.city ? `, ${businessProfile.city}` : ''}
- Size: ${businessProfile.employeeCount} employees
- Revenue: ${businessProfile.annualRevenue ? `$${businessProfile.annualRevenue.toLocaleString()}` : 'Not specified'}

Raw search intents:
${intents.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

Transform these into OPTIMIZED search queries that will find SPECIFIC compliance pages on .gov sites.

Rules for optimization:
1. Use exact government terminology (e.g., "Form 941" not "quarterly tax form")
2. Add "site:" operators for known domains when appropriate
3. Keep queries concise (3-7 words optimal)
4. Focus on finding pages with requirements, forms, deadlines, not general info
5. Prioritize queries that will find actionable compliance information

For each search, provide:
- query: The optimized search string
- targetSite: If targeting specific .gov domain (e.g., "irs.gov")
- priority: "must_have" (critical compliance), "should_have" (important), "nice_to_have" (helpful)
- expectedResults: What specific compliance info you expect to find

Return JSON with searches array containing the optimized queries.`;

    try {
      const response = await this.model.invoke(prompt);
      const content = response.content as string;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = OptimizedSearchSchema.parse(JSON.parse(jsonMatch[0]));
        
        // Build optimized queries with site: operators
        const optimized = parsed.searches.map(search => {
          if (search.targetSite && !search.query.includes('site:')) {
            return `${search.query} site:${search.targetSite}`;
          }
          return search.query;
        });
        
        console.log('\n🎯 AI-Optimized Search Queries:');
        parsed.searches.forEach((s, idx) => {
          console.log(`${idx + 1}. [${s.priority}] ${s.query}`);
          console.log(`   Expected: ${s.expectedResults}`);
        });
        
        // Return queries ordered by priority
        const priorityOrder = { 'must_have': 0, 'should_have': 1, 'nice_to_have': 2 };
        const sorted = parsed.searches.sort((a, b) => 
          priorityOrder[a.priority] - priorityOrder[b.priority]
        );
        
        return sorted.map(s => 
          s.targetSite && !s.query.includes('site:') 
            ? `${s.query} site:${s.targetSite}`
            : s.query
        );
      }
    } catch (error) {
      console.error('Error optimizing searches:', error);
    }

    // Fallback to original intents
    return intents;
  }

  /**
   * AI learns from search results to improve future queries
   */
  async learnFromResults(
    query: string,
    results: Array<{url: string, title?: string, relevant: boolean}>
  ): Promise<string> {
    const prompt = `Learn from these search results to improve the query.

Original Query: ${query}

Results:
${results.map(r => `- ${r.url} (${r.relevant ? '✓ Relevant' : '✗ Not relevant'})`).join('\n')}

Based on what worked and what didn't, suggest an improved query that would find more relevant results.
Focus on using terms that appear in relevant URLs and avoiding terms that led to irrelevant results.

Return just the improved query string, nothing else.`;

    try {
      const response = await this.model.invoke(prompt);
      return response.content as string;
    } catch (error) {
      console.error('Error learning from results:', error);
      return query;
    }
  }
}