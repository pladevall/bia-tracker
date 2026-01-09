/**
 * Bodyspec API Client
 * Handles all interactions with the Bodyspec API using Bearer token authentication
 *
 * API Documentation: https://app.bodyspec.com/docs
 * MCP Setup Guide: https://app.bodyspec.com/#mcp-setup
 */

import { BodyspecScanData } from './types';

const BODYSPEC_API_BASE = 'https://app.bodyspec.com/api';

export interface BodyspecAPIError {
  message: string;
  status?: number;
  details?: unknown;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  date: string;
  location: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  scanData?: BodyspecScanData;
}

export interface AppointmentListResponse {
  appointments: Appointment[];
  total: number;
}

/**
 * Bodyspec API Client
 * All methods are async and throw BodyspecAPIError on failure
 */
export class BodyspecClient {
  private accessToken: string;
  private baseUrl: string;

  constructor(accessToken: string, baseUrl: string = BODYSPEC_API_BASE) {
    this.accessToken = accessToken;
    this.baseUrl = baseUrl;
  }

  /**
   * Make an authenticated request to the Bodyspec API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`;

        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          // If error body is not JSON, use the raw text
          if (errorBody) {
            errorMessage = errorBody;
          }
        }

        throw {
          message: errorMessage,
          status: response.status,
          details: errorBody,
        } as BodyspecAPIError;
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      return JSON.parse(text) as T;
    } catch (error) {
      if ((error as BodyspecAPIError).message) {
        throw error;
      }

      throw {
        message: `Network error: ${(error as Error).message}`,
        details: error,
      } as BodyspecAPIError;
    }
  }

  /**
   * Validate the access token by making a test API call
   * Returns true if token is valid, throws error otherwise
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.getApiInfo();
      return true;
    } catch (error) {
      const apiError = error as BodyspecAPIError;
      if (apiError.status === 401 || apiError.status === 403) {
        throw {
          message: 'Invalid or expired access token',
          status: apiError.status,
        } as BodyspecAPIError;
      }
      throw error;
    }
  }

  /**
   * Get API information and version
   */
  async getApiInfo(): Promise<{ version: string; status: string }> {
    return this.request('/info');
  }

  /**
   * Check API health status
   */
  async healthCheck(): Promise<{ status: string }> {
    return this.request('/health');
  }

  /**
   * Get current user profile information
   */
  async getUserInfo(): Promise<UserInfo> {
    return this.request('/user');
  }

  /**
   * Update user profile information
   */
  async updateUserInfo(updates: Partial<UserInfo>): Promise<UserInfo> {
    return this.request('/user', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * List user appointments with optional filtering
   * @param filters - Optional filters for date range, status, etc.
   */
  async listAppointments(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<AppointmentListResponse> {
    const queryParams = new URLSearchParams();

    if (filters) {
      if (filters.startDate) queryParams.set('start_date', filters.startDate);
      if (filters.endDate) queryParams.set('end_date', filters.endDate);
      if (filters.status) queryParams.set('status', filters.status);
      if (filters.limit) queryParams.set('limit', filters.limit.toString());
      if (filters.offset) queryParams.set('offset', filters.offset.toString());
    }

    const queryString = queryParams.toString();
    const endpoint = `/appointments${queryString ? `?${queryString}` : ''}`;

    return this.request<AppointmentListResponse>(endpoint);
  }

  /**
   * Get detailed information about a specific appointment including scan data
   */
  async getAppointment(appointmentId: string): Promise<Appointment> {
    return this.request(`/appointments/${appointmentId}`);
  }

  /**
   * Get scan results for a specific appointment
   */
  async getScanData(appointmentId: string): Promise<BodyspecScanData> {
    const appointment = await this.getAppointment(appointmentId);

    if (!appointment.scanData) {
      throw {
        message: 'Scan data not available for this appointment',
        details: { appointmentId, status: appointment.status },
      } as BodyspecAPIError;
    }

    return appointment.scanData;
  }

  /**
   * Fetch all completed scans (appointments with scan data)
   * This is useful for initial sync or bulk import
   */
  async fetchAllScans(options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<Appointment[]> {
    const response = await this.listAppointments({
      status: 'completed',
      startDate: options?.startDate,
      endDate: options?.endDate,
      limit: 100, // Adjust based on API limits
    });

    // Filter to only appointments with scan data
    return response.appointments.filter(apt => apt.scanData !== undefined);
  }

  /**
   * Fetch the most recent scan
   */
  async fetchLatestScan(): Promise<Appointment | null> {
    const response = await this.listAppointments({
      status: 'completed',
      limit: 1,
    });

    if (response.appointments.length === 0) {
      return null;
    }

    const latest = response.appointments[0];

    // If scan data is not included, fetch it
    if (!latest.scanData) {
      try {
        latest.scanData = await this.getScanData(latest.id);
      } catch {
        // Scan data not available yet
        return null;
      }
    }

    return latest;
  }
}

/**
 * Create a new Bodyspec API client instance
 */
export function createBodyspecClient(accessToken: string): BodyspecClient {
  return new BodyspecClient(accessToken);
}

/**
 * Test if a token is valid without saving it
 */
export async function testBodyspecToken(accessToken: string): Promise<{
  valid: boolean;
  error?: string;
  userInfo?: UserInfo;
}> {
  try {
    const client = new BodyspecClient(accessToken);
    await client.validateToken();
    const userInfo = await client.getUserInfo();

    return {
      valid: true,
      userInfo,
    };
  } catch (error) {
    const apiError = error as BodyspecAPIError;
    return {
      valid: false,
      error: apiError.message || 'Unknown error validating token',
    };
  }
}
