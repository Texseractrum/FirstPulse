import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import Twilio from 'twilio';
import WebSocket from 'ws';
import OpenAI from 'openai';
import fs from 'fs/promises';

// Load environment variables from .env file
dotenv.config();

// Check for required environment variables
const {
  ELEVENLABS_API_KEY,
  ELEVENLABS_AGENT_ID,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  OPENAI_API_KEY,
} = process.env;

if (
  !ELEVENLABS_API_KEY ||
  !ELEVENLABS_AGENT_ID ||
  !TWILIO_ACCOUNT_SID ||
  !TWILIO_AUTH_TOKEN ||
  !TWILIO_PHONE_NUMBER ||
  !OPENAI_API_KEY
) {
  console.error('Missing required environment variables');
  throw new Error('Missing required environment variables');
}

// Initialize Fastify server
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

const PORT = process.env.PORT || 8000;

// Root route for health check
fastify.get('/', async (_, reply) => {
  reply.send({ message: 'Server is running' });
});

// Initialize Twilio client
const twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Helper function to get signed URL for authenticated conversations
async function getSignedUrl() {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    const data = await response.json();
    return data.signed_url;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw error;
  }
}

// Route to initiate outbound calls
fastify.post('/outbound-call', async (request, reply) => {
  const { number, prompt, first_message } = request.body;

  if (!number) {
    return reply.code(400).send({ error: 'Phone number is required' });
  }

  try {
    const call = await twilioClient.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to: number,
      url: `https://${request.headers.host}/outbound-call-twiml?prompt=${encodeURIComponent(
        prompt
      )}&first_message=${encodeURIComponent(first_message)}`,
    });

    reply.send({
      success: true,
      message: 'Call initiated',
      callSid: call.sid,
    });
  } catch (error) {
    console.error('Error initiating outbound call:', error);
    reply.code(500).send({
      success: false,
      error: 'Failed to initiate call',
    });
  }
});

