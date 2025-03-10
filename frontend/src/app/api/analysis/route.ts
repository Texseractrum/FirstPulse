import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Store analyses persistently in a JSON file
const ANALYSIS_FILE = path.join(process.cwd(), 'analysis_data.json');

// Initialize with empty data if file doesn't exist
async function getStoredAnalyses() {
  try {
    const data = await fs.readFile(ANALYSIS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Return empty object if file doesn't exist or has invalid JSON
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Log the received data for debugging
    console.log('Received analysis data:', data);
    
    // Extract scenario ID or try to match by name
    let scenarioId = data.scenarioId; // Use the ID we added in outbound.js
    
    if (!scenarioId) {
      // Fallback to matching by name if ID wasn't provided
      const scenarioName = data.scenario || '';
      if (scenarioName.includes('John Smith')) {
        scenarioId = 1;
      } else if (scenarioName.includes('Sarah Johnson')) {
        scenarioId = 2;
      } else if (scenarioName.includes('Michael Chen')) {
        scenarioId = 3;
      }
    }
    
    if (!scenarioId) {
      return NextResponse.json(
        { error: 'Could not identify scenario' },
        { status: 400 }
      );
    }
    
    // Store the analysis with other analyses
    const analyses = await getStoredAnalyses();
    analyses[scenarioId] = {
      ...data,
      receivedAt: new Date().toISOString()
    };
    
    // Save updated analyses
    await fs.writeFile(ANALYSIS_FILE, JSON.stringify(analyses, null, 2));
    
    // Log success for debugging
    console.log(`Stored analysis for scenario ID ${scenarioId}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Analysis received and stored successfully',
      scenarioId,
      status: data.pass_fail
    });
  } catch (error) {
    console.error('Error processing analysis:', error);
    return NextResponse.json(
      { error: 'Failed to process analysis data' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const scenarioId = searchParams.get('id');
  
  if (!scenarioId) {
    return NextResponse.json(
      { error: 'Scenario ID is required' },
      { status: 400 }
    );
  }
  
  try {
    const analyses = await getStoredAnalyses();
    const result = analyses[scenarioId];
    
    if (!result) {
      return NextResponse.json(
        { error: 'No analysis found for this scenario' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error retrieving analysis for scenario ${scenarioId}:`, error);
    return NextResponse.json(
      { error: 'Failed to retrieve analysis' },
      { status: 500 }
    );
  }
} 