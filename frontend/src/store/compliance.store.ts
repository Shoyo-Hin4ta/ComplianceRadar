import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { apiService } from '../services/api.service';
import type { BusinessProfile, ComplianceCheckResponse, WorkflowStatus, WorkflowEvent } from '../services/api.service';
import type { 
  V2WorkflowEvent, 
  V2ProgressDetails, 
  DiscoveredUrl, 
  FilteredUrl, 
  ScrapingStatus,
  ExtractedRequirement,
  V2Statistics
} from '../types/v2-events.types';

interface ComplianceState {
  // Current business profile
  businessProfile: BusinessProfile | null;
  
  // Current compliance check
  currentCheck: ComplianceCheckResponse | null;
  
  // Workflow status
  workflowStatus: WorkflowStatus | null;
  
  // Progress tracking
  v2Progress: V2ProgressDetails;
  
  // Recent checks history
  recentChecks: ComplianceCheckResponse[];
  
  // Loading states
  isLoading: boolean;
  isSubmitting: boolean;
  
  // Error state
  error: string | null;
  
  // WebSocket connection state
  isConnected: boolean;
  
  // Subscription cleanup
  unsubscribe: (() => void) | null;
}

interface ComplianceActions {
  // Profile actions
  setBusinessProfile: (profile: BusinessProfile) => void;
  clearBusinessProfile: () => void;
  
  // Compliance check actions
  submitComplianceCheck: (profile: BusinessProfile) => Promise<void>;
  clearCurrentCheck: () => void;
  
  // Status actions
  fetchComplianceStatus: (checkId: string) => Promise<void>;
  
  
  // WebSocket actions
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  subscribeToCheckUpdates: (checkId: string) => void;
  
  // Event handlers
  handleV2Event: (event: V2WorkflowEvent) => void;
  
  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Reset store
  reset: () => void;
}

export type ComplianceStore = ComplianceState & ComplianceActions;

const createInitialV2Progress = (): V2ProgressDetails => ({
  currentPhase: 'query',
  currentStep: '',
  overallProgress: 0,
  discoveredUrls: [],
  filteredUrls: [],
  jurisdictionBreakdown: undefined,
  scrapingStatus: new Map(),
  currentlyScraping: [],
  extractedRequirements: [],
  stats: {
    urlsDiscovered: 0,
    urlsSelected: 0,
    sitesTotal: 0,
    sitesScraped: 0,
    sitesFailed: 0,
    sitesInProgress: 0,
    totalRequirements: 0,
    duplicatesRemoved: 0,
    federalRequirements: 0,
    stateRequirements: 0,
    cityRequirements: 0,
    industryRequirements: 0,
  },
  startTime: undefined,
  estimatedTimeRemaining: undefined,
  rawEvents: [],
});

const initialState: ComplianceState = {
  businessProfile: null,
  currentCheck: null,
  workflowStatus: null,
  v2Progress: createInitialV2Progress(),
  recentChecks: [],
  isLoading: false,
  isSubmitting: false,
  error: null,
  isConnected: false,
  unsubscribe: null,
};

