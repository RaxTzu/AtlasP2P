/**
 * Admin Settings API
 *
 * GET - Fetch all admin settings or by category
 * PUT - Update a setting value
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isUserAdmin, logAdminAction } from '@/lib/security';
import { clearSettingsCache, getYamlConfigValue } from '@/lib/config-overrides';

export const dynamic = 'force-dynamic';

interface AdminSetting {
  id: string;
  key: string;
  value: any;
  description: string | null;
  category: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// GET /api/admin/settings - Get all settings or by category
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check admin privileges
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Use admin client to bypass RLS (we've already verified admin status)
    const adminClient = createAdminClient();
    let query = adminClient.from('admin_settings').select('*').order('category').order('key');

    if (category) {
      query = query.eq('category', category);
    }

    const { data: settings, error } = await query;

    if (error) throw error;

    // Add YAML default values for comparison
    const settingsWithDefaults = (settings || []).map(s => ({
      ...s,
      yaml_default: getYamlConfigValue(s.key),
      is_override: s.value !== getYamlConfigValue(s.key),
    }));

    return NextResponse.json({ settings: settingsWithDefaults });
  } catch (error) {
    console.error('Admin settings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/admin/settings - Update a setting
export async function PUT(request: NextRequest) {
  console.log('[Settings PUT] Handler started');

  const supabase = await createClient();
  const adminClient = createAdminClient();

  console.log('[Settings PUT] Clients created');

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check admin privileges
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
  }

  try {
    console.log('[Settings PUT] Starting...');
    const body = await request.json();
    const { key, value } = body;
    console.log('[Settings PUT] Key:', key, 'Value:', value);

    if (!key) {
      return NextResponse.json({ error: 'Setting key is required' }, { status: 400 });
    }

    // Get current value for audit log
    console.log('[Settings PUT] Fetching current value...');
    const { data: currentSetting, error: fetchError } = await adminClient
      .from('admin_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (fetchError) {
      console.log('[Settings PUT] Fetch error:', fetchError);
    }
    console.log('[Settings PUT] Current value:', currentSetting?.value);

    // Update the setting using RLS-bypassing function
    console.log('[Settings PUT] Updating setting...');
    console.log('[Settings PUT] Value:', value, 'type:', typeof value);

    // Use RPC function to bypass RLS (function runs with SECURITY DEFINER)
    const { data: updatedSetting, error } = await adminClient
      .rpc('update_admin_setting', {
        p_key: key,
        p_value: value,  // Supabase handles JSONB conversion
        p_updated_by: user.id,
      });

    console.log('[Settings PUT] Update response - data:', updatedSetting, 'error:', error);

    if (error) {
      console.error('[Settings PUT] RPC error:', error.code, error.message, error.details);
      console.error('[Settings PUT] Full error object:', JSON.stringify(error));
      // Check for "Setting not found" error from function
      if (error.message?.includes('Setting not found')) {
        return NextResponse.json({ error: 'Setting not found' }, { status: 404 });
      }
      // Throw a proper Error object with the error details
      const errorMsg = error.message || error.hint || error.details || 'Database update failed';
      throw new Error(errorMsg);
    }

    console.log('[Settings PUT] Setting updated successfully:', key, updatedSetting?.id);

    // Log the change (don't let logging failure break the save)
    try {
      await logAdminAction(
        user.id,
        'update_setting',
        'admin_settings',
        key,
        {
          key,
          previous_value: currentSetting?.value,
          new_value: value,
        },
        request
      );
    } catch (logError) {
      console.error('Failed to log admin action:', logError);
      // Continue anyway - the setting was saved
    }

    // Clear the settings cache so changes take effect immediately
    clearSettingsCache();

    // JSONB values are already parsed by Supabase
    return NextResponse.json({
      success: true,
      setting: updatedSetting,
    });
  } catch (error: any) {
    // Comprehensive error logging
    console.error('[Settings PUT] Caught error type:', typeof error);
    console.error('[Settings PUT] Error name:', error?.name);
    console.error('[Settings PUT] Error message:', error?.message);
    console.error('[Settings PUT] Error code:', error?.code);
    console.error('[Settings PUT] Error details:', error?.details);
    console.error('[Settings PUT] Error hint:', error?.hint);
    console.error('[Settings PUT] Error stack:', error?.stack);
    console.error('[Settings PUT] Error keys:', error ? Object.keys(error) : 'null');
    console.error('[Settings PUT] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    const errorMessage = error?.message || error?.code || error?.name || 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST /api/admin/settings - Create a new setting (admin only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check admin privileges
  const isAdmin = await isUserAdmin(user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { key, value, description, category } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Key and value are required' }, { status: 400 });
    }

    const { data: newSetting, error } = await adminClient
      .from('admin_settings')
      .insert({
        key,
        value: value,  // No JSON.stringify - Supabase handles JSONB
        description: description || null,
        category: category || 'general',
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Setting with this key already exists' }, { status: 409 });
      }
      throw error;
    }

    // Log the creation
    await logAdminAction(
      user.id,
      'create_setting',
      'admin_settings',
      key,
      { key, value, description, category },
      request
    );

    // Clear the settings cache so changes take effect immediately
    clearSettingsCache();

    // JSONB values are already parsed by Supabase
    return NextResponse.json({
      success: true,
      setting: newSetting,
    });
  } catch (error) {
    console.error('Admin settings POST error:', error);
    return NextResponse.json({ error: 'Failed to create setting' }, { status: 500 });
  }
}
