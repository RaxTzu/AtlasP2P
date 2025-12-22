import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  rateLimit,
  RATE_LIMITS,
  validateFileUpload,
  isImageSafe,
  isUserBanned
} from '@/lib/security'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * Upload avatar for node profile
 * Requires authentication and ownership
 * Includes security checks and content moderation
 *
 * Storage Strategy:
 * - Production: Supabase Storage
 * - Development: Local file storage (public/avatars/)
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id: nodeId } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Check if user is banned
  const banned = await isUserBanned(user.id);
  if (banned) {
    return NextResponse.json(
      { error: 'Your account has been suspended' },
      { status: 403 }
    )
  }

  // Rate limiting - strict for uploads
  const rateLimitResult = await rateLimit(request, 'upload:avatar', RATE_LIMITS.UPLOAD);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        resetAt: rateLimitResult.resetAt.toISOString()
      },
      { status: 429 }
    )
  }

  // Verify user owns this node
  const { data: ownership, error: ownershipError } = await supabase
    .from('verified_nodes')
    .select('id')
    .eq('node_id', nodeId)
    .eq('user_id', user.id)
    .single()

  if (ownershipError || !ownership) {
    return NextResponse.json(
      { error: 'You do not own this node' },
      { status: 403 }
    )
  }

  // Get file from form data
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json(
      { error: 'No file provided' },
      { status: 400 }
    )
  }

  // Validate file upload (type, size, extension)
  const validation = validateFileUpload(file);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    )
  }

  // Check magic bytes to ensure it's actually an image
  const buffer = await file.arrayBuffer();
  const isSafe = await isImageSafe(buffer);
  if (!isSafe) {
    return NextResponse.json(
      { error: 'Invalid image file or potentially malicious content detected' },
      { status: 400 }
    )
  }

  // Generate unique filename
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
  const fileName = `${nodeId}-${Date.now()}.${fileExt}`

  // Try Supabase Storage first (production), fallback to local (development)
  try {
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('node-avatars')
      .upload(`avatars/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (!uploadError) {
      // Get public URL from Supabase Storage
      const { data: urlData } = supabase.storage
        .from('node-avatars')
        .getPublicUrl(`avatars/${fileName}`)

      return NextResponse.json({
        url: urlData.publicUrl,
        path: `avatars/${fileName}`,
        storage: 'supabase'
      })
    }

    // If Supabase Storage fails (e.g., bucket doesn't exist), fall back to local storage
    console.log('Supabase Storage not available, using local storage:', uploadError.message)
  } catch (error) {
    console.log('Supabase Storage error, falling back to local:', error)
  }

  // Fallback: Local file storage (development mode)
  try {
    const publicDir = path.join(process.cwd(), 'public', 'avatars')

    // Ensure avatars directory exists
    await mkdir(publicDir, { recursive: true })

    // Write file to public/avatars/
    const filePath = path.join(publicDir, fileName)
    const uint8Array = new Uint8Array(buffer)
    await writeFile(filePath, uint8Array)

    // Return public URL
    const publicUrl = `/avatars/${fileName}`

    return NextResponse.json({
      url: publicUrl,
      path: publicUrl,
      storage: 'local'
    })
  } catch (error) {
    console.error('Local file storage error:', error)
    return NextResponse.json(
      { error: 'Failed to save avatar file' },
      { status: 500 }
    )
  }
}