export const useComplianceStore = create<ComplianceStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Profile actions
        setBusinessProfile: (profile) => set({ businessProfile: profile }),
        
        clearBusinessProfile: () => set({ businessProfile: null }),

        // Compliance check actions
        submitComplianceCheck: async (profile) => {
          set({ 
            isSubmitting: true, 
            error: null, 
            businessProfile: profile,
            v2Progress: {
              ...createInitialV2Progress(),
              startTime: Date.now()
            }
          });
          
          try {
            const response = await apiService.checkCompliance(profile);
            
            set({ 
              currentCheck: response,
              isSubmitting: false 
            });
            
            // Subscribe to real-time updates
            if (response.id) {
              get().subscribeToCheckUpdates(response.id);
            }
            
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to submit compliance check',
              isSubmitting: false 
            });
          }
        },

        clearCurrentCheck: () => {
          const { unsubscribe } = get();
          if (unsubscribe) {
            unsubscribe();
          }
          set({ 
            currentCheck: null, 
            workflowStatus: null,
            unsubscribe: null,
            v2Progress: createInitialV2Progress()
          });
        },


        // Status actions
        fetchComplianceStatus: async (checkId) => {
          set({ isLoading: true, error: null });
          
          try {
            const response = await apiService.getComplianceStatus(checkId);
            set({ 
              currentCheck: response,
              isLoading: false 
            });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to fetch compliance status',
              isLoading: false 
            });
          }
        },


        // WebSocket actions
        connectWebSocket: () => {
          apiService.connectWebSocket();
          set({ isConnected: true });
        },

        disconnectWebSocket: () => {
          const { unsubscribe } = get();
          if (unsubscribe) {
            unsubscribe();
          }
          apiService.disconnectWebSocket();
          set({ isConnected: false, unsubscribe: null });
        },

        subscribeToCheckUpdates: (checkId) => {
          // Cleanup previous subscription
          const { unsubscribe: prevUnsubscribe } = get();
          if (prevUnsubscribe) {
            prevUnsubscribe();
          }

          // Connect if not connected
          if (!get().isConnected) {
            get().connectWebSocket();
          }

          // Subscribe to updates
          const unsubscribe = apiService.subscribeToCheck(checkId, (event: WorkflowEvent) => {
            get().handleV2Event(event as V2WorkflowEvent);
          });

          set({ unsubscribe });
        },

        handleV2Event: (event: V2WorkflowEvent) => {
          console.log('V2 Event:', event.type, event);
          
          set(state => {
            const v2Progress = { ...state.v2Progress };
            
            // Store the raw event (keep last 200 events to preserve full history)
            v2Progress.rawEvents = [...v2Progress.rawEvents, event].slice(-200);
            
            // Update current step message
            v2Progress.currentStep = event.message || v2Progress.currentStep;
            
            // Calculate phase-based progress if event.progress not provided
            let calculatedProgress = v2Progress.overallProgress;
            
            // Use event progress if available, otherwise calculate based on phase
            if (event.progress !== undefined) {
              calculatedProgress = event.progress;
            } else {
              // Calculate progress based on current phase
              switch (event.type) {
                case 'query-building':
                  calculatedProgress = 5;
                  break;
                case 'sonar-searching':
                  calculatedProgress = 10;
                  break;
                case 'search-complete':
                  calculatedProgress = 18;
                  break;
                case 'urls-discovered':
                  calculatedProgress = 20;
                  break;
                case 'urls-filtered':
                  calculatedProgress = 25;
                  break;
                case 'scraping-site':
                  // Calculate based on sites completed
                  if (v2Progress.stats.sitesTotal > 0) {
                    const scrapingProgress = (v2Progress.stats.sitesScraped / v2Progress.stats.sitesTotal) * 60;
                    calculatedProgress = 30 + scrapingProgress;
                  }
                  break;
                case 'site-complete':
                  // Update based on completion
                  if (v2Progress.stats.sitesTotal > 0) {
                    const newScraped = v2Progress.stats.sitesScraped + 1;
                    const scrapingProgress = (newScraped / v2Progress.stats.sitesTotal) * 60;
                    calculatedProgress = 30 + scrapingProgress;
                  }
                  break;
                case 'processing-data':
                  calculatedProgress = 90;
                  break;
                case 'ai-deduplication':
                  calculatedProgress = 91;
                  break;
                case 'ai-deduplication-complete':
                case 'ai-deduplication-failed':
                  calculatedProgress = 92;
                  break;
                case 'processing-requirements':
                  calculatedProgress = 93;
                  break;
                case 'scoring-complete':
                  calculatedProgress = 95;
                  break;
                case 'complete':
                  calculatedProgress = 100;
                  break;
              }
            }
            
            v2Progress.overallProgress = Math.max(calculatedProgress, v2Progress.overallProgress);
            
            // Handle event-specific updates
            switch (event.type) {
              case 'query-building':
                v2Progress.currentPhase = 'query';
                break;
                
              case 'fetching-urls':
              case 'sonar-searching':
                v2Progress.currentPhase = 'discovery';
                break;
                
              case 'search-complete':
                v2Progress.currentPhase = 'discovery';
                v2Progress.stats.urlsDiscovered = event.count || 0;
                // Store the breakdown for display
                if (event.breakdown) {
                  v2Progress.jurisdictionBreakdown = event.breakdown;
                }
                break;
                
              case 'urls-discovered':
                v2Progress.currentPhase = 'discovery';
                v2Progress.stats.urlsDiscovered = event.count || v2Progress.stats.urlsDiscovered;
                break;
                
              case 'filtering-urls':
              case 'categorizing-urls':
                v2Progress.currentPhase = 'filtering';
                break;
                
              case 'urls-filtered':
                v2Progress.currentPhase = 'filtering';
                v2Progress.stats.urlsSelected = event.selected || 0;
                v2Progress.jurisdictionBreakdown = event.breakdown;
                break;
                
              case 'batch-starting':
              case 'batch-started':
              case 'starting-extraction':
                v2Progress.currentPhase = 'scraping';
                if (event.count) {
                  v2Progress.stats.sitesTotal = event.count;
                }
                break;
                
              case 'scraping-site':
                v2Progress.currentPhase = 'scraping';
                const scrapingUrl = event.url;
                v2Progress.scrapingStatus.set(scrapingUrl, {
                  url: scrapingUrl,
                  status: 'scraping',
                  progress: event.progress,
                  index: event.index,
                  total: event.total
                });
                v2Progress.currentlyScraping = [scrapingUrl];
                v2Progress.stats.sitesInProgress = v2Progress.currentlyScraping.length;
                // Set sitesTotal only if it hasn't been set yet or if event.total is provided
                if (event.total && (v2Progress.stats.sitesTotal === 0 || !v2Progress.stats.sitesTotal)) {
                  v2Progress.stats.sitesTotal = event.total;
                }
                break;
                
              case 'site-complete':
                const completeUrl = event.url;
                v2Progress.scrapingStatus.set(completeUrl, {
                  url: completeUrl,
                  status: 'complete',
                  rulesFound: event.rulesFound || 0,
                  progress: 100
                });
                v2Progress.currentlyScraping = v2Progress.currentlyScraping.filter(u => u !== completeUrl);
                v2Progress.stats.sitesScraped = (v2Progress.stats.sitesScraped || 0) + 1;
                v2Progress.stats.sitesInProgress = v2Progress.currentlyScraping.length;
                // Add to total requirements count
                if (event.rulesFound) {
                  v2Progress.stats.totalRequirements = (v2Progress.stats.totalRequirements || 0) + event.rulesFound;
                }
                break;
                
              case 'scraping-complete':
                v2Progress.currentPhase = 'scraping';
                if (event.successCount !== undefined) {
                  v2Progress.stats.sitesScraped = event.successCount;
                }
                if (event.totalRequirements !== undefined) {
                  v2Progress.stats.totalRequirements = event.totalRequirements;
                }
                break;
                
              case 'site-failed':
                const failedUrl = event.url;
                v2Progress.scrapingStatus.set(failedUrl, {
                  url: failedUrl,
                  status: 'failed',
                  error: event.error
                });
                v2Progress.currentlyScraping = v2Progress.currentlyScraping.filter(u => u !== failedUrl);
                v2Progress.stats.sitesFailed++;
                v2Progress.stats.sitesInProgress = v2Progress.currentlyScraping.length;
                break;
                
              case 'processing-data':
              case 'ai-deduplication':
                v2Progress.currentPhase = 'processing';
                break;
                
              case 'ai-deduplication-complete':
                v2Progress.currentPhase = 'processing';
                // Update stats with the deduplicated count
                if (event.afterDedup !== undefined) {
                  v2Progress.stats.totalRequirements = event.afterDedup;
                  v2Progress.stats.duplicatesRemoved = (v2Progress.stats.duplicatesRemoved || 0) + (event.duplicatesRemoved || 0);
                }
                break;
                
              case 'ai-deduplication-failed':
              case 'processing-requirements':
                v2Progress.currentPhase = 'processing';
                break;
                
              case 'scoring-complete':
                break;
                
              case 'aggregation-complete':
                v2Progress.currentPhase = 'processing';
                // Final deduplicated count overrides the running total
                v2Progress.stats.totalRequirements = event.afterDedup || v2Progress.stats.totalRequirements || 0;
                v2Progress.stats.duplicatesRemoved = (event.totalFound || 0) - (event.afterDedup || 0);
                break;
                
              case 'complete':
                v2Progress.currentPhase = 'complete';
                v2Progress.overallProgress = 100;
                if (event.stats) {
                  v2Progress.stats = {
                    ...v2Progress.stats,
                    // Map backend field names to frontend field names
                    federalRequirements: event.stats.federal || 0,
                    stateRequirements: event.stats.state || 0,
                    cityRequirements: event.stats.city || 0,
                    industryRequirements: event.stats.industry || 0,
                    totalRequirements: event.stats.total || 0,
                    sitesScraped: event.stats.sourcesScraped || 0
                  };
                }
                // Fetch the actual results when complete
                if (state.currentCheck?.id) {
                  console.log('Fetching compliance status for:', state.currentCheck.id);
                  apiService.getComplianceStatus(state.currentCheck.id).then(result => {
                    console.log('Received compliance status:', result);
                    console.log('Requirements count:', result.requirements?.length || 0);
                    set({ currentCheck: result });
                  }).catch(error => {
                    console.error('Failed to fetch compliance status:', error);
                  });
                }
                break;
                
              case 'analysis-complete':
                // When analysis is complete, fetch the final results with requirements
                if (state.currentCheck?.id) {
                  console.log('Analysis complete, fetching final results for:', state.currentCheck.id);
                  apiService.getComplianceStatus(state.currentCheck.id).then(result => {
                    console.log('Received final compliance status:', result);
                    console.log('Final requirements count:', result.requirements?.length || 0);
                    set({ currentCheck: result });
                  }).catch(error => {
                    console.error('Failed to fetch final compliance status:', error);
                  });
                }
                break;
                
              case 'error':
                // Keep current phase but show error
                break;
            }
            
            // Calculate estimated time remaining
            if (v2Progress.startTime && v2Progress.overallProgress > 0 && v2Progress.overallProgress < 100) {
              const elapsed = Date.now() - v2Progress.startTime;
              const estimatedTotal = (elapsed / v2Progress.overallProgress) * 100;
              const remaining = estimatedTotal - elapsed;
              const seconds = Math.round(remaining / 1000);
              v2Progress.estimatedTimeRemaining = seconds > 60 
                ? `${Math.round(seconds / 60)} minutes`
                : `${seconds} seconds`;
            }
            
            return { v2Progress };
          });
        },

        // Error handling
        setError: (error) => set({ error }),
        
        clearError: () => set({ error: null }),

        // Reset store
        reset: () => {
          const { unsubscribe } = get();
          if (unsubscribe) {
            unsubscribe();
          }
          apiService.disconnectWebSocket();
          set(initialState);
        },
      }),
      {
        name: 'compliance-store',
        partialize: (state) => ({
          businessProfile: state.businessProfile,
          recentChecks: state.recentChecks,
        }),
      }
    )
  )
);