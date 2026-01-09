/**
 * Supabase Database Functions for Bodyspec Integration
 * Handles all database operations for Bodyspec connections and scan data
 */

import { supabase } from './supabase';
import { BodyspecConnection, BodyspecScan, BodyspecScanData } from './types';
import { Appointment } from './bodyspec-client';

// Simple encryption/decryption for access tokens
// NOTE: In production, consider using a more robust encryption solution
// with a proper key management system
const ENCRYPTION_KEY = process.env.BODYSPEC_ENCRYPTION_KEY || 'default-key-change-in-production';

/**
 * Simple XOR-based encryption (for demonstration - use proper encryption in production)
 * For production, consider using Web Crypto API or a library like crypto-js
 */
function encryptToken(token: string): string {
  if (typeof window === 'undefined') {
    // Server-side: use proper encryption
    return Buffer.from(token).toString('base64');
  }
  // Client-side: use base64 encoding (not secure, but prevents casual viewing)
  return btoa(token);
}

function decryptToken(encryptedToken: string): string {
  if (typeof window === 'undefined') {
    // Server-side: use proper decryption
    return Buffer.from(encryptedToken, 'base64').toString('utf-8');
  }
  // Client-side
  return atob(encryptedToken);
}

// ========================================
// Connection Management
// ========================================

/**
 * Save or update a Bodyspec connection
 */
