import dotenv from 'dotenv';
dotenv.config();

import { FirecrawlService } from './services/firecrawl.service';

async function testFirecrawl() {
  console.log('Testing Firecrawl with .gov URLs...\n');
  
  const firecrawlService = new FirecrawlService();
  
  // Test URLs - common government pages that should have content
  const testUrls = [
    'https://www.irs.gov/businesses/small-businesses-self-employed/business-taxes',
    'https://www.dol.gov/agencies/whd/compliance-assistance',
    'https://www.osha.gov/employers',
    'https://www.sba.gov/business-guide/launch-your-business/register-your-business'
  ];
  
  console.log('Testing individual URL extraction...\n');
  
  for (const url of testUrls) {
    console.log(`\n========================================`);
    console.log(`Testing: ${url}`);
    console.log(`========================================`);
    
    try {
      const result = await firecrawlService.extractContent(url);
      
      if (result) {
        console.log(`✅ SUCCESS - Extracted content`);
        console.log(`   Content length: ${result.content.length} characters`);
        console.log(`   Title: ${result.metadata.title || 'No title'}`);
        console.log(`   Extract method: ${result.metadata.extractMethod}`);
        console.log(`   First 500 chars: ${result.content.substring(0, 500)}...`);
      } else {
        console.log(`❌ FAILED - No content extracted`);
      }
    } catch (error) {
      console.log(`❌ ERROR:`, error);
    }
  }
  
  // Test batch extraction
  console.log('\n\n========================================');
  console.log('Testing batch extraction...');
  console.log('========================================\n');
  
  try {
    const batchResults = await firecrawlService.batchExtract(testUrls.slice(0, 2));
    console.log(`Batch extraction results: ${batchResults.length} successful out of 2 URLs`);
    
    for (const result of batchResults) {
      console.log(`\n   URL: ${result.url}`);
      console.log(`   Content length: ${result.content.length} characters`);
    }
  } catch (error) {
    console.log('Batch extraction error:', error);
  }
  
  // Test structured extraction
  console.log('\n\n========================================');
  console.log('Testing structured extraction...');
  console.log('========================================\n');
  
  try {
    const structuredResult = await firecrawlService.extractWithStructure(
      testUrls[0],
      undefined,
      'business tax requirements'
    );
    
    if (structuredResult) {
      console.log('✅ Structured extraction successful');
      console.log('   Markdown length:', structuredResult.markdown?.length || 0);
      console.log('   Structured data:', JSON.stringify(structuredResult.structured, null, 2).substring(0, 500));
    } else {
      console.log('❌ Structured extraction failed');
    }
  } catch (error) {
    console.log('Structured extraction error:', error);
  }
}

// Run the test
testFirecrawl().catch(console.error);