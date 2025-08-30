import { io, Socket } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

export interface BusinessProfile {
  state: string;
  city: string;
  industry: string;
  naicsCode?: string;
  employees: number;
  revenue?: number;
  hasPhysicalLocation: boolean;
  sellsProducts: boolean;
  sellsServices: boolean;
  hasVehicles: boolean;
  handlesFoodBeverage: boolean;
  storesPersonalData: boolean;
  acceptsOnlinePayments: boolean;
  hasHazardousMaterials: boolean;
  businessStructure?: string;
}

export interface ComplianceCheckResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requirements: ComplianceRequirement[];
  coverage?: CoverageReport;
  workflowStatus?: WorkflowStatus;
  error?: string;
}

export interface ComplianceRequirement {
  id: string;
  requirement: string;
  description: string;
  source: string;
  sourceUrl: string;
  citation?: string;
  deadline?: string;
  penalty?: string;
  actionRequired?: string;
  category: 'federal' | 'state' | 'city' | 'industry';
  jurisdiction?: string;
  forms?: string[];
  estimatedCost?: string;
}

export interface CoverageReport {
  overallScore: number;
  federal: { found: number; expected: number; score: number };
  state: { found: number; expected: number; score: number };
  city: { found: number; expected: number; score: number };
  industry: { found: number; expected: number; score: number };
  gaps: string[];
  recommendations: string[];
}

export interface WorkflowStatus {
  currentNode: string;
  message: string;
  progress: number;
  details?: string;
}

export interface WorkflowEvent {
  type: 'status' | 'progress' | 'result' | 'error';
  checkId: string;
  data: any;
}

class ApiService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(event: WorkflowEvent) => void>> = new Map();

  private async fetchWithErrorHandling(url: string, options?: RequestInit): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  }

  async checkCompliance(profile: BusinessProfile): Promise<ComplianceCheckResponse> {
    // Transform the frontend profile format to backend format
    const specialFactors: string[] = [];
    
    if (profile.hasPhysicalLocation) specialFactors.push('Has physical location');
    if (profile.sellsProducts) specialFactors.push('Sells products');
    if (profile.sellsServices) specialFactors.push('Sells services');
    if (profile.hasVehicles) specialFactors.push('Operates vehicles');
    if (profile.handlesFoodBeverage) specialFactors.push('Handles food/beverage');
    if (profile.storesPersonalData) specialFactors.push('Stores personal data');
    if (profile.acceptsOnlinePayments) specialFactors.push('Accepts online payments');
    if (profile.hasHazardousMaterials) specialFactors.push('Handles hazardous materials');
    if (profile.businessStructure) specialFactors.push(`Business structure: ${profile.businessStructure}`);

    const backendProfile = {
      state: profile.state,
      city: profile.city,
      industry: profile.industry,
      naicsCode: profile.naicsCode,
      employeeCount: profile.employees,
      annualRevenue: profile.revenue,
      specialFactors
    };

    const response = await this.fetchWithErrorHandling(`${API_BASE_URL}/api/compliance/check`, {
      method: 'POST',
      body: JSON.stringify({
        businessProfile: backendProfile,
        sessionId: this.socket?.id
      }),
    });

    return response.json();
  }

  async getComplianceStatus(checkId: string): Promise<ComplianceCheckResponse> {
    const response = await this.fetchWithErrorHandling(`${API_BASE_URL}/api/compliance/status/${checkId}`);
    return response.json();
  }

  connectWebSocket(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(WS_URL, {
      transports: ['polling', 'websocket'], // Start with polling, upgrade to websocket
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    // Listen for compliance updates from backend
    this.socket.on('compliance-update', (event: any) => {
      console.log('Received compliance update:', event);
      
      // Pass the event directly without wrapping in data
      const workflowEvent: WorkflowEvent = {
        ...event,
        type: event.type || 'status',
        checkId: event.checkId
      };
      
      const checkListeners = this.listeners.get(workflowEvent.checkId) || new Set();
      checkListeners.forEach(listener => listener(workflowEvent));
    });

    this.socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
    });

    return this.socket;
  }

  disconnectWebSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  subscribeToCheck(checkId: string, callback: (event: WorkflowEvent) => void): () => void {
    if (!this.socket) {
      this.connectWebSocket();
    }

    if (!this.listeners.has(checkId)) {
      this.listeners.set(checkId, new Set());
    }

    const checkListeners = this.listeners.get(checkId)!;
    checkListeners.add(callback);

    // Join the room for this check
    this.socket?.emit('compliance:subscribe', { checkId });

    // Return unsubscribe function
    return () => {
      checkListeners.delete(callback);
      if (checkListeners.size === 0) {
        this.listeners.delete(checkId);
        this.socket?.emit('compliance:unsubscribe', { checkId });
      }
    };
  }

}

export const apiService = new ApiService();