import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();

    // Forward the request to the actual API
    const apiResponse = await fetch('https://a585-148-252-147-50.ngrok-free.app/outbound-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Get the response data
    const data = await apiResponse.json().catch(() => ({ 
      success: apiResponse.ok,
      status: apiResponse.status,
      message: 'No JSON response' 
    }));

    // Return the response
    return NextResponse.json(data, { status: apiResponse.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 