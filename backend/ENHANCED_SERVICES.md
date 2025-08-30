# Enhanced Firecrawl & Perplexity Services Documentation

## Overview
Based on Context7 documentation review, we've significantly enhanced both the Firecrawl and Perplexity services to leverage their full capabilities for the compliance checker application.

## 🔥 Firecrawl Enhancements

### 1. Schema-Based Extraction (NEW)
**What:** Instead of just scraping markdown, we now use Firecrawl's powerful LLM-based extraction with structured schemas.

**Benefits:**
- Structured data output matching our compliance models
- Automatic field extraction (forms, deadlines, penalties, citations)
- Schema auto-selection based on URL and intent

**Implementation:**
```typescript
// Automatically selects appropriate schema
const result = await firecrawl.extractWithStructure(
  url,
  undefined, // Auto-select schema
  "California business license" // Intent for context
);
```

### 2. Batch Scraping API (NEW)
**What:** Replaced parallel individual scrapes with native `batch_scrape_urls` API.

**Benefits:**
- Better performance (single API call vs multiple)
- Reduced rate limiting issues
- Consistent extraction across multiple URLs

**Implementation:**
```typescript
const results = await firecrawl.batchScrapeUrls(urls, {
  intent: "compliance requirements",
  schema: ComplianceRequirementSchema
});
```

### 3. Extraction Schemas Created
- `ComplianceRequirementSchema` - General compliance requirements
- `TaxRequirementSchema` - Tax-specific extraction
- `BusinessLicenseSchema` - License and permit extraction
- `GovernmentPageExtractionSchema` - Full page analysis

### 4. Smart Prompt Generation
Context-aware prompts based on:
- Target domain (IRS, DOL, OSHA, etc.)
- Search intent
- Page type

## 🔍 Perplexity Sonar Enhancements

### 1. Search Context Sizing (NEW)
**What:** Dynamic `search_context_size` selection based on query complexity.

**Options:**
- `low` - Simple, direct queries (fastest, cheapest)
- `medium` - Balanced searches (default)
- `high` - Complex, comprehensive queries

**Auto-Detection Logic:**
```typescript
// Automatically determines complexity
"simple tax form" → low
"tax requirements and deadlines" → medium  
"comprehensive compliance analysis" → high
```

### 2. Model Selection Intelligence (NEW)
**What:** Automatic selection of optimal Sonar model based on query type.

**Models:**
- `sonar` - Basic searches, quick facts
- `sonar-pro` - Complex queries, 2x more sources
- `sonar-reasoning` - Multi-step analysis
- `sonar-reasoning-pro` - Deep research

**Selection Logic:**
- Keywords like "why", "how", "explain" → reasoning models
- Complex multi-part queries → pro models
- Simple lookups → base sonar

### 3. Enhanced Web Search Options (NEW)
```typescript
web_search_options: {
  search_context_size: "medium",
  search_domain_filter: [".gov domains"],
  search_recency_filter: "year",
  search_after_date: "2024-01-01",
  search_before_date: "2024-12-31"
}
```

### 4. Structured Output Support (NEW)
**What:** JSON schema-based responses for direct data extraction.

**Benefits:**
- Structured compliance data directly from search
- No additional parsing needed
- Type-safe responses

### 5. Token Usage Tracking
Now logs:
- Prompt tokens used
- Completion tokens generated
- Search context size actually used
- Cost estimation per request

## 🚀 Combined Workflow Optimization

### Agentic Search Pattern
1. **Perplexity Discovery:** Find relevant .gov URLs with optimal model
2. **Firecrawl Extraction:** Extract structured data with schemas
3. **Data Synthesis:** Combine and validate results

### Example Usage:
```typescript
// Step 1: Smart search with Perplexity
const urls = await perplexity.searchWithSonar(
  "California restaurant compliance",
  "California",
  { searchContextSize: "medium", model: "sonar-pro" }
);

// Step 2: Batch extract with Firecrawl
const data = await firecrawl.batchScrapeUrls(
  urls.map(u => u.url),
  { schema: ComplianceRequirementSchema }
);
```

## 📊 Performance Improvements

### Before Enhancement:
- Individual API calls for each URL
- No structured extraction
- Fixed "sonar" model for all queries
- No search optimization

### After Enhancement:
- Batch API operations
- Structured data extraction with schemas
- Dynamic model selection
- Optimized search context
- Cost-aware processing

## 💰 Cost Optimization

### Perplexity Costs (per 1M tokens):
| Model | Input | Output | Search (per 1K) |
|-------|-------|--------|-----------------|
| sonar | $1 | $1 | Low: $5, Med: $8, High: $12 |
| sonar-pro | $3 | $15 | Low: $6, Med: $10, High: $14 |

### Optimization Strategies:
1. Use `low` context for simple queries
2. Batch operations to reduce API calls
3. Cache results aggressively
4. Select appropriate model per query

## 🧪 Testing

Run the test suite:
```bash
cd backend
npx tsx src/test-enhanced-services.ts
```

Tests cover:
1. Context optimization detection
2. Schema-based extraction
3. Batch scraping
4. Combined workflow
5. Structured output

## 🎯 Best Practices

### For Firecrawl:
1. **Always use schemas** for structured data extraction
2. **Batch URLs** when possible (up to 10 URLs)
3. **Set appropriate timeouts** (2-3 seconds for gov sites)
4. **Clean markdown** before storing

### For Perplexity:
1. **Analyze query complexity** before search
2. **Use domain filters** for .gov sites
3. **Set recency filters** for current requirements
4. **Monitor token usage** for cost control

## 🔄 Migration Notes

### Code Changes Required:
1. Update imports to include schemas
2. Add options parameter to search methods
3. Handle structured extraction results
4. Update error handling for batch operations

### Backward Compatibility:
- All existing methods still work
- New parameters are optional
- Fallbacks in place for batch failures

## 📈 Metrics to Monitor

1. **Response Times:**
   - Search latency per context size
   - Extraction time per schema

2. **Success Rates:**
   - Successful extractions / total attempts
   - Schema match accuracy

3. **Cost Metrics:**
   - Tokens per request
   - Cost per compliance check

4. **Data Quality:**
   - Fields extracted per page
   - Citation verification rate

## 🚦 Next Steps

### Immediate:
- [ ] Deploy enhanced services
- [ ] Monitor performance metrics
- [ ] Adjust context thresholds based on usage

### Future Enhancements:
- [ ] Implement result caching layer
- [ ] Add fallback extraction strategies
- [ ] Create custom schemas per state
- [ ] Implement extraction confidence scoring
- [ ] Add multimodal search (images for licenses/permits)

## 🆘 Troubleshooting

### Common Issues:

**Firecrawl batch_scrape_urls fails:**
- Falls back to parallel individual scraping
- Check API rate limits
- Verify schema validity

**Perplexity returns no results:**
- Check domain filters aren't too restrictive
- Verify API key has correct permissions
- Try reducing search context size

**Schema extraction returns empty:**
- Page might not match schema structure
- Try GovernmentPageExtractionSchema as fallback
- Check if page requires JavaScript rendering

## 📚 References

- [Firecrawl Extract API Docs](https://docs.firecrawl.dev/api-reference/extract)
- [Perplexity Sonar Models](https://docs.perplexity.ai/models)
- [Schema Design Best Practices](https://docs.firecrawl.dev/guides/extract-structured-data)