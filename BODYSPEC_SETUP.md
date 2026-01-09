# Bodyspec DEXA Integration Setup Guide

This guide will walk you through setting up the Bodyspec DEXA scan integration for your BIA Tracker application.

## Overview

The Bodyspec integration allows you to:
- Connect your Bodyspec account using an API token
- Automatically sync your DEXA scan results
- Compare BIA measurements with DEXA scans (the gold standard)
- View side-by-side comparisons of body composition metrics

## Prerequisites

1. A Bodyspec account with DEXA scan data
2. Supabase project configured
3. Your Bodyspec API access token

## Step 1: Database Setup

Run the SQL migration to create the required tables in your Supabase database:

1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the migration file located at: `supabase/migrations/001_create_bodyspec_tables.sql`

This will create:
- `bodyspec_connections` table - stores your Bodyspec API connection
- `bodyspec_scans` table - stores synced DEXA scan data

## Step 2: Get Your Bodyspec API Token

1. Visit [Bodyspec MCP Setup](https://app.bodyspec.com/#mcp-setup)
2. Log in to your Bodyspec account
3. Navigate to the API settings or MCP configuration section
4. Generate or copy your API access token (JWT)
5. Keep this token secure - treat it like a password

## Step 3: Environment Variables (Optional)

For enhanced security with token encryption, add the following to your `.env.local`:

```env
# Optional: Custom encryption key for Bodyspec tokens
BODYSPEC_ENCRYPTION_KEY=your-secure-random-key-here
```

If not provided, a default key will be used (not recommended for production).

## Step 4: Connect Your Bodyspec Account

1. Start your Next.js development server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to your app (usually http://localhost:3000)

3. Click on the "Bodyspec DEXA Integration" section to expand it

4. Click "Connect Bodyspec"

5. Fill in the form:
   - **Connection Name**: A friendly name (e.g., "My Bodyspec Account")
   - **Access Token**: Paste your Bodyspec API token from Step 2

6. Click "Connect"

The app will validate your token and save the connection.

## Step 5: Sync Your DEXA Scans

Once connected, you can sync your DEXA scans:

1. In the Bodyspec section, you'll see a "Sync Now" button
2. Click it to fetch your latest scans from Bodyspec
3. The sync process will:
   - Fetch all completed appointments with scan data
   - Save new scans to your local database
   - Skip scans that have already been synced

## Smart Sync Strategy

The integration uses a smart sync strategy to minimize API calls:

- **Never synced**: Syncs immediately
- **Recent scan (< 7 days)**: Syncs daily
- **Medium age scan (7-30 days)**: Syncs every 3 days
- **Old scan (30-90 days)**: Syncs weekly
- **Very old scan (90+ days)**: Syncs monthly

You can always manually trigger a sync regardless of the schedule.

## Viewing Your Data

### DEXA Scans List
After syncing, your DEXA scans will appear in the Bodyspec section showing:
- Scan date
- Body fat percentage
- Weight
- Lean body mass

### Comparison with BIA Data
The app automatically highlights when you have both BIA and DEXA data from similar dates. DEXA scans are marked with an amber "DEXA" badge for easy identification.

## Understanding BIA vs DEXA

- **DEXA (Dual-Energy X-ray Absorptiometry)**: The gold standard for body composition measurement. Most accurate.
- **BIA (Bioelectrical Impedance Analysis)**: Quick and convenient but can vary ±3-5% from DEXA due to hydration, food intake, and other factors.

Use DEXA scans as your reference point for accurate body composition, and BIA for tracking trends between DEXA scans.

## Troubleshooting

### "Invalid or expired access token"
- Your token may have expired or been revoked
- Get a new token from Bodyspec and reconnect

### "Failed to sync data"
- Check your internet connection
- Verify your Bodyspec account has completed scans
- Check the browser console for detailed error messages

### No scans appearing after sync
- Ensure you have completed DEXA scans in your Bodyspec account
- Check that the scans are marked as "completed" in Bodyspec
- Scan data may take 1-2 days to become available after your appointment

### Connection shows "error" status
- Try disconnecting and reconnecting with a fresh token
- Check Supabase logs for detailed error information

## Security Notes

1. **Token Storage**: Tokens are encrypted before storage in the database
2. **API Routes**: All Bodyspec API calls go through Next.js API routes (never from the client)
3. **Token Transmission**: Tokens are only sent during initial connection over HTTPS
4. **Data Privacy**: All data is stored in your Supabase instance - you control your data

## API Endpoints

The integration provides the following API endpoints:

- `POST /api/bodyspec/connect` - Connect a new Bodyspec account
- `POST /api/bodyspec/sync` - Sync scans from Bodyspec
- `GET /api/bodyspec/scans` - Get stored scans
- `GET /api/bodyspec/connections` - Get connections
- `DELETE /api/bodyspec/disconnect` - Remove a connection

## Data Structure

### BodyspecScanData
```typescript
{
  bodyFatPercentage: number;
  totalBodyFat: number;        // lb
  leanBodyMass: number;        // lb
  boneMineralDensity: number;
  visceralAdiposeTissue: number; // cm²
  weight: number;              // lb
  regional: {
    leftArm: { fat: number, lean: number, bmd?: number },
    rightArm: { fat: number, lean: number, bmd?: number },
    trunk: { fat: number, lean: number, bmd?: number },
    leftLeg: { fat: number, lean: number, bmd?: number },
    rightLeg: { fat: number, lean: number, bmd?: number }
  };
  androidGynoidRatio?: number;
  boneMineralContent?: number;
  tScore?: number;
  zScore?: number;
}
```

## Multiple Accounts

You can connect multiple Bodyspec accounts if needed:
1. Each connection is tracked separately
2. Scans are associated with their respective connections
3. All scans appear in a unified timeline

## Disconnecting

To remove a Bodyspec connection:
1. Click "Disconnect" next to the connection name
2. Confirm the action
3. **Warning**: This will delete all synced scans associated with that connection

## Support

For issues with:
- **Bodyspec API**: Contact Bodyspec support or check [their documentation](https://app.bodyspec.com/docs)
- **Integration code**: Check the GitHub issues or submit a bug report
- **Supabase**: Check Supabase documentation or support

## References

- [Bodyspec API Documentation](https://app.bodyspec.com/docs)
- [Bodyspec MCP Setup Guide](https://app.bodyspec.com/#mcp-setup)
- [Understanding DEXA Scans](https://www.bodyspec.com/what-is-dxa)
- [Interpreting DEXA Results](https://www.bodyspec.com/blog/post/interpreting_dexa_scan_results_tscore_zscore_and_body_composition)