// TwiML route for outbound calls
fastify.all('/outbound-call-twiml', async (request, reply) => {
  const prompt = request.query.prompt || '';
  const first_message = request.query.first_message || '';

  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Connect>
        <Stream url="wss://${request.headers.host}/outbound-media-stream">
            <Parameter name="prompt" value="${prompt}" />
            <Parameter name="first_message" value="${first_message}" />
        </Stream>
        </Connect>
    </Response>`;

  reply.type('text/xml').send(twimlResponse);
});

// WebSocket route for handling media streams
fastify.register(async (fastifyInstance) => {
  fastifyInstance.get('/outbound-media-stream', { websocket: true }, (ws, req) => {
    console.info('[Server] Twilio connected to outbound media stream');

    // Variables to track the call
    let streamSid = null;
    let callSid = null;
    let elevenLabsWs = null;
    let customParameters = null; // Add this to store parameters
    let conversationHistory = [];
    let callStartTime = null;

    // Handle WebSocket errors
    ws.on('error', console.error);

    // Set up ElevenLabs connection
    const setupElevenLabs = async () => {
      try {
        const signedUrl = await getSignedUrl();
        elevenLabsWs = new WebSocket(signedUrl);

        elevenLabsWs.on('open', () => {
          console.log('[ElevenLabs] Connected to Conversational AI');

          // Send initial configuration with prompt and first message
          const initialConfig = {
            type: 'conversation_initiation_client_data',
            dynamic_variables: {
              user_name: 'Angelo',
              user_id: 1234,
            },
            conversation_config_override: {
              agent: {
                prompt: {
                  prompt: customParameters?.prompt || 'you are a gary from the phone store',
                },
                first_message:
                  customParameters?.first_message || 'hey there! how can I help you today?',
              },
            },
          };

          console.log(
            '[ElevenLabs] Sending initial config with prompt:',
            initialConfig.conversation_config_override.agent.prompt.prompt
          );

          // Send the configuration to ElevenLabs
          elevenLabsWs.send(JSON.stringify(initialConfig));
        });

        elevenLabsWs.on('message', (data) => {
          try {
            const message = JSON.parse(data);

            switch (message.type) {
              case 'conversation_initiation_metadata':
                console.log('[ElevenLabs] Received initiation metadata');
                break;

              case 'audio':
                if (streamSid) {
                  if (message.audio?.chunk) {
                    const audioData = {
                      event: 'media',
                      streamSid,
                      media: {
                        payload: message.audio.chunk,
                      },
                    };
                    ws.send(JSON.stringify(audioData));
                  } else if (message.audio_event?.audio_base_64) {
                    const audioData = {
                      event: 'media',
                      streamSid,
                      media: {
                        payload: message.audio_event.audio_base_64,
                      },
                    };
                    ws.send(JSON.stringify(audioData));
                  }
                } else {
                  console.log('[ElevenLabs] Received audio but no StreamSid yet');
                }
                break;

              case 'interruption':
                if (streamSid) {
                  ws.send(
                    JSON.stringify({
                      event: 'clear',
                      streamSid,
                    })
                  );
                }
                break;

              case 'ping':
                if (message.ping_event?.event_id) {
                  elevenLabsWs.send(
                    JSON.stringify({
                      type: 'pong',
                      event_id: message.ping_event.event_id,
                    })
                  );
                }
                break;

              case 'agent_response':
                const agentResponse = message.agent_response_event?.agent_response;
                console.log(
                  `[Twilio] Agent response: ${agentResponse}`
                );
                
                // Add to conversation history
                if (agentResponse) {
                  conversationHistory.push({
                    role: "assistant",
                    content: agentResponse
                  });
                }
                break;

              case 'user_transcript':
                const userTranscript = message.user_transcription_event?.user_transcript;
                console.log(
                  `[Twilio] User transcript: ${userTranscript}`
                );
                
                // Add to conversation history
                if (userTranscript) {
                  conversationHistory.push({
                    role: "user",
                    content: userTranscript
                  });
                }
                break;

              default:
                console.log(`[ElevenLabs] Unhandled message type: ${message.type}`);
            }
          } catch (error) {
            console.error('[ElevenLabs] Error processing message:', error);
          }
        });

        elevenLabsWs.on('error', (error) => {
          console.error('[ElevenLabs] WebSocket error:', error);
        });

        elevenLabsWs.on('close', () => {
          console.log('[ElevenLabs] Disconnected');
        });
      } catch (error) {
        console.error('[ElevenLabs] Setup error:', error);
      }
    };

    // Set up ElevenLabs connection
    setupElevenLabs();

    // Handle messages from Twilio
    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.event !== 'media') {
          console.log(`[Twilio] Received event: ${msg.event}`);
        }

        switch (msg.event) {
          case 'start':
            streamSid = msg.start.streamSid;
            callSid = msg.start.callSid;
            customParameters = msg.start.customParameters;
            callStartTime = new Date();
            
            // Initialize conversation with the prompt and first message
            conversationHistory.push({
              role: "system", 
              content: customParameters?.prompt || 'Default prompt'
            });
            conversationHistory.push({
              role: "assistant", 
              content: customParameters?.first_message || 'Default message'
            });
            
            console.log(`[Twilio] Stream started - StreamSid: ${streamSid}, CallSid: ${callSid}`);
            console.log('[Twilio] Start parameters:', customParameters);
            break;

          case 'media':
            if (elevenLabsWs?.readyState === WebSocket.OPEN) {
              const audioMessage = {
                user_audio_chunk: Buffer.from(msg.media.payload, 'base64').toString('base64'),
              };
              elevenLabsWs.send(JSON.stringify(audioMessage));
            }
            break;

          case 'stop':
            console.log(`[Twilio] Stream ${streamSid} ended`);
            
            // Analyze conversation with OpenAI
            if (conversationHistory.length > 0) {
              analyzeConversation(callSid, conversationHistory, customParameters).catch(console.error);
            }
            
            if (elevenLabsWs?.readyState === WebSocket.OPEN) {
              elevenLabsWs.close();
            }
            break;

          default:
            console.log(`[Twilio] Unhandled event: ${msg.event}`);
        }
      } catch (error) {
        console.error('[Twilio] Error processing message:', error);
      }
    });

    // Handle WebSocket closure
    ws.on('close', () => {
      console.log('[Twilio] Client disconnected');
      if (elevenLabsWs?.readyState === WebSocket.OPEN) {
        elevenLabsWs.close();
      }
    });
  });
});

// Update the analyzeConversation function to include transcript in the analysis prompt
async function analyzeConversation(callSid, conversationHistory, parameters) {
  try {
    // Better scenario name extraction
    let scenarioName = "Unknown scenario";
    const promptText = parameters?.prompt || '';
    
    if (promptText.includes("John Smith")) {
      scenarioName = "John Smith - Elderly patient with chest pain";
    } else if (promptText.includes("Sarah Johnson")) {
      scenarioName = "Sarah Johnson - Unconscious teenager";
    } else if (promptText.includes("Michael Chen")) {
      scenarioName = "Michael Chen - Multi-vehicle collision";
    } else {
      scenarioName = promptText.split('.')[0]?.substring(0, 50) || 'Unknown scenario';
    }
    
    console.log(`[Analysis] Starting analysis for call ${callSid}`);
    console.log(`[Analysis] Identified scenario: ${scenarioName}`);
    console.log(`[Analysis] Conversation length: ${conversationHistory.length} messages`);
    
    // Format the transcript for inclusion in the prompt
    let formattedTranscript = "CALL TRANSCRIPT:\n\n";
    
    // Add the first message (system prompt) separately with a note
    if (conversationHistory.length > 0 && conversationHistory[0].role === "system") {
      formattedTranscript += "SCENARIO DETAILS: " + conversationHistory[0].content + "\n\n";
    }
    
    // Add the rest of the conversation as a transcript
    formattedTranscript += "CONVERSATION:\n";
    
    // Skip the system message in this part (already added above)
    const transcriptMessages = conversationHistory.slice(
      conversationHistory[0]?.role === "system" ? 1 : 0
    );
    
    transcriptMessages.forEach((msg, index) => {
      const role = msg.role === "assistant" ? "RESPONDER" : "CALLER";
      formattedTranscript += `[${role}]: ${msg.content}\n`;
    });
    
    // Create system prompt for analysis WITH transcript included
    const analysisPrompt = {
      role: "system",
      content: `You are a 999 emergency call evaluator analyzing training calls. 

TASK: Evaluate this emergency response training conversation and provide detailed feedback.

The scenario being simulated is: "${scenarioName}"

${formattedTranscript}

Based on the above transcript, analyze how well the emergency responder handled the call.

RETURN YOUR ANALYSIS AS A PROPERLY FORMATTED JSON OBJECT with the following structure:
{
  "scenario": "${scenarioName}",
  "overall_rating": {
    "score": 1-10,
    "summary": "Brief explanation of the rating"
  },
  "strengths": [
    "Specific strength 1",
    "Specific strength 2",
    "..."
  ],
  "areas_for_improvement": [
    "Specific area 1",
    "Specific area 2",
    "..."
  ],
  "information_handling": {
    "gathered_correctly": [
      "Info item 1",
      "Info item 2"
    ],
    "missed_or_incorrect": [
      "Info item 1",
      "Info item 2"
    ]
  },
  "action_assessment": {
    "appropriate_actions": [
      "Action 1",
      "Action 2"
    ],
    "inappropriate_actions": [
      "Action 1",
      "Action 2"
    ]
  },
  "efficiency": {
    "response_time_rating": 1-10,
    "comments": "Comments on efficiency"
  },
  "final_recommendation": "Detailed training recommendation paragraph",
  "pass_fail": "PASS" or "FAIL"
}

DO NOT include any explanatory text, markdown formatting, or code blocks - return ONLY the valid JSON object.`
    };
    
    // Since we now include the transcript in the prompt itself,
    // we only need to send the prompt to OpenAI
    const messages = [
      analysisPrompt,
      {
        role: "user",
        content: "Please provide your detailed analysis of this emergency training call."
      }
    ];
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1500
    });
    
    // Get the analysis
    const analysisText = response.choices[0].message.content;
    
    console.log(`[Analysis] Completed for call ${callSid}`);
    
    // Parse the JSON response from OpenAI
    let analysisData;
    try {
      // Try to parse the JSON from the OpenAI response
      analysisData = JSON.parse(analysisText);
      console.log("[Analysis] Successfully parsed OpenAI JSON response");
    } catch (parseError) {
      console.error("[Analysis] Error parsing OpenAI response as JSON:", parseError);
      console.log("[Analysis] Raw response:", analysisText);
      
      // Create a fallback analysis object if parsing fails
      analysisData = {
        scenario: scenarioName,
        overall_rating: {
          score: 5,
          summary: "Analysis parsing failed - using fallback data"
        },
        strengths: ["Unable to parse analysis"],
        areas_for_improvement: ["System error in analysis processing"],
        information_handling: {
          gathered_correctly: [],
          missed_or_incorrect: []
        },
        action_assessment: {
          appropriate_actions: [],
          inappropriate_actions: []
        },
        efficiency: {
          response_time_rating: 5,
          comments: "Unable to assess due to parsing error"
        },
        final_recommendation: "Please review the raw conversation transcript as automated analysis failed.",
        pass_fail: "FAIL"
      };
    }
    
    // Save analysis to file along with the full conversation
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const analysisFilename = `analysis_${callSid}_${timestamp}.json`;
    
    // Full analysis data to save locally
    const fullAnalysisData = {
      callSid,
      timestamp,
      scenarioName,
      conversation: conversationHistory,
      formattedTranscript,
      analysis: analysisData
    };
    
    await fs.writeFile(
      analysisFilename, 
      JSON.stringify(fullAnalysisData, null, 2)
    );
    
    console.log(`[Analysis] Saved to ${analysisFilename}`);
    
    // Send the analysis to the frontend endpoint
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'https://first-pulse-4xsp9cb9j-texseractrums-projects.vercel.app/api/analysis';
      
      console.log(`[Analysis] Sending analysis to frontend at: ${frontendUrl}`);
      
      const frontendResponse = await fetch(frontendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisData),
      });
      
      if (!frontendResponse.ok) {
        throw new Error(`Frontend API responded with status: ${frontendResponse.status}`);
      }
      
      const frontendResult = await frontendResponse.json();
      console.log(`[Analysis] Frontend API response:`, frontendResult);
    } catch (frontendError) {
      console.error('[Analysis] Error sending analysis to frontend:', frontendError);
    }
    
    return analysisData;
  } catch (error) {
    console.error('[Analysis] Error analyzing conversation:', error);
    throw error;
  }
}

// Add a new endpoint to retrieve analysis for a call
fastify.get('/analysis/:callSid', async (request, reply) => {
  const { callSid } = request.params;
  
  try {
    // Find the latest analysis file for this call
    const files = await fs.readdir('.');
    const analysisFiles = files.filter(f => f.startsWith(`analysis_${callSid}`));
    
    if (analysisFiles.length === 0) {
      return reply.code(404).send({ error: 'Analysis not found' });
    }
    
    // Sort by timestamp (which is part of the filename)
    analysisFiles.sort().reverse();
    
    // Read the latest analysis
    const latestAnalysis = await fs.readFile(analysisFiles[0], 'utf8');
    const analysis = JSON.parse(latestAnalysis);
    
    return reply.send(analysis);
  } catch (error) {
    console.error(`Error retrieving analysis for call ${callSid}:`, error);
    return reply.code(500).send({ error: 'Failed to retrieve analysis' });
  }
});

// Start the Fastify server
fastify.listen({ port: PORT }, (err) => {
  if (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
  console.log(`[Server] Listening on port ${PORT}`);
});
