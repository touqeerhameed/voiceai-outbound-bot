import 'dotenv/config';
import https from 'node:https';
import {
  // ULTRAVOX_API_KEY,
  ULTRAVOX_API_URL,
  TOOLS_BASE_URL 
} from '../config/config.js';
import { logMessage } from '../utils/logger.js';
import {MAKE_PROMPT} from '../utils/utility.js';
import {log_incoming_call_request}  from '../api/erpcall.js';

 /*
export async function createUltravoxCall_14augnotinused(callConfig) {
  const ultravoxConfig = {
    ...callConfig,
    experimentalSettings: {
      webhooks: [{
        url: `${TOOLS_BASE_URL}/cal/saveTranscript`,
        events: ['call.ended']
      }]
    }
  };

  console.log('Creating Ultravox call...');
  console.log('Payload:', JSON.stringify(ultravoxConfig, null, 2));
  console.log('API URL:', `${ULTRAVOX_API_URL}/calls`);

  return new Promise((resolve) => {
    try {
      const req = https.request(`${ULTRAVOX_API_URL}/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': ULTRAVOX_API_KEY
        }
      });

      let data = '';

      req.on('response', (res) => {
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 400) {
            console.error(`Ultravox API Error ${res.statusCode}:`, data);
            resolve(null);
          } else {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (err) {
              console.error('Failed to parse Ultravox response:', err.message);
              resolve(null);
            }
          }
        });
      });

      req.on('error', (err) => {
        console.error('Failed to create Ultravox call:', err.message);
        resolve(null);
      });

      req.write(JSON.stringify(ultravoxConfig));
      req.end();

    } catch (err) {
      console.error('Unexpected error during Ultravox call:', err.message);
      resolve(null);
    }
  });
} */

