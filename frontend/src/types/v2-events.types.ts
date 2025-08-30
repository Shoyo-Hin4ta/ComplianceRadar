export interface V2WorkflowEvent {
  type: V2EventType;
  checkId?: string;
  message: string;
  progress: number;
  details?: string;
  [key: string]: any; // For event-specific data
}

export type V2EventType = 
  // Query Building Phase
  | 'query-building'
  | 'query-prepared'
  
  // URL Discovery Phase  
  | 'fetching-urls'
  | 'sonar-searching'
  | 'url-found'
  | 'urls-received'
  | 'urls-discovered'
  
  // URL Filtering Phase
  | 'filtering-urls'
  | 'categorizing-urls'
  | 'urls-filtered'
  
  // Scraping Phase
  | 'batch-starting'
  | 'batch-started'
  | 'scraping-site'
  | 'site-complete'
  | 'site-failed'
  | 'batch-complete'
  | 'scraping-complete'
  | 'starting-extraction'
  
  // Processing Phase
  | 'processing-data'
  | 'processing-requirements'
  | 'aggregation-complete'
  | 'scoring'
  
  // Completion
  | 'complete'
  | 'analysis-complete'
  | 'error';

export interface DiscoveredUrl {
  url: string;
  title: string;
  index?: number;
  total?: number;
}

export interface FilteredUrl {
  url: string;
  title?: string;
  score?: number;
  jurisdiction?: 'federal' | 'state' | 'local' | 'industry';
}

export interface JurisdictionBreakdown {
  federal: number;
  state: number;
  city: number;
  industry: number;
}

export interface ScrapingStatus {
  url: string;
  status: 'pending' | 'scraping' | 'complete' | 'failed';
  rulesFound?: number;
  progress?: number;
  error?: string;
  index?: number;
  total?: number;
}

export interface V2ProgressDetails {
  // Current phase
  currentPhase: 'query' | 'discovery' | 'filtering' | 'scraping' | 'processing' | 'complete';
  currentStep: string;
  overallProgress: number;
  
  // URL Discovery
  discoveredUrls: DiscoveredUrl[];
  filteredUrls: FilteredUrl[];
  jurisdictionBreakdown?: JurisdictionBreakdown;
  
  // Scraping Progress
  scrapingStatus: Map<string, ScrapingStatus>;
  currentlyScraping: string[];
  
  // Requirements Stream
  extractedRequirements: ExtractedRequirement[];
  
  // Statistics
  stats: V2Statistics;
  
  // Timing
  startTime?: number;
  estimatedTimeRemaining?: string;
  
  // Raw events for display
  rawEvents: V2WorkflowEvent[];
}

export interface ExtractedRequirement {
  id?: string;
  name: string;
  description: string;
  agency: string;
  formNumber?: string;
  deadline?: string;
  frequency?: string;
  penalty?: string;
  sourceUrl: string;
  jurisdiction?: 'federal' | 'state' | 'local' | 'industry';
}

export interface V2Statistics {
  // URL stats
  urlsDiscovered: number;
  urlsSelected: number;
  
  // Scraping stats
  sitesTotal: number;
  sitesScraped: number;
  sitesFailed: number;
  sitesInProgress: number;
  
  // Requirements stats
  totalRequirements: number;
  duplicatesRemoved: number;
  
  // Jurisdiction breakdown
  federalRequirements: number;
  stateRequirements: number;
  cityRequirements: number;
  industryRequirements: number;
}

// Event-specific data interfaces
export interface QueryBuildingEvent extends V2WorkflowEvent {
  type: 'query-building';
  queryLength?: number;
}

export interface UrlFoundEvent extends V2WorkflowEvent {
  type: 'url-found';
  url: string;
  title: string;
  index: number;
  total: number;
}

export interface UrlsFilteredEvent extends V2WorkflowEvent {
  type: 'urls-filtered';
  selected: number;
  total: number;
  breakdown: JurisdictionBreakdown;
}

export interface ScrapingSiteEvent extends V2WorkflowEvent {
  type: 'scraping-site';
  url: string;
  index: number;
  total: number;
}

export interface SiteCompleteEvent extends V2WorkflowEvent {
  type: 'site-complete';
  url: string;
  rulesFound: number;
  index?: number;
  total?: number;
}

export interface CompleteEvent extends V2WorkflowEvent {
  type: 'complete';
  totalRules: number;
  sources: number;
  stats: any;
}