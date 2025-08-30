import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WARMUP_KEY = 'complianceiq_warmup_complete';
const WARMUP_TIMESTAMP_KEY = 'complianceiq_warmup_timestamp';

export class WarmupService {
  /**
   * Check if warmup should be shown
   * Returns true if this is the first visit in the current session
   */
  static shouldShowWarmup(): boolean {
    const warmupComplete = sessionStorage.getItem(WARMUP_KEY);
    return !warmupComplete;
  }

  /**
   * Mark warmup as complete for this session
   */
  static markWarmupComplete(): void {
    sessionStorage.setItem(WARMUP_KEY, 'true');
    sessionStorage.setItem(WARMUP_TIMESTAMP_KEY, new Date().toISOString());
  }

  /**
   * Call the backend warmup endpoint
   * Returns true if successful, false if failed
   */
  static async warmupBackend(): Promise<boolean> {
    try {
      const response = await axios.get(`${API_URL}/api/warmup`, {
        timeout: 35000, // 35 seconds timeout (slightly more than expected 30s)
      });
      
      if (response.data.status === 'ok') {
        return true;
      }
      return false;
    } catch (error) {
      // This is expected on cold start, don't treat as error
      console.log('Backend is warming up (this is normal on first visit)');
      return false;
    }
  }

  /**
   * Get warmup timestamp if exists
   */
  static getWarmupTimestamp(): string | null {
    return sessionStorage.getItem(WARMUP_TIMESTAMP_KEY);
  }

  /**
   * Clear warmup status (useful for testing)
   */
  static clearWarmupStatus(): void {
    sessionStorage.removeItem(WARMUP_KEY);
    sessionStorage.removeItem(WARMUP_TIMESTAMP_KEY);
  }
}