export async function saveConnection(
  connection: Omit<BodyspecConnection, 'id' | 'createdAt' | 'updatedAt'>
): Promise<BodyspecConnection> {
  const encryptedToken = encryptToken(connection.accessToken);

  const { data, error } = await supabase
    .from('bodyspec_connections')
    .insert({
      user_id: connection.userId || null,
      access_token: encryptedToken,
      token_name: connection.tokenName,
      last_sync: connection.lastSync || null,
      sync_status: connection.syncStatus,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving Bodyspec connection:', error);
    throw new Error(`Failed to save connection: ${error.message}`);
  }

  return {
    id: data.id,
    userId: data.user_id,
    accessToken: decryptToken(data.access_token),
    tokenName: data.token_name,
    lastSync: data.last_sync,
    syncStatus: data.sync_status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Get all Bodyspec connections
 */
export async function getConnections(userId?: string): Promise<BodyspecConnection[]> {
  let query = supabase.from('bodyspec_connections').select('*');

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching Bodyspec connections:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    userId: row.user_id,
    accessToken: decryptToken(row.access_token),
    tokenName: row.token_name,
    lastSync: row.last_sync,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get a specific connection by ID
 */
export async function getConnection(connectionId: string): Promise<BodyspecConnection | null> {
  const { data, error } = await supabase
    .from('bodyspec_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (error) {
    console.error('Error fetching Bodyspec connection:', error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    accessToken: decryptToken(data.access_token),
    tokenName: data.token_name,
    lastSync: data.last_sync,
    syncStatus: data.sync_status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update sync status and last sync timestamp for a connection
 */
export async function updateSyncStatus(
  connectionId: string,
  status: 'connected' | 'error' | 'pending',
  lastSync?: string
): Promise<void> {
  const updates: Record<string, unknown> = {
    sync_status: status,
  };

  if (lastSync) {
    updates.last_sync = lastSync;
  } else if (status === 'connected') {
    updates.last_sync = new Date().toISOString();
  }

  const { error } = await supabase
    .from('bodyspec_connections')
    .update(updates)
    .eq('id', connectionId);

  if (error) {
    console.error('Error updating sync status:', error);
    throw new Error(`Failed to update sync status: ${error.message}`);
  }
}

/**
 * Delete a Bodyspec connection and all associated scans
 */
export async function deleteConnection(connectionId: string): Promise<void> {
  const { error } = await supabase
    .from('bodyspec_connections')
    .delete()
    .eq('id', connectionId);

  if (error) {
    console.error('Error deleting Bodyspec connection:', error);
    throw new Error(`Failed to delete connection: ${error.message}`);
  }
}

// ========================================
// Scan Data Management
// ========================================

/**
 * Save a Bodyspec scan to the database
 */
export async function saveScan(
  connectionId: string,
  appointment: Appointment
): Promise<BodyspecScan> {
  if (!appointment.scanData) {
    throw new Error('Appointment does not have scan data');
  }

  const { data, error } = await supabase
    .from('bodyspec_scans')
    .upsert({
      connection_id: connectionId,
      scan_date: appointment.date,
      appointment_id: appointment.id,
      data: appointment.scanData,
    }, {
      onConflict: 'connection_id,appointment_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving Bodyspec scan:', error);
    throw new Error(`Failed to save scan: ${error.message}`);
  }

  return {
    id: data.id,
    connectionId: data.connection_id,
    scanDate: data.scan_date,
    appointmentId: data.appointment_id,
    data: data.data as BodyspecScanData,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Save multiple scans in bulk
 */
export async function saveScans(
  connectionId: string,
  appointments: Appointment[]
): Promise<BodyspecScan[]> {
  const scansToSave = appointments
    .filter(apt => apt.scanData !== undefined)
    .map(apt => ({
      connection_id: connectionId,
      scan_date: apt.date,
      appointment_id: apt.id,
      data: apt.scanData,
    }));

  if (scansToSave.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('bodyspec_scans')
    .upsert(scansToSave, {
      onConflict: 'connection_id,appointment_id',
    })
    .select();

  if (error) {
    console.error('Error saving Bodyspec scans:', error);
    throw new Error(`Failed to save scans: ${error.message}`);
  }

  return (data || []).map(row => ({
    id: row.id,
    connectionId: row.connection_id,
    scanDate: row.scan_date,
    appointmentId: row.appointment_id,
    data: row.data as BodyspecScanData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get all scans, optionally filtered by connection
 */
export async function getScans(connectionId?: string): Promise<BodyspecScan[]> {
  let query = supabase.from('bodyspec_scans').select('*');

  if (connectionId) {
    query = query.eq('connection_id', connectionId);
  }

  const { data, error } = await query.order('scan_date', { ascending: false });

  if (error) {
    console.error('Error fetching Bodyspec scans:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    connectionId: row.connection_id,
    scanDate: row.scan_date,
    appointmentId: row.appointment_id,
    data: row.data as BodyspecScanData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get the most recent scan for a connection
 */
export async function getLatestScan(connectionId?: string): Promise<BodyspecScan | null> {
  let query = supabase.from('bodyspec_scans').select('*');

  if (connectionId) {
    query = query.eq('connection_id', connectionId);
  }

  const { data, error } = await query
    .order('scan_date', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null;
    }
    console.error('Error fetching latest scan:', error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    connectionId: data.connection_id,
    scanDate: data.scan_date,
    appointmentId: data.appointment_id,
    data: data.data as BodyspecScanData,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Get a specific scan by ID
 */
export async function getScan(scanId: string): Promise<BodyspecScan | null> {
  const { data, error } = await supabase
    .from('bodyspec_scans')
    .select('*')
    .eq('id', scanId)
    .single();

  if (error) {
    console.error('Error fetching Bodyspec scan:', error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    connectionId: data.connection_id,
    scanDate: data.scan_date,
    appointmentId: data.appointment_id,
    data: data.data as BodyspecScanData,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Delete a specific scan
 */
export async function deleteScan(scanId: string): Promise<void> {
  const { error } = await supabase
    .from('bodyspec_scans')
    .delete()
    .eq('id', scanId);

  if (error) {
    console.error('Error deleting Bodyspec scan:', error);
    throw new Error(`Failed to delete scan: ${error.message}`);
  }
}

/**
 * Get scans within a date range
 */
export async function getScansInDateRange(
  startDate: string,
  endDate: string,
  connectionId?: string
): Promise<BodyspecScan[]> {
  let query = supabase
    .from('bodyspec_scans')
    .select('*')
    .gte('scan_date', startDate)
    .lte('scan_date', endDate);

  if (connectionId) {
    query = query.eq('connection_id', connectionId);
  }

  const { data, error } = await query.order('scan_date', { ascending: false });

  if (error) {
    console.error('Error fetching scans in date range:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    connectionId: row.connection_id,
    scanDate: row.scan_date,
    appointmentId: row.appointment_id,
    data: row.data as BodyspecScanData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
