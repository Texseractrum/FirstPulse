import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();

    // Get API URL from environment variable
    const apiUrl = process.env.OUTBOUND_CALL_API_URL;
    
    if (!apiUrl) {
      console.error('OUTBOUND_CALL_API_URL environment variable is not set');
      return NextResponse.json(
        { error: 'API URL configuration is missing' },
        { status: 500 }
      );
    }

    console.log(`Making API call to: ${apiUrl}`);

    // Forward the request to the actual API
    const apiResponse = await fetch(`${apiUrl}/outbound-call`, {
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