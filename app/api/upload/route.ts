import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    let buffer: Buffer | null = null;
    let contentType = 'image/png';

    // Try to get image as File first
    const imageField = formData.get('image');

    if (imageField && typeof imageField === 'object' && 'arrayBuffer' in imageField) {
      // File or Blob upload
      const arrayBuffer = await (imageField as File).arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      contentType = (imageField as File).type || 'image/png';
    } else if (typeof imageField === 'string' && imageField.length > 0) {
      // Could be base64 data
      if (imageField.startsWith('data:image')) {
        // Data URL format: data:image/png;base64,xxxxx
        const matches = imageField.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          contentType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
        }
      } else if (imageField.startsWith('/') || imageField.startsWith('file:')) {
        // It's a file path - can't process this server-side
        return NextResponse.json({
          error: 'Received file path instead of image data. Please update your shortcut.',
          debug: {
            hint: 'In Shortcuts, add "Base64 Encode" action before sending',
            received: imageField.substring(0, 100)
          }
        }, { status: 400 });
      } else if (imageField.length > 100) {
        // Assume it's base64 data (might not have padding)
        try {
          buffer = Buffer.from(imageField, 'base64');
          // Verify it's actually valid image data by checking for common image headers
          if (buffer.length > 8) {
            // PNG starts with 0x89 0x50 0x4E 0x47
            if (buffer[0] === 0x89 && buffer[1] === 0x50) {
              contentType = 'image/png';
            }
            // JPEG starts with 0xFF 0xD8 0xFF
            else if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
              contentType = 'image/jpeg';
            }
          }
        } catch {
          buffer = null;
        }
      }
    }

    // Try other field names if image didn't work
    if (!buffer) {
      for (const [key, value] of formData.entries()) {
        if (value && typeof value === 'object' && 'arrayBuffer' in value) {
          const arrayBuffer = await (value as File).arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
          contentType = (value as File).type || 'image/png';
          break;
        }
      }
    }

    if (!buffer || buffer.length === 0) {
      const keys = Array.from(formData.keys());
      const types: Record<string, string> = {};
      for (const [key, value] of formData.entries()) {
        if (value && typeof value === 'object' && 'arrayBuffer' in value) {
          types[key] = 'File/Blob';
        } else {
          types[key] = typeof value;
        }
      }
      // Add preview of string value for debugging
      let stringPreview = '';
      const imgField = formData.get('image');
      if (typeof imgField === 'string') {
        stringPreview = imgField.substring(0, 200);
      }
      return NextResponse.json({
        error: 'No image provided',
        debug: { receivedFields: keys, fieldTypes: types, stringPreview }
      }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate unique filename
    const timestamp = Date.now();
    const ext = contentType.split('/')[1] || 'png';
    const filename = `pending/${timestamp}.${ext}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('bia-images')
      .upload(filename, buffer, {
        contentType: contentType,
        upsert: false
      });

    if (uploadError) {
      // If bucket doesn't exist, create a pending entry in DB instead
      if (uploadError.message.includes('not found') || uploadError.message.includes('Bucket')) {
        // Store base64 in database as fallback
        const base64 = buffer.toString('base64');
        const { error: dbError } = await supabase
          .from('pending_images')
          .insert({
            id: timestamp.toString(),
            data: base64,
            content_type: contentType,
            created_at: new Date().toISOString()
          });

        if (dbError) {
          console.error('DB insert error:', dbError);
          return NextResponse.json({
            success: false,
            error: 'Storage not configured. Please upload manually.'
          }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: 'Image queued! Open Baseline to process.',
          method: 'database'
        });
      }

      console.error('Storage upload error:', uploadError);
      return NextResponse.json({
        success: false,
        error: 'Failed to store image: ' + uploadError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Image uploaded! Open Baseline to process.',
      filename
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({
      success: false,
      error: 'Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'Baseline Upload API',
    usage: 'POST with multipart/form-data, field name: image'
  });
}