/*
export async function getCallTranscript(callId) {
  if (!callId) {
    console.error('Missing callId for transcript fetch.');
    return null;
  }

  let allMessages = [];
  let nextCursor = null;

  try {
    do {
      const url = `${ULTRAVOX_API_URL}/calls/${callId}/messages${nextCursor ? `?cursor=${nextCursor}` : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'X-API-Key': ULTRAVOX_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`Ultravox API responded with status ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (!data?.results) {
        console.warn('No transcript messages found in response.');
        break;
      }

      allMessages = allMessages.concat(data.results);
      nextCursor = data.next ? new URL(data.next).searchParams.get('cursor') : null;

    } while (nextCursor);

    return allMessages;

  } catch (error) {
    console.error('Failed to fetch Ultravox messages:', error.message);
    return null;
  }
} */
const assessmentReq=false;
const sharedAssessmentParameters = [
  {
            name: "ResponseAccuracy",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's self-assessed response accuracy based on its knowledge, as a digit 1-4. (4: Completely accurate, 3: Mostly accurate, 2: Somewhat inaccurate, 1: Frequently incorrect)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          {
            name: "KnowledgeLimitationHandling",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's self-assessment of how it handled knowledge limitations, as a digit 1-4. (4: Clearly stated limits, 3: Occasionally mentioned limits, 2: Rarely mentioned limits, 1: Overstepped limits)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          {
            name: "ConfidenceandClarity",
            location: "PARAMETER_LOCATION_BODY",            
            schema: {
              "description": "The AI's self-assessed confidence and clarity in responses, as a digit 1-4. (4: Clear/Concise/Confident, 3: Mostly confident/Wordy/Vague, 2: Uncertain/Repetitive, 1: Confusing/Lacked direction)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          {
            name: "ToneandEmpathy",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's self-assessed tone and empathy during the call, as a digit 1-4. (4: Very appropriate, 3: Neutral, 2: Robotic, 1: Cold/Inappropriate)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          {
            name: "EscalationHandling",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's self-assessment of its escalation handling, as a digit 1-4. (4: Offered at right time, 3: Offered only when prompted, 2: Needed but delayed, 1: Needed but not offered)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          
          {
            name: "CustomerSatisfactionOutcome",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's assessment of the customer's final sentiment/satisfaction, as a digit 1-4. (4: Satisfied/Appreciative, 3: Neutral/Not dissatisfied, 2: Mildly frustrated, 1: Clearly unhappy/Angry)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          {
            name: "CustomerBehavior",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's assessment of the customer's overall tone and attitude, as a digit 1-4. (4: Calm/Cooperative, 3: Mildly confused/Assertive, 2: Impatient/Slightly rude, 1: Hostile/Abusive)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          {
            name: "CustomerEffortLevel",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's assessment of customer effort to get a helpful answer, as a digit 1-4. (4: Very little effort, 3: Some rephrasing, 2: Repeated clarification, 1: Gave up/Frustrated)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          {
            name: "ConversationCompletion",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's assessment of whether the query was completely handled, as a digit 1-4. (4: Fully handled, 3: Mostly handled, 2: Partially handled, 1: Not handled)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          {
            name: "EmotionalShiftDuringConversation",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's assessment of emotional shift during the conversation, as a digit 1-4. (4: Improved, 3: Stayed same, 2: Slightly worsened, 1: Significantly worsened)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          {
            name: "BackgroundNoiseLevelCustomer",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's assessment of background noise on the customer's side, as a digit 1-4. (4: No noise, 3: Minor noise, 2: Moderate noise, 1: High noise)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          {
            name: "BackgroundNoiseLevelAI",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's assessment of background noise/glitches from the AI/system side, as a digit 1-4. (4: Crystal clear, 3: Slight artifacts/echo, 2: Noticeable distortion/lag, 1: Difficult to hear)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          {
            name: "CallDisruptionDueToNoiseOrAudioQuality",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's assessment of call disruption due to noise/audio quality, as a digit 1-4. (4: No impact, 3: Slight impact, 2: Some parts repeated, 1: Seriously impacted)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            "required": assessmentReq
          },
          {
            name: "OverallConversationQuality",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's overall rating of the conversation quality, as a digit 1-4. (4: Excellent, 3: Good, 2: Fair, 1: Poor)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          {
            name: "callIntent",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's classification of the primary intent of the call, as a digit 1-4. (1: Information Inquiry, 2: Service/Support Request, 3: Sales/New Business Inquiry, 4: Other/Unclear)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          },
          {
            name: "CallerToneandEmpathy",
            location: "PARAMETER_LOCATION_BODY",
            schema: {
              "description": "The AI's assessment of the caller's tone and empathy during the call, as a digit 1-4. (4: Calm/Cooperative/Positive, 3: Neutral/Polite, 2: Impatient/Mildly frustrated, 1: Hostile/Angry/Abusive)",
              "type": "number",
              "default": 0,
              "enum": [1, 2, 3, 4]
            },
            required: assessmentReq
          }
]; 

/*function ragToolDefinition(collectionId) {
  return {
    temporaryTool: {
      modelToolName: "ragSearch",
      description: "Answer company-specific questions using RAG knowledge base",
      staticParameters: [
        { name: "collectionId", location: "PARAMETER_LOCATION_BODY", value: collectionId },
        { name: "top_k", location: "PARAMETER_LOCATION_BODY", value: 5 }
      ],
      dynamicParameters: [
        { name: "query", location: "PARAMETER_LOCATION_BODY", schema: { type: "string" }, required: true }
      ],
      http: {
        baseUrlPattern: `${TOOLS_BASE_URL}/rag/query`,
        httpMethod: "POST"
      }
    }
  };
}*/
// Define each tool as a separate variable
const transferCallTool = (FROM, TO, ISCALLFORWARDING, FORWARDING_MOBILE_NUMBER, COMPANYID, JOB_ID) => ({
  temporaryTool: {
    modelToolName: "transferCall",
    description: "Escalate to human agent", 
    staticParameters: [
      { "name": "fromNumber", "location": "PARAMETER_LOCATION_BODY", "value": FROM },
      { "name": "toNumber", "location": "PARAMETER_LOCATION_BODY", "value": TO },
      { "name": "isCallForwarding", "location": "PARAMETER_LOCATION_BODY", "value": ISCALLFORWARDING },
      { "name": "forwardingMobileNumber", "location": "PARAMETER_LOCATION_BODY", "value": FORWARDING_MOBILE_NUMBER },
      { "name": "direction", "location": "PARAMETER_LOCATION_BODY", "value": "OUTBOUND" },
      { "name": "companyid", "location": "PARAMETER_LOCATION_BODY", "value": COMPANYID },
      { "name": "job_id", "location": "PARAMETER_LOCATION_BODY", "value": JOB_ID },
      { "name": "intent_from", "location": "PARAMETER_LOCATION_BODY", "value": "outbound Transfer" }
    ],         
    automaticParameters: [{
      "name": "callId",
      "location": "PARAMETER_LOCATION_BODY",
      "knownValue": "KNOWN_PARAM_CALL_ID"
    }],
    dynamicParameters: [
      { name: "firstname", location: "PARAMETER_LOCATION_BODY", schema: { type: "string" }, required: false },
      { name: "lastname", location: "PARAMETER_LOCATION_BODY", schema: { type: "string" }, required: false },
      { name: "transferReason", location: "PARAMETER_LOCATION_BODY", schema: { type: "string" }, required: false },
      { name: "conversationSummary", location: "PARAMETER_LOCATION_BODY", schema: { 
          description: "A concise summary of the current conversation",
          type: "string" 
        }, required: false 
      },
      ...sharedAssessmentParameters
    ],
    http: {
      baseUrlPattern: `${TOOLS_BASE_URL}/twilio/transferCall`,
      httpMethod: "POST",
    }
  }
});

const bookAppointmentTool = (FROM, TO, IS_APPOINTMENT_EMAIL) => ({
  temporaryTool: {
    modelToolName: "bookAppointment",
    description: "Schedule appointments",
    staticParameters: [
      { "name": "fromNumber", "location": "PARAMETER_LOCATION_BODY", "value": TO },
      { "name": "toNumber", "location": "PARAMETER_LOCATION_BODY", "value": FROM },
      { "name": "isAppointEmail", "location": "PARAMETER_LOCATION_BODY", "value": IS_APPOINTMENT_EMAIL },
      { "name": "intent_from", "location": "PARAMETER_LOCATION_BODY", "value": "outbound Appointment" },
      { "name": "direction", "location": "PARAMETER_LOCATION_BODY", "value": "OUTBOUND" },
    ],
    automaticParameters: [{
      "name": "callId",
      "location": "PARAMETER_LOCATION_BODY",
      "knownValue": "KNOWN_PARAM_CALL_ID"
    }],
    dynamicParameters: [       
      { name: "firstname", location: "PARAMETER_LOCATION_BODY", schema: { type: "string" }, required: true },
      { name: "lastname", location: "PARAMETER_LOCATION_BODY", schema: { type: "string" }, required: true },
      { name: "contactnumber", location: "PARAMETER_LOCATION_BODY", schema: { type: "string" }, required: true },
      { name: "emailaddress", location: "PARAMETER_LOCATION_BODY", schema: { type: "string" }, required: true },
      { name: "purpose", location: "PARAMETER_LOCATION_BODY", schema: { type: "string" }, required: true },
      { name: "appointmentdate", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", format: "date" }, required: true },
      { name: "appointmenttime", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", format: "time" }, required: true },
      { name: "conversationSummary", location: "PARAMETER_LOCATION_BODY", schema: { 
          description: "A 2-3 sentence summary of the conversation",
          type: "string"
        }, required: true 
      },
      ...sharedAssessmentParameters
    ],
    http: {
      baseUrlPattern: `${TOOLS_BASE_URL}/whook/bookAppointment`,
      httpMethod: "POST",
    }
  }
});

const hangUpCallTool = (FROM, TO, COMPANYID, JOB_ID) => ({
  temporaryTool: {
    modelToolName: "hangUpCall",
    description: "Ends the call when the conversation is complete.",
    staticParameters: [
      { "name": "fromNumber", "location": "PARAMETER_LOCATION_BODY", "value": FROM },
      { "name": "toNumber", "location": "PARAMETER_LOCATION_BODY", "value": TO },
      { "name": "direction", "location": "PARAMETER_LOCATION_BODY", "value": "OUTBOUND" },
      { "name": "companyid", "location": "PARAMETER_LOCATION_BODY", "value": COMPANYID },
      { "name": "job_id", "location": "PARAMETER_LOCATION_BODY", "value": JOB_ID },
      { "name": "intent_from", "location": "PARAMETER_LOCATION_BODY", "value": "outbound Hangup" }
    ], 
    automaticParameters: [{
      name: "callId",
      location: "PARAMETER_LOCATION_BODY",
      knownValue: "KNOWN_PARAM_CALL_ID"
    }],
    dynamicParameters: [            
      ...sharedAssessmentParameters
    ],
    http: {
      baseUrlPattern: `${TOOLS_BASE_URL}/twilio/hangUpCall`,
      httpMethod: "POST"
    }
  }
});

const confirmAppointmentAttendanceTool = (FROM, TO, COMPANYID, JOB_ID) => ({
  temporaryTool: {
    modelToolName: "confirmAppointmentAttendance",
    description: "Asks the user to confirm their appointment attendance today.",
    staticParameters: [
      { name: "fromNumber", location: "PARAMETER_LOCATION_BODY", value: FROM },
      { name: "toNumber", location: "PARAMETER_LOCATION_BODY", value: TO },
      { name: "direction", location: "PARAMETER_LOCATION_BODY", value: "OUTBOUND" },
      { name: "companyid", location: "PARAMETER_LOCATION_BODY", value: COMPANYID },
      { name: "job_id", location: "PARAMETER_LOCATION_BODY", value: JOB_ID },
      { name: "intent_from", location: "PARAMETER_LOCATION_BODY", value: "appointmentReminder" }
    ],
    automaticParameters: [{
      name: "callId",
      location: "PARAMETER_LOCATION_BODY",
      knownValue: "KNOWN_PARAM_CALL_ID"
    }],
    dynamicParameters: [       
      { 
        name: "confirmationResponse", 
        location: "PARAMETER_LOCATION_BODY", 
        schema: { 
          type: "string",
          enum: ["yes", "no", "maybe"],
          description: "User's confirmation whether they will attend the appointment"
        },
        required: true 
      },
      { 
        name: "conversationSummary", 
        location: "PARAMETER_LOCATION_BODY", 
        schema: {
          description: "Short summary of the appointment confirmation interaction.",
          type: "string"
        },
        required: true 
      },
      
    ],
    http: {
      baseUrlPattern: `${TOOLS_BASE_URL}/whook/confirmAttendance`,
      httpMethod: "POST"
    }
  }
});

const queryCorpusTool = (RAG_COLLECTION_ID) => ({
    toolName: "queryCorpus",
    parameterOverrides: {
        corpus_id: RAG_COLLECTION_ID,
        max_results: 5
    }
});
 
function createSelectedTools(
  FROM,
  TO,
  is_book_appointment,
  is_transfercall,
  transfercall_mobileno,
  company_name,
  COMPANYID,
  is_taking_notes, is_appointment_reminder,
  JOB_ID,
  use_knowlege_base,
  knowlege_base_id
) {
  
  console.log('Creating selected tools with use_knowlege_base:', use_knowlege_base, 'and knowlege_base_id:', knowlege_base_id);
  const tools = [];
  
  // Add knowledge base tool if enabled
  if ((use_knowlege_base === true || use_knowlege_base === 1 || use_knowlege_base === "1") && knowlege_base_id) {
      tools.push(queryCorpusTool(knowlege_base_id));
  }

  // Add transfer call tool only if enabled
  if (is_transfercall === true || is_transfercall === 1 || is_transfercall === "1") {
      tools.push(transferCallTool(FROM, TO, is_transfercall, transfercall_mobileno, COMPANYID,JOB_ID));
  }  
  
  // Add book appointment tool only if enabled
  if (is_book_appointment === true || is_book_appointment === 1 || is_book_appointment === "1") {
      tools.push(bookAppointmentTool(FROM, TO, is_book_appointment));
  }

  // Always add hang up call tool
  tools.push(hangUpCallTool(FROM, TO, COMPANYID));

  if (is_appointment_reminder === true || is_appointment_reminder === 1 || is_appointment_reminder === "1") {
    tools.push(confirmAppointmentAttendanceTool(FROM, TO, COMPANYID, JOB_ID));
  }

  // tools.push(
  //  // transferCallTool(FROM, TO, ISCALLFORWARDING, FORWARDING_MOBILE_NUMBER, COMPANYID, JOB_ID),
  //  // bookAppointmentTool(FROM, TO, IS_APPOINTMENT_EMAIL),
  //   // hangUpCallTool(FROM, TO, COMPANYID, JOB_ID),

  //   confirmAppointmentAttendanceTool(FROM, TO, COMPANYID, JOB_ID),
  //   //ragToolDefinition(companyCollectionId) // different per company

  // );

  return tools;
}
 
export function buildUltravoxCallConfig(job, ai_tags_dictionary, ai_settings) {
  try {
    logMessage(`Starting buildUltravoxCallConfig with job: ${job?.job_id}`);
    
    // Helper function with error handling
    const normalizeBoolString = (input) => {
      try {
        const val = String(input).toLowerCase();
        return ['true', '1', 'yes'].includes(val) ? "true" : "false";
      } catch (error) {
        console.error('Error in normalizeBoolString:', error.message);
        return "false";
      }
    };

    // Validate required job data
    if (!job) {
      logMessage(`Job data is missing or null`);
      throw new Error('Job data is missing or null');
    }

    if (!job.telecom_phone_number) {
      logMessage('telecom_phone_number is missing from job data');
      throw new Error('telecom_phone_number is missing from job data');
    }

    if (!job.call_phone_no) {
      logMessage('call_phone_no is missing from job data');
      throw new Error('call_phone_no is missing from job data');
    }

    const FROM = job.telecom_phone_number;
    const TO = job.call_phone_no;

    // logMessage('Phone numbers - FROM:', FROM, 'TO:', TO);
    // logMessage('job.full_name::  ',job.full_name )
    // logMessage('job.email_address::  ',job.job_email_address )
    // logMessage('job.call_phone_no::  ',job.call_phone_no )

 

    // Build prompt with error handling
    let FINAL_PROMPT;
    try {
      logMessage('Building FINAL_PROMPT...');
      FINAL_PROMPT = MAKE_PROMPT(
        //PROMPT
        job.persona_tone, job.core_objective, job.key_rules_constraints, 
        job.unresponsive_spam, job.tool_functions, ai_settings?.ai_datetime_handling, 
        job.prompt_misc, job.call_flow, job.business_knowledge_base, 
        job.example_scenario, job.table_faqs, ai_settings?.pronunciation, 
        ai_settings?.kpi_assessment,
        //REPLACEMENT
        job.is_record_disclaimer, job.record_disclaimer, FROM, ai_tags_dictionary,
        job.website, job.companyname, job.agent_name,job.greeting,job.business_services,job.business_description,
        job.full_name,job.job_email_address,job.call_phone_no,job.opening_hours
      );
      
      if (!FINAL_PROMPT) {
        logMessage('MAKE_PROMPT returned empty or null result:',FINAL_PROMPT);
        throw new Error('MAKE_PROMPT returned empty or null result');
      }
      
      logMessage('FINAL_PROMPT built successfully, length:', FINAL_PROMPT.length);
      logMessage('FINAL_PROMPT passed', FINAL_PROMPT);
    } catch (promptError) {
        logMessage('Error building FINAL_PROMPT:', promptError.message);
        throw new Error(`Failed to build prompt: ${promptError.message}`);
    }

    // Process boolean values with error handling
    let Istscriptstring, IsRecordingstring, IsEmailnotistring;
    try {
      Istscriptstring = normalizeBoolString(job.iscalltranscript);
      IsRecordingstring = normalizeBoolString(job.iscallrecording);
      IsEmailnotistring = normalizeBoolString(job.notification_email);

      logMessage('Boolean values processed - transcript:', Istscriptstring, 'recording:', IsRecordingstring, 'email:', IsEmailnotistring);
    } catch (boolError) {
      logMessage('Error processing boolean values:', boolError.message);
      // Use defaults
      Istscriptstring = "false";
      IsRecordingstring = "false";
      IsEmailnotistring = "false";
    }
    //max_call_dur_insec_sch  takes this if in case of scheduler priority set to campaign
    // Process duration with error handling
    let maxDurationnow;
    try {
      // Check if scheduler priority is Campaign, use max_call_dur_insec_sch, otherwise use max_call_dur_insec
      if (job.scheduler_priority_title === 'Campaign') {
        maxDurationnow = `${job.max_call_dur_insec_sch || 300}s`;
        console.log('Max duration set to (Campaign):', maxDurationnow);
      } else {
        maxDurationnow = `${job.max_call_dur_insec || 300}s`;
        console.log('Max duration set to:', maxDurationnow);
      }
    } catch (durationError) {

      logMessage('Error processing duration:', durationError.message);
      maxDurationnow = "300s"; // Default 5 minutes
    }

    // Extract job details
    const JOB_ID = job.job_id;
    const COMPANYID = job.business_id;
    const full_name = job.full_name;
    const job_email_address = job.job_email_address;
    const call_phone_no = job.call_phone_no;

    logMessage(`Job details - ID: ${JOB_ID}, Company: ${COMPANYID}, Full name: ${full_name}, Email: ${job_email_address}, Phone: ${call_phone_no}`);

    // Handle reminder-specific logic
    if (job.scheduler_priority_title === 'Reminder') {
      console.log('Processing Reminder job:', {
        ob_sch_priority: job.ob_sch_priority,
        appointment_date: job.appointment_date,
        appointment_time: job.appointment_time,
        appointment_for: job.appointment_for
      });
      logMessage(`Reminder details - Date: ${job.appointment_date}, Time: ${job.appointment_time}, For: ${job.appointment_for}`);
    }

    // Build system prompt with error handling
    //let systemPrompt;
    try {
      console.log('Building system prompt...');
      let appointmentTimeSlot = '';
      
      if (job.scheduler_priority_title === 'Reminder') {
        try {
          appointmentTimeSlot = formatUKReadableTime(job.appointment_time) || '';
          FINAL_PROMPT = FINAL_PROMPT.replace(/\[APPOINTMENT_TIMESLOT\]/g, appointmentTimeSlot);
          logMessage('System prompt built successfully');
        } catch (timeError) {
          logMessage('Error formatting appointment time:', timeError.message);
          appointmentTimeSlot = job.appointment_time || '';
        }
      } else{
         // FINAL_PROMPT = FINAL_PROMPT;
      }  
      log_incoming_call_request("FINAL PROMPT",FINAL_PROMPT, "")   
      
    } catch (promptError) {
      logMessage('Error building system prompt:', promptError.message);
      throw new Error(`Failed to build system prompt: ${promptError.message}`);
    }

    // Build selected tools with error handling
    let selectedTools;
    try {
      console.log('Building selected tools...');
      selectedTools = createSelectedTools(
        FROM, TO,
        job.is_book_appointment, job.is_transfercall, job.transfercall_mobileno,
        job.companyname, COMPANYID,
        job.is_taking_notes, job.is_appointment_reminder, // Fixed: these were undefined variables
        job.knowlege_base_id, job.use_knowlege_base
      );
      logMessage('Selected tools built successfully, count:', selectedTools?.length);
    } catch (toolsError) {
      logMessage('Error building selected tools:', toolsError.message);
      throw new Error(`Failed to build selected tools: ${toolsError.message}`);
    }

    // Build final configuration object
    const config = {
      systemPrompt: FINAL_PROMPT,
      model: 'fixie-ai/ultravox',
      voice: job.voice || 'en-GB-Neural2-A',
      temperature: job.temperature ?? 0.3,
      firstSpeaker: 'FIRST_SPEAKER_AGENT',
      medium: {
        twilio: {
          // You can add voiceSettings here if needed
        }
      },
      transcriptOptional: job.iscalltranscript === true || job.iscalltranscript === 'true' || job.iscalltranscript === 1,
      recordingEnabled: job.iscallrecording === true || job.iscallrecording === 'true' || job.iscallrecording === 1,
      maxDuration: maxDurationnow,
      selectedTools: selectedTools,
      metadata: {
        direction: "OUTBOUND",
        company: job.companyname,
        callfrom: FROM,
        callto: TO,
        ISCALLTRANSCRIPT: Istscriptstring,
        ISCALLRECORDING: IsRecordingstring,
        COMPANYID: job.business_id,
        EMAILADDRESS: job.emailaddress,
        JOB_EMAILADDRESS: job.job_email_address,
        EMAILNOTIFICAION: IsEmailnotistring,
        JOB_ID: job.job_id,
      }
    };

    logMessage('buildUltravoxCallConfig completed successfully');
    return config;

  } catch (error) {
    logMessage('Error in buildUltravoxCallConfig:', error.message);
    logMessage('Error stack:', error.stack);
    logMessage('Job data that caused error:', JSON.stringify(job, null, 2));
    
    // Re-throw with more context
    throw new Error(`buildUltravoxCallConfig failed: ${error.message}`);
  }
}

export function buildUltravoxCallConfig_10Sep2025(job,ai_tags_dictionary,ai_settings) {

  const normalizeBoolString = (input) => {
    const val = String(input).toLowerCase();
    return ['true', '1', 'yes'].includes(val) ? "true" : "false";
  };

  const FROM=job.telecom_phone_number;
  const TO=job.call_phone_no;

  const FINAL_PROMPT = MAKE_PROMPT(
      //PROMPT
      job.persona_tone, job.core_objective, job.key_rules_constraints, job.unresponsive_spam, job.tool_functions, ai_settings.ai_datetime_handling, job.prompt_misc,
      job.call_flow, job.business_knowledge_base,job.example_scenario,job.table_faqs, ai_settings.pronunciation, ai_settings.kpi_assessment,
      //REPLACEMENT
      job.is_record_disclaimer,job.record_disclaimer,FROM,ai_tags_dictionary,job.website,job.companyname,job.agent_name);

  console.log('FINAL_PROMPT ***',FINAL_PROMPT);    

  const Istscriptstring = normalizeBoolString(job.iscalltranscript);
  const IsRecordingstring = normalizeBoolString(job.iscallrecording);
  const IsEmailnotistring = normalizeBoolString(job.notification_email);
  const maxDurationnow = `${job.max_call_dur_insec}s`;

 
  const JOB_ID=job.job_id;
  const COMPANYID=job.business_id;

  const full_name=job.full_name;
  const job_email_address=job.job_email_address;
  const call_phone_no=job.call_phone_no;
  logMessage('REPLACE FULLNAME: full_name '+ full_name ,' EMAILADDRESS  job_email_address :' +job_email_address, ' CALLPHONENO: call_phone_no ' + call_phone_no);

  console.log('job record: ',job);
  if(job.scheduler_priority_title === 'Reminder') 
    {
      console.log(job);
      console.log('job.ob_sch_priority: ',job.ob_sch_priority);
      console.log('job.appointment_date: ',job.appointment_date);
      console.log('job.appointment_time: ',job.appointment_time);
      console.log('job.appointment_for: ',job.appointment_for);
      logMessage('job.appointment_time_slot: ' +job.appointment_time_slot + ' job.appointment_date: ' + job.appointment_date + ' job.appointment_time: ' + job.appointment_time);
    }
    logMessage("Next returning systemPrompt");

  return {
    systemPrompt: `${FINAL_PROMPT              
                  .replace(/\[APPOINTMENT_TIMESLOT\]/g, 
                  job.scheduler_priority_title === 'Reminder' 
                   ? (formatUKReadableTime(job.appointment_time) || '')  : '') 
                      
                } `,
    model: 'fixie-ai/ultravox',
    voice: job.voice || 'en-GB-Neural2-A',
    temperature: job.temperature ?? 0.3,
    firstSpeaker: 'FIRST_SPEAKER_AGENT',
    medium: {
      twilio: {
        // You can add voiceSettings here if needed
      }
    },    
    transcriptOptional: job.iscalltranscript === true || job.iscalltranscript === 'true' || job.iscalltranscript === 1,
    recordingEnabled: job.iscallrecording === true || job.iscallrecording === 'true' || job.iscallrecording === 1,
    maxDuration: maxDurationnow,
    selectedTools: createSelectedTools(FROM, TO,
      job.is_book_appointment, job.is_transfercall, job.transfercall_mobileno,job.companyname,COMPANYID,
      is_taking_notes, is_appointment_reminder,
      JOB_ID,job.use_knowlege_base,job.knowlege_base_id ),//selectedTools,
    metadata: {
      direction: "OUTBOUND",
      company: job.companyname,
      callfrom: FROM,
      callto: TO,
      ISCALLTRANSCRIPT: Istscriptstring,
      ISCALLRECORDING: IsRecordingstring,
      COMPANYID: job.business_id,
      EMAILADDRESS: job.emailaddress,
      JOB_EMAILADDRESS: job.job_email_address,
      EMAILNOTIFICAION: IsEmailnotistring,
      JOB_ID: job.job_id,
    }
  };
}

function formatUKReadableTime(time24) {
  try {
    if (!time24 || typeof time24 !== 'string') return '';

    const [hourStr, minuteStr] = time24.split(':');
    if (!hourStr || !minuteStr) return '';

    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    if (isNaN(hour) || isNaN(minute)) return '';

    let nextHour = (hour + 1) % 24;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    const nextHour12 = nextHour % 12 || 12;

    if (minute === 0) return `${hour12}${ampm}`;
    if (minute === 15) return `quarter past ${hour12}`;
    if (minute === 30) return `half past ${hour12}`;
    if (minute === 45) return `quarter to ${nextHour12}`;

    if (minute < 30) return `${minute} past ${hour12}`;
    return `${60 - minute} to ${nextHour12}`;
  } catch (error) {
    console.error("Time formatting error:", error);
    return '';
  }
}


export const ULTRAVOX_CALL_CONFIG_1 = (job,Istscriptstring,IsRecordingstring,IsEmailnotistring,iscalltranscriptvar,iscallrecordingvar,emailnotificationvar) => ({
    //emailnotification,job.iscalltranscript,job.iscallrecording
    systemPrompt: ` ${job.prompt}  `,
    model: 'fixie-ai/ultravox',
    voice: job.voice || 'en-GB-Neural2-A', // UK English voice
    temperature: job.temperature, // Slightly higher for natural variance
    firstSpeaker: 'FIRST_SPEAKER_AGENT',
   // selectedTools: createSelectedTools(FROM, TO,IS_APPOINTMENT_EMAIL,ISCALLFORWARDING,FORWARDING_MOBILE_NUMBER),//selectedTools,
    medium: { 
      twilio: {
        //voiceSettings: {
        //   speed: 0.85, // 85% normal speed
        //  pauseSilence: '1.5s'
        //}
      } 
    },
    recordingEnabled: iscalltranscriptvar,
    transcriptOptional: iscallrecordingvar,
    maxDuration: '60s',
    metadata: {
        direction: "OUTBOUND",
        company: job.companyname,
        callfrom: job.telecom_phone_number,
        callto: job.call_phone_no,
        ISCALLTRANSCRIPT: Istscriptstring,
        ISCALLRECORDING:  IsRecordingstring,
        
        COMPANYID: job.business_id,
        EMAILADDRESS: job.email_address,
        EMAILNOTIFICAION : IsEmailnotistring,
      }
});
 