import express from 'express';
import twilio from 'twilio';
import 'dotenv/config';
import { createUltravoxCall } from '../utils/ultravox-utils.js';
import { createUltravoxCallConfig } from '../config/ultravox-config.js';
import { hangupCall, fetchTelecomNumberByPhone,log_incoming_call_request,log_TransferCall_status,save_phone_company_log,getbusinessbyPhoneNumber,log_TransferCall_gc } from '../api/erpcall.js';
import {
  TOOLS_BASE_URL,
} from '../config/config.js';
import activeCalls from '../utils/activeCallsStore.js'; // adjust path accordingly
import { fetchCallDetails } from '../utils/twilioUtils.js';
import { logMessage } from '../utils/logger.js';
 
const VoiceResponse = twilio.twiml.VoiceResponse;
 
const router = express.Router();

 

async function transferActiveCall_V2(ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, fromNumber, toNumber, direction, companyid, job_id, conversationSummary, intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy, EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation, BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy) {
    try {
        logMessage('transferActiveCall called with parameters:', JSON.stringify({
            ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, fromNumber, toNumber, direction, companyid, job_id
        }, null, 2));

        if (!isCallForwarding) {
            await log_incoming_call_request('Call forwarding is disabled', { 
                ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, direction, companyid, job_id, conversationSummary,
                intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy,
                EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation,
                BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy
            }, 'transferActiveCall');

            console.log('Call forwarding is disabled');
            return {
                status: 'false',
                message: 'Call forwarding is disabled'
            };
        }

        const callData = activeCalls.get(ultravoxCallId);
        console.log('Call data:', callData);

        if (!callData || !callData.twilioCallSid) {
            logMessage('Call not found or invalid CallSid');
            await log_incoming_call_request('Call not found or invalid CallSid', { 
                ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, job_id, conversationSummary 
            }, 'transferActiveCall');
            throw new Error('Call not found or invalid CallSid');
        }

        const twilioCallSid = callData.twilioCallSid;
        const callSid = twilioCallSid;
        
        console.log('Getting Twilio credentials...');
        const result = await log_TransferCall_gc({
            callid: ultravoxCallId, twilioCallSid, fromNumber, toNumber, forwardingMobileNumber, firstname, 
            lastname, transferReason, isCallForwarding, direction, companyid, job_id, conversationSummary,
            intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy,
            EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation,
            BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy
        }); 

        const twilio_account_sid = result?.message?.phone_credentials?.twilio_account_sid;
        const twilio_auth_token = result?.message?.phone_credentials?.twilio_auth_token;

        if (!twilio_account_sid || !twilio_auth_token) {
            await log_incoming_call_request('twilio_account_sid or twilio_auth_token is null', { 
                ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, job_id 
            }, 'Missing Twilio credentials');
            throw new Error('Twilio credentials not found');
        }

        const client = twilio(twilio_account_sid, twilio_auth_token); 
        const conferenceName = `conference_${callSid}`;

        console.log('Updating call to redirect to conference entry point...');

        
        
        
        // Use the URL method to redirect the call
        const updatedCall = await client.calls(callData.twilioCallSid)
            .update({
                url: `${TOOLS_BASE_URL}/twilio/transfer-conference-entry-point?conferenceName=${encodeURIComponent(conferenceName)}&fromNumber=${encodeURIComponent(fromNumber)}&toNumber=${encodeURIComponent(toNumber)}&companyid=${encodeURIComponent(companyid)}&job_id=${encodeURIComponent(job_id)}&mainCallSid=${encodeURIComponent(callSid)}`,
                method: 'POST'
            });

        console.log('Call redirected successfully. Now creating outbound call to agent...');

        // Create the agent response TwiML - FIXED CONFERENCE CONFIGURATION
        const agentResponse = new twilio.twiml.VoiceResponse();
        agentResponse.say("You are being connected to a user. Here's a quick summary.");
        
        if (conversationSummary) {
            agentResponse.say(conversationSummary, { voice: "alice", language: "en-US" });
        }
        // const confName = encodeURIComponent(conferenceName);
        // const conference_status_URL = `${TOOLS_BASE_URL}/twilio/conference-status${confName}&callSid=${callSid}`;
        
        const conference_status_URL = `${TOOLS_BASE_URL}/twilio/conference-status?conferenceName=${encodeURIComponent(conferenceName)}&callSid=${callSid}`;
        logMessage('Conference status callback URL for agent:', conference_status_URL);


        // ${confName}&callSid=${callSid}`;
        // logMessage('Conference status callback URL:', conference_status_URL);
        
        const agentDial = agentResponse.dial();
        
        // FIXED: Correct parameter order and format
        agentDial.conference(conferenceName, {
            startConferenceOnEnter: true,
            endConferenceOnExit: true,
            statusCallback: conference_status_URL,
            statusCallbackEvent: ['start', 'end', 'join', 'leave'],         
            statusCallbackMethod: 'POST'
        });
        console.log('Conference TwiML created successfully:', agentResponse.toString());
        logMessage('Conference TwiML created successfully:', agentResponse.toString());
        // Create outbound call to the agent
        const outboundCall = await client.calls.create({
            to: forwardingMobileNumber,
            from: fromNumber,
            twiml: agentResponse.toString(),
            statusCallback: `${TOOLS_BASE_URL}/twilio/transfer-status?mainCallSid=${callSid}`,
            statusCallbackMethod: 'POST',
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
        });

        console.log('Outbound call initiated to specialist. SID:', outboundCall.sid);
        logMessage('Outbound call initiated to specialist. SID:', outboundCall.sid);

        return {
            status: 'success',
            message: 'Call transfer initiated'
        };

    } catch (error) {
        logMessage('Error transferring call:', error.message || error);
        console.error('Error transferring call:', error);
        
        await log_incoming_call_request('Error transferring call', { 
            ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, direction, companyid, job_id 
        }, error.message);
        
        throw {
            status: 'error',
            message: 'Failed to transfer call',
            error: error.message
        };
    }
}

 

async function transferActiveCall(ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, fromNumber, toNumber, direction, companyid, job_id, conversationSummary, intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy, EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation, BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy) {
    try {
        // ... (existing logging and checks) ...
        logMessage('transferActiveCall called with parameters:', JSON.stringify({
            ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, fromNumber, toNumber, direction, companyid, job_id
        }, null, 2));

        if (!isCallForwarding) {
            await log_incoming_call_request('Call forwarding is disabled', { 
                ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, direction, companyid, job_id, conversationSummary,
                intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy,
                EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation,
                BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy
            }, 'transferActiveCall');

            console.log('Call forwarding is disabled');
            return {
                status: 'false',
                message: 'Call forwarding is disabled'
            };
        }

        const callData = activeCalls.get(ultravoxCallId);
        console.log('Call data:', callData);
       
        if (!callData || !callData.twilioCallSid) {
            logMessage('Call not found or invalid CallSid');
            await log_incoming_call_request('Call not found or invalid CallSid', { 
                ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, job_id, conversationSummary 
            }, 'transferActiveCall');
            throw new Error('Call not found or invalid CallSid');
        }
        const twilioCallSid = callData.twilioCallSid;
        const callSid = twilioCallSid;

        console.log('Getting Twilio credentials...');
        const result = await log_TransferCall_gc({
            callid: ultravoxCallId, twilioCallSid, fromNumber, toNumber, forwardingMobileNumber, firstname, 
            lastname, transferReason, isCallForwarding, direction, companyid, job_id, conversationSummary,
            intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy,
            EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation,
            BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy
        }); 

        const twilio_account_sid = result?.message?.phone_credentials?.twilio_account_sid;
        const twilio_auth_token = result?.message?.phone_credentials?.twilio_auth_token;

       if (!twilio_account_sid || !twilio_auth_token) {
            await log_incoming_call_request('twilio_account_sid or twilio_auth_token is null', { 
                ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, job_id 
            }, 'Missing Twilio credentials');
            throw new Error('Twilio credentials not found');
        }


        const client = twilio(twilio_account_sid, twilio_auth_token); 
        const conferenceName = `conference_${callSid}`;

        console.log('Updating call to redirect to conference entry point...');


        // console.log('DEBUG: Value of twilioCallSid (from callData):', callData.twilioCallSid);
        // console.log('DEBUG: Value of twilio_account_sid (used for client):', twilio_account_sid);
        // console.log('DEBUG: Value of twilio_auth_token (used for client):', twilio_auth_token ? '**********' : 'NULL'); // Hide sensitive token

        // logMessage('DEBUG: Value of twilioCallSid (from callData):', callData.twilioCallSid);
        // logMessage('DEBUG: Value of twilio_account_sid (used for client):', twilio_account_sid);
        // logMessage('DEBUG: Value of twilio_auth_token (used for client):', twilio_auth_token ? '**********' : 'NULL'); // Hide sensitive token


        const updatedCall = await client.calls(callData.twilioCallSid)
            .update({
                url: `${TOOLS_BASE_URL}/twilio/transfer-conference-entry-point?conferenceName=${encodeURIComponent(conferenceName)}&fromNumber=${encodeURIComponent(fromNumber)}&toNumber=${encodeURIComponent(toNumber)}&companyid=${encodeURIComponent(companyid)}&job_id=${encodeURIComponent(job_id)}&mainCallSid=${encodeURIComponent(callSid)}`,
                method: 'POST'
            });

        console.log('Call redirected successfully. Now creating outbound call to agent...');

        // Start building the TwiML response string manually for the agent leg
        let agentTwimlString = `<?xml version="1.0" encoding="UTF-8"?><Response>`;
        agentTwimlString += `<Say>You are being connected to a user. Here's a quick summary.</Say>`;
        
        if (conversationSummary) {
            // Escape conversationSummary for XML if it contains special characters
            const escapedSummary = conversationSummary.replace(/&/g, '&amp;')
                                                      .replace(/</g, '&lt;')
                                                      .replace(/>/g, '&gt;')
                                                      .replace(/"/g, '&quot;')
                                                      .replace(/'/g, '&apos;');
            agentTwimlString += `<Say>${escapedSummary}</Say>`;
        }
        
        const conference_status_URL = `${TOOLS_BASE_URL}/twilio/conference-status?conferenceName=${encodeURIComponent(conferenceName)}&callSid=${callSid}`;
        logMessage('Conference status callback URL for agent:', conference_status_URL);

        // Manually construct the <Dial> and <Conference> verbs with attributes
        agentTwimlString += `<Dial>`;
        // IMPORTANT: Escape the URL for XML attribute safety
        const escapedAgentStatusUrl = conference_status_URL.replace(/&/g, '&amp;');

        agentTwimlString += `<Conference` +
            ` statusCallback="${escapedAgentStatusUrl}"` +
            ` statusCallbackEvent="start join leave end"` + // Space-separated list
            ` statusCallbackMethod="POST"` +
            ` startConferenceOnEnter="true"` +
            ` endConferenceOnExit="true"` +
            `>${conferenceName}</Conference>`; // Conference name inside the tag
        agentTwimlString += `</Dial>`;
        agentTwimlString += `</Response>`;

        console.log('Conference TwiML created successfully (MANUAL):', agentTwimlString);
        logMessage('Conference TwiML created successfully (MANUAL):', agentTwimlString);

        // Create outbound call to the agent using the manually constructed TwiML
        const outboundCall = await client.calls.create({
            to: forwardingMobileNumber,
            from: fromNumber,
            twiml: agentTwimlString, // Use the manually constructed string
            statusCallback: `${TOOLS_BASE_URL}/twilio/transfer-status?mainCallSid=${callSid}`,
            statusCallbackMethod: 'POST',
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
        });

        console.log('Outbound call initiated to specialist. SID:', outboundCall.sid);
        logMessage('Outbound call initiated to specialist. SID:', outboundCall.sid);

        return {
            status: 'success',
            message: 'Call transfer initiated'
        };

    } catch (error) {
        logMessage('Error transferring call:', error.message || error);
        console.error('Error transferring call:', error);
        
        await log_incoming_call_request('Error transferring call', { 
            ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, direction, companyid, job_id 
        }, error.message);
        
        throw {
            status: 'error',
            message: 'Failed to transfer call',
            error: error.message
        };
    }
}
 

router.post('/transfer-conference-entry-point', (req, res) => {
    try {
        const {
            conferenceName,
            fromNumber,
            toNumber,
            companyid,
            job_id,
            mainCallSid
        } = req.query;

        console.log('Received transfer-conference-entry-point request:', JSON.stringify(req.query, null, 2));

        if (!conferenceName) {
            console.error('Missing conferenceName in query parameters');
            const errorResponse = new VoiceResponse();
            errorResponse.say('Conference name is missing. Please try again.');
            res.type('text/xml');
            return res.status(400).send(errorResponse.toString());
        }

        // Start building the TwiML response string manually for the customer leg
        let customerTwimlString = `<?xml version="1.0" encoding="UTF-8"?><Response>`;
        customerTwimlString += `<Say>Please wait a moment while I connect you to a human agent.</Say>`;
        
        const conference_status_URL = `${TOOLS_BASE_URL}/twilio/conference-status?conferenceName=${encodeURIComponent(conferenceName)}&callSid=${mainCallSid}`;
        
        // Manually construct the <Dial> and <Conference> verbs with attributes
        customerTwimlString += `<Dial>`;
        // IMPORTANT: Escape the URL for XML attribute safety
        const escapedCustomerStatusUrl = conference_status_URL.replace(/&/g, '&amp;');

        customerTwimlString += `<Conference` +
            ` statusCallback="${escapedCustomerStatusUrl}"` +
            ` statusCallbackEvent="start join leave end"` + // Space-separated list
            ` statusCallbackMethod="POST"` +
            ` startConferenceOnEnter="false"` + // Wait for agent to join first
            ` endConferenceOnExit="false"` +    // Don't end when customer leaves
            `>${conferenceName}</Conference>`; // Conference name inside the tag
        customerTwimlString += `</Dial>`;
        customerTwimlString += `</Response>`;

        console.log('Final TwiML sent successfully (MANUAL):', customerTwimlString); // Renamed log
        res.type('text/xml');
        res.send(customerTwimlString); // Send the manually constructed string
        
    } catch (error) {
        console.error('Error in transfer-conference-entry-point:', error.message);
        const errorResponse = new VoiceResponse();
        errorResponse.say('There was an error connecting your call. Please contact support.');
        res.type('text/xml');
        res.status(500).send(errorResponse.toString());
    }
});

router.post('/transfer-conference-entry-point_V2', (req, res) => {
    try {
        const {
            conferenceName,
            fromNumber,
            toNumber,
            companyid,
            job_id,
            mainCallSid
        } = req.query;

        console.log('Received transfer-conference-entry-point request:', JSON.stringify(req.query, null, 2));
        logMessage('Received transfer-conference-entry-point request:', JSON.stringify(req.query, null, 2));

        if (!conferenceName) {
            console.error('Missing conferenceName in query parameters');
            logMessage('Missing conferenceName in query parameters');
            const errorResponse = new VoiceResponse();
            errorResponse.say('Conference name is missing. Please try again.');
            res.type('text/xml');
            return res.status(400).send(errorResponse.toString());
        }

        const response = new VoiceResponse();
        response.say('Please wait a moment while I connect you to a human agent.');
        const dial = response.dial();

        console.log('Dialing conference:', conferenceName);
        logMessage('Dialing conference:', conferenceName);       

        const conference_status_URL = `${TOOLS_BASE_URL}/twilio/conference-status?conferenceName=${encodeURIComponent(conferenceName)}&callSid=${mainCallSid}`;
        console.log('Conference status callback URL for customer:', conference_status_URL);
        logMessage('Conference status callback URL for customer:', conference_status_URL);

        // --- ADD THESE LOGS HERE ---
        console.log('DEBUG: conferenceName being passed:', conferenceName);
        console.log('DEBUG: conference_status_URL being passed:', conference_status_URL);
        console.log('DEBUG: statusCallbackEvent being passed:', ['start', 'end', 'join', 'leave']);
        console.log('DEBUG: statusCallbackMethod being passed:', 'POST');
        // --- END ADDED LOGS ---
        
        dial.conference(conferenceName, {
            statusCallback: conference_status_URL,
            statusCallbackEvent: ['start', 'end', 'join', 'leave'],         
            statusCallbackMethod: 'POST',
            startConferenceOnEnter: false, // Wait for agent to join first
            endConferenceOnExit: false // Don't end when customer leaves
        });

        const finalTwimlOutput = response.toString(); // Capture the output
        console.log('Final TwiML sent successfully:', finalTwimlOutput); // Log the captured output
        logMessage('Final TwiML sent successfully:', finalTwimlOutput);

        res.type('text/xml');
        res.send(finalTwimlOutput); // Send the captured output

    } catch (error) {
        console.error('Error in transfer-conference-entry-point:', error.message);
        logMessage('Error in transfer-conference-entry-point:', error.message);
        
        const errorResponse = new VoiceResponse();
        errorResponse.say('There was an error connecting your call. Please contact support.');
        res.type('text/xml');
        res.status(500).send(errorResponse.toString());
    }
});

router.post('/transfer-conference-entry-point_1', (req, res) => {
    try {
        const {
            conferenceName,
            fromNumber,
            toNumber,
            companyid,
            job_id,
            mainCallSid
        } = req.query;

        console.log('Received transfer-conference-entry-point request:', JSON.stringify(req.query, null, 2));
        logMessage('Received transfer-conference-entry-point request:', JSON.stringify(req.query, null, 2));
        
        if (!conferenceName) {
            console.error('Missing conferenceName in query parameters');
            logMessage('Missing conferenceName in query parameters');
            const errorResponse = new VoiceResponse();
            errorResponse.say('Conference name is missing. Please try again.');
            res.type('text/xml');
            return res.status(400).send(errorResponse.toString());
        }

        const response = new VoiceResponse();
        response.say('Please wait a moment while I connect you to a human agent.');
        const dial = response.dial();
        
        console.log('Dialing conference:', conferenceName);
        logMessage('Dialing conference:', conferenceName);       
     
        // const confName = encodeURIComponent(conferenceName);

        // const conference_status_URL = `${TOOLS_BASE_URL}/twilio/conference-status?conferenceName=${encodeURIComponent(conferenceName)}&callSid=${callSid}`;
          // --- CORRECTED URL CONSTRUCTION HERE ---
        const conference_status_URL = `${TOOLS_BASE_URL}/twilio/conference-status?conferenceName=${encodeURIComponent(conferenceName)}&callSid=${mainCallSid}`;
        console.log('Conference status callback URL for customer:', conference_status_URL);
        logMessage('Conference status callback URL for customer:', conference_status_URL);



        // const conference_status_URL = `${TOOLS_BASE_URL}/twilio/conference-status${confName}&callSid=${mainCallSid}`;
        // console.log('Conference status callback URL:', conference_status_URL);
        // logMessage('Conference status callback URL:', conference_status_URL);

        
        dial.conference(conferenceName, {
            statusCallback: conference_status_URL,
            statusCallbackEvent: ['start', 'end', 'join', 'leave'],                 
            statusCallbackMethod: 'POST',
            startConferenceOnEnter: false, // Wait for agent to join first
            endConferenceOnExit: false // Don't end when customer leaves
        });

        console.log('Conference TwiML sent successfully:', response.toString());
        logMessage('Conference TwiML sent successfully:', response.toString());

        res.type('text/xml');
        res.send(response.toString());
        
    } catch (error) {
        console.error('Error in transfer-conference-entry-point:', error.message);
        logMessage('Error in transfer-conference-entry-point:', error.message);
        
        const errorResponse = new VoiceResponse();
        errorResponse.say('There was an error connecting your call. Please contact support.');
        res.type('text/xml');
        res.status(500).send(errorResponse.toString());
    }
});



router.post('/conference-status', async (req, res) => {
    console.log('📞 Conference status webhook called!');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Query:', JSON.stringify(req.query, null, 2));
    logMessage('Conference status webhook called:');

    try {
        const {
            ConferenceSid,
            StatusCallbackEvent,
            FriendlyName,
            Timestamp
        } = req.body;

        console.log(`Conference Event: ${StatusCallbackEvent} for Conference: ${FriendlyName} (${ConferenceSid})`);
        logMessage(`Conference Event: ${StatusCallbackEvent} for Conference: ${FriendlyName} (${ConferenceSid})`, JSON.stringify(req.body, null, 2));

        // Handle specific conference events
        switch (StatusCallbackEvent) {
            case 'conference-start':
                console.log('Conference started');
                break;
            case 'conference-end':
                console.log('Conference ended');
                break;
            case 'participant-join':
                console.log('Participant joined');
                break;
            case 'participant-leave':
                console.log('Participant left');
                break;
            default:
                console.log('Unknown conference event:', StatusCallbackEvent);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('❌ Error handling conference status:', err.message);
        logMessage('Error handling conference status:', err.message);
        res.status(500).send('Error');
    }
});

router.post('/transfer-status', async (req, res) => {
  try {
   console.log('*******/transfer-status*************');

  logMessage('*Received /transferCall request: post', JSON.stringify(req.body, null, 2));
  console.log('********************');
  console.log('********************');
  console.log(req.body);
    const {
      CallSid,
      ParentCallSid,
      From,
      To,
      CallStatus,
      ConferenceSid, // May be present if related to conference events
      StatusCallbackEvent // Will be from Dial's statusCallback or Call Resource's statusCallback
    } = req.body;

    console.log('📞 Transfer status received:', {
      CallSid,
      ParentCallSid,
      From,
      To,
      CallStatus,
      ConferenceSid,
      StatusCallbackEvent
    });
  
  logMessage('CallSid :' +CallSid + ' ParentCallSid :' +ParentCallSid + ' From :' +From + ' To :' +To + ' CallStatus :' +CallStatus + ' ConferenceSid :' +ConferenceSid + ' StatusCallbackEvent :' +StatusCallbackEvent);
  const mainCallSid = req.query.mainCallSid;

    // Always return valid TwiML to prevent Twilio from hanging up due to an invalid response.
    const twiml = new twilio.twiml.VoiceResponse();

    if (!CallSid) {
      console.warn('Missing CallSid in transfer status webhook. Cannot process.');
      logMessage('Missing CallSid in transfer status webhook. Cannot process.');
      return res.status(200).send(twiml.toString());
    }
    //Update Event *************
    
    // Pass along mainCallSid to your logging function if needed
    const result = await log_TransferCall_status({
      ...req.body,
      mainCallSid
    });
    logMessage('Logging call Status', result);
    console.log('Logging call Status',result);

//     // Log specific events if needed, but ensure we always return TwiML
//     if (StatusCallbackEvent) { // Check if StatusCallbackEvent is present to differentiate
//       console.log(`Received status event '${StatusCallbackEvent}' for CallSid ${CallSid} with status ${CallStatus}.`);
//       // You can add more specific logic here based on CallSid and StatusCallbackEvent
//       // For example, update your activeCalls map, or log agent status.
//     } else {
//       // This might be a generic call status update if StatusCallbackEvent is not explicitly set
//       console.log(`Received generic call status update for CallSid ${CallSid} with status ${CallStatus}.`);
//     }
//     
     res.status(200).send(twiml.toString());
  } catch (error) {
    console.error('❌ Error in /twilio/transfer-status webhook:', error.message);
    logMessage('Error in /twilio/transfer-status webhook:', error.message);
    // Even on error, return valid TwiML to Twilio to prevent call termination due to webhook error.
//     const twiml = new twilio.twiml.VoiceResponse();
//     twiml.say('An  occurred during transfer processing. Please try again or contact support.');
//     res.status(500).send(twiml.toString());
  }
});
 

router.post('/transferCall', async (req, res) => {

    console.log('/transferCall Transfer call request received:', req.body);  
    logMessage('Received /transferCall request:', JSON.stringify(req.body, null, 2));
    const { callId,isCallForwarding,forwardingMobileNumber,firstname,lastname,transferReason,fromNumber,toNumber,direction,companyid,job_id,conversationSummary,

      intent_from,
      ResponseAccuracy,
      KnowledgeLimitationHandling, ConfidenceandClarity,ToneandEmpathy,
      EscalationHandling,CustomerSatisfactionOutcome,CustomerBehavior,
      CustomerEffortLevel,ConversationCompletion,EmotionalShiftDuringConversation,
      BackgroundNoiseLevelCustomer,BackgroundNoiseLevelAI,CallDisruptionDueToNoiseOrAudioQuality,
      OverallConversationQuality,callIntent,CallerToneandEmpathy



     } = req.body;
    console.log(`/transferCall Request to transfer call with callId: ${callId}`);

    try {
        const result = await transferActiveCall(callId,isCallForwarding,forwardingMobileNumber,firstname,lastname,transferReason,fromNumber,toNumber,direction,companyid,job_id,conversationSummary,
           intent_from,
          ResponseAccuracy,
      KnowledgeLimitationHandling, ConfidenceandClarity,ToneandEmpathy,
      EscalationHandling,CustomerSatisfactionOutcome,CustomerBehavior,
      CustomerEffortLevel,ConversationCompletion,EmotionalShiftDuringConversation,
      BackgroundNoiseLevelCustomer,BackgroundNoiseLevelAI,CallDisruptionDueToNoiseOrAudioQuality,
      OverallConversationQuality,callIntent,CallerToneandEmpathy);
      logMessage('Transfer call result:', JSON.stringify(result, null, 2));
        res.json(result);
    } catch (error) {
      logMessage('Error in /transferCall:', error.message || error);
        res.status(500).json(error);
    }
});


// Add status callback handler
router.post('/callStatus', async (req, res) => {
  try {
      console.log('**************** Twilio status callback:', req.body);
      const twilioCallSid = req.body.CallSid;
      const status = req.body.CallStatus;
      console.log(`Call status / update for ${twilioCallSid}: ${status}`);
      
      // Find Ultravox call ID
      const ultravoxCallId = Array.from(activeCalls.entries())
          .find(([_, data]) => data.twilioCallSid === twilioCallSid)?.[0];

      if (status === 'completed' && ultravoxCallId) {
          console.log(`Processing completed call ${ultravoxCallId}`);
          
          // Add delay to ensure transcript is ready
          await new Promise(resolve => setTimeout(resolve, 2500));
          
          // Get and save transcript
          const transcript = await getCallTranscript(ultravoxCallId);
          await fetch(`${process.env.BASE_URL}/saveTranscript`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                  callId: ultravoxCallId,
                  twilioCallSid,
                  transcript,
                  summary: transcriptSummary(transcript),
                  metadata: activeCalls.get(ultravoxCallId)
              })
          });
          
          activeCalls.delete(ultravoxCallId);
      }
      
      res.status(200).end();
  } catch (error) {
      console.error('Status callback error:', error);
      res.status(500).json({ 
          success: false,
          error: error.message 
      });
  }
});

router.get('/health', (req, res) => {
  console.log('Health check endpoint hit');
  res.json({
      status: 'ok',
      activeCalls: activeCalls.size,
      baseUrl: process.env.BASE_URL
  });
});
 
router.get('/admin/active-calls', (req, res) => {
  res.json({ activeCount: activeCalls.size });
});
 
router.post('/recording-status', async (req, res) => {
  try {
    const {
      CallSid,
      ConferenceSid, // This will be present for conference recordings
      RecordingSid,
      RecordingUrl,
      RecordingStatus,
      RecordingDuration,
      RecordingChannels,
      Timestamp
    } = req.body;

    const { companyid, job_id, mainCallSid, conferenceName } = req.query;

    console.log('📥 Twilio Recording Status Received:');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    console.log('Request Query:', JSON.stringify(req.query, null, 2));
    
    logMessage('Received recording status webhook:', JSON.stringify({
      body: req.body,
      query: req.query
    }, null, 2));

    // Determine if this is a conference recording or call recording
    const isConferenceRecording = !!ConferenceSid;
    
    console.log(`Recording Type: ${isConferenceRecording ? 'Conference' : 'Call'} Recording`);
    
    if (RecordingUrl) {
      // Construct direct .mp3 download URL
      const mp3Url = `${RecordingUrl}.mp3`;
      
      console.log(`📼 Recording Available: ${mp3Url}`);
      console.log(`📊 Duration: ${RecordingDuration} seconds`);
      console.log(`🔊 Channels: ${RecordingChannels}`);
      
      // Save recording details to your database
      const recordingDetails = {
        callSid: CallSid,
        conferenceSid: ConferenceSid,
        recordingSid: RecordingSid,
        recordingUrl: mp3Url,
        status: RecordingStatus,
        duration: RecordingDuration,
        channels: RecordingChannels,
        timestamp: Timestamp,
        companyid: companyid,
        jobId: job_id,
        mainCallSid: mainCallSid,
        conferenceName: conferenceName,
        recordingType: isConferenceRecording ? 'conference' : 'call'
      };

      // TODO: Save to your database
      console.log('Recording details to save:', recordingDetails);
      logMessage('Recording details to save:', JSON.stringify(recordingDetails, null, 2));
      
      // You can call your database save function here
      // await saveRecordingToDatabase(recordingDetails);
    }

    res.status(200).send('Recording status received');
  } catch (error) {
    console.error('❌ Error in recording-status webhook:', error);
    logMessage('Error in recording-status webhook:', error.message);
    res.status(500).send('Internal Server Error');
  }
});
 
router.post('/hangUpCall', async (req, res) => {
  try {
    const { callId,companyid,toNumber,fromNumber,direction,
      intent_from, ResponseAccuracy,
     KnowledgeLimitationHandling, ConfidenceandClarity,ToneandEmpathy,
     EscalationHandling,CustomerSatisfactionOutcome,CustomerBehavior,
     CustomerEffortLevel,ConversationCompletion,EmotionalShiftDuringConversation,
     BackgroundNoiseLevelCustomer,BackgroundNoiseLevelAI,CallDisruptionDueToNoiseOrAudioQuality,
     OverallConversationQuality,callIntent,CallerToneandEmpathy
     } = req.body;

    if (!callId || typeof callId !== 'string') {
      console.log("/hangUpCall Invalid or missing callId");
      //return res.status(400).json({ success: false, error: 'Invalid or missing callId' });
    }
    console.log(' /hangUpCall callId : ',callId);
    const callDetails = activeCalls.get(callId);

    if (!callDetails || !callDetails.twilioCallSid) {
      console.log("/hangUpCall Call not found or invalid Twilio SID");
      return res.status(404).json({ success: false, error: 'Call not found or invalid Twilio SID' });
    }
    console.log(' /hangUpCall callDetails.twilioCallSid : ',callDetails.twilioCallSid);

    const teleCRED =await fetchTelecomNumberByPhone(fromNumber);
    console.log('teleCRED : ' , teleCRED);

    const client = twilio(teleCRED.twilio_account_sid, teleCRED.twilio_auth_token);

    await client.calls(callDetails.twilioCallSid).update({ status: 'completed' });

    // activeCalls.delete(callId);
    const hangupCallresult =await hangupCall(callId,"Agent",
      companyid,toNumber,fromNumber,direction,
       intent_from, ResponseAccuracy,
     KnowledgeLimitationHandling, ConfidenceandClarity,ToneandEmpathy,
     EscalationHandling,CustomerSatisfactionOutcome,CustomerBehavior,
     CustomerEffortLevel,ConversationCompletion,EmotionalShiftDuringConversation,
     BackgroundNoiseLevelCustomer,BackgroundNoiseLevelAI,CallDisruptionDueToNoiseOrAudioQuality,
     OverallConversationQuality,callIntent,CallerToneandEmpathy


    );
    console.log('hangupCall : ',hangupCallresult);

    return res.status(200).json({ success: true, message: 'Call ended successfully' });

  } catch (error) {
    console.log('❌ /hangUpCall Error hanging up call:', error.message || error);
    return res.status(500).json({ success: false, error: 'Internal Server Error. Failed to hang up call.' });
  }
});

router.post('/conference-status_2', async (req, res) => {
    console.log('📞 Conference status webhook called!');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Query:', JSON.stringify(req.query, null, 2));

    try {
        const {
            ConferenceSid,
            StatusCallbackEvent,
            FriendlyName,
            Timestamp
        } = req.body;

        console.log(`Conference Event: ${StatusCallbackEvent} for Conference: ${FriendlyName} (${ConferenceSid})`);
        logMessage(`Conference Event: ${StatusCallbackEvent} for Conference: ${FriendlyName} (${ConferenceSid})`, JSON.stringify(req.body, null, 2));

        // Handle specific conference events
        switch (StatusCallbackEvent) {
            case 'conference-start':
                console.log('Conference started');
                break;
            case 'conference-end':
                console.log('Conference ended');
                break;
            case 'participant-join':
                console.log('Participant joined');
                break;
            case 'participant-leave':
                console.log('Participant left');
                break;
            default:
                console.log('Unknown conference event:', StatusCallbackEvent);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('❌ Error handling conference status:', err.message);
        logMessage('Error handling conference status:', err.message);
        res.status(500).send('Error');
    }
});

router.post('/conference-status_1', async (req, res) => {

    console.log('📞 Conference status received');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);


  console.log('Conference Event:', JSON.stringify(req.body, null, 2));
  logMessage('Conference Event:', JSON.stringify(req.body, null, 2));   
 
  try {
 
    res.status(200).send('OK');
  } catch (err) {
    console.error('❌ Error handling conference status:', err.message);
    logMessage('Error handling conference status:', err.message);
    res.status(500).send('Error');
  }
});

// Fixed transfer-conference-entry-point route
router.post('/transfer-conference-entry-point_2', (req, res) => {
    try {
        const {
            conferenceName,
            fromNumber,
            toNumber,
            companyid,
            job_id,
            mainCallSid
        } = req.query;

        console.log('Received transfer-conference-entry-point request:', JSON.stringify(req.query, null, 2));
        logMessage('Received transfer-conference-entry-point request:', JSON.stringify(req.query, null, 2));
        
        if (!conferenceName) {
            console.error('Missing conferenceName in query parameters');
            logMessage('Missing conferenceName in query parameters');
            const errorResponse = new VoiceResponse();
            errorResponse.say('Conference name is missing. Please try again.');
            res.type('text/xml');
            return res.status(400).send(errorResponse.toString());
        }

        const response = new VoiceResponse();
        response.say('Please wait a moment while I connect you to a human agent.');
        const dial = response.dial();
        
        console.log('Dialing conference:', conferenceName);
        logMessage('Dialing conference:', conferenceName);
        
        const conference_status = `${TOOLS_BASE_URL}/twilio/conference-status`;
        console.log('Conference status callback URL:', conference_status);
        logMessage('Conference status callback URL:', conference_status);

        // FIXED: Correct parameter order and structure
        dial.conference(conferenceName, {
            statusCallback: conference_status,
            statusCallbackEvent: 'start end join leave',
            statusCallbackMethod: 'POST',
            startConferenceOnEnter: false, // Wait for agent to join first
            endConferenceOnExit: false // Don't end when customer leaves
        });

        console.log('Conference TwiML sent successfully:', response.toString());
        logMessage('Conference TwiML sent successfully:', response.toString());

        res.type('text/xml');
        res.send(response.toString());
        
    } catch (error) {
        console.error('Error in transfer-conference-entry-point:', error.message);
        logMessage('Error in transfer-conference-entry-point:', error.message);
        
        const errorResponse = new VoiceResponse();
        errorResponse.say('There was an error connecting your call. Please contact support.');
        res.type('text/xml');
        res.status(500).send(errorResponse.toString());
    }
});
router.post('/transfer-conference-entry-point_1', (req, res) => 
{
  try {
    const {
      conferenceName,
      fromNumber,
      toNumber,
      companyid,
      job_id,
      mainCallSid
    } = req.query;

    console.log('Received transfer-conference-entry-point request:', JSON.stringify(req.query, null, 2));
    logMessage('Received transfer-conference-entry-point request:', JSON.stringify(req.query, null, 2));
    
    if (!conferenceName) {
      console.error('Missing conferenceName in query parameters');
      logMessage('Missing conferenceName in query parameters');
      const errorResponse = new VoiceResponse();
      errorResponse.say('Conference name is missing. Please try again.');
      res.type('text/xml');
      return res.status(400).send(errorResponse.toString());
    }

    const response = new VoiceResponse();
    response.say('Please wait a moment while I connect you to a human agent.');
    const dial = response.dial();
    
    console.log('Dialing conference:', conferenceName);
    logMessage('Dialing conference:', conferenceName);
    
    // Build conference options object with FIXED recording setup
    const  conference_status=`${TOOLS_BASE_URL}/twilio/conference-status`;
    console.log('Conference status callback URL:', conference_status);
    logMessage('Conference status callback URL:', conference_status);
 
    dial.conference(
      {
        statusCallback: conference_status,
        statusCallbackEvent: 'start end join leave', // <-- ADD THIS LINE
        statusCallbackMethod: 'POST',  
      },
      conferenceName
    );

    console.log('Conference TwiML sent successfully:', response.toString());
    logMessage('Conference TwiML sent successfully:', response.toString());

    res.type('text/xml');
    res.send(response.toString());
    
  } catch (error) {
    console.error('Error in transfer-conference-entry-point:', error.message);
    logMessage('Error in transfer-conference-entry-point:', error.message);
    
    const errorResponse = new VoiceResponse();
    errorResponse.say('There was an error connecting your call. Please contact support.');
    res.type('text/xml');
    res.status(500).send(errorResponse.toString());
  }
});
async function transferActiveCall_2(ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, fromNumber, toNumber, direction, companyid, job_id, conversationSummary, intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy, EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation, BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy) {
    try {
        logMessage('transferActiveCall called with parameters:', JSON.stringify({
            ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, fromNumber, toNumber, direction, companyid, job_id
        }, null, 2));

        if (!isCallForwarding) {
            await log_incoming_call_request('Call forwarding is disabled', { 
                ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, direction, companyid, job_id, conversationSummary,
                intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy,
                EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation,
                BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy
            }, 'transferActiveCall');

            console.log('Call forwarding is disabled');
            return {
                status: 'false',
                message: 'Call forwarding is disabled'
            };
        }

        const callData = activeCalls.get(ultravoxCallId);
        console.log('Call data:', callData);

        if (!callData || !callData.twilioCallSid) {
            logMessage('Call not found or invalid CallSid');
            await log_incoming_call_request('Call not found or invalid CallSid', { 
                ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, job_id, conversationSummary 
            }, 'transferActiveCall');
            throw new Error('Call not found or invalid CallSid');
        }

        const twilioCallSid = callData.twilioCallSid;
        const callSid = twilioCallSid;
        
        console.log('Getting Twilio credentials...');
        const result = await log_TransferCall_gc({
            callid: ultravoxCallId, twilioCallSid, fromNumber, toNumber, forwardingMobileNumber, firstname, 
            lastname, transferReason, isCallForwarding, direction, companyid, job_id, conversationSummary,
            intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy,
            EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation,
            BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy
        }); 

        const twilio_account_sid = result?.message?.phone_credentials?.twilio_account_sid;
        const twilio_auth_token = result?.message?.phone_credentials?.twilio_auth_token;

        if (!twilio_account_sid || !twilio_auth_token) {
            await log_incoming_call_request('twilio_account_sid or twilio_auth_token is null', { 
                ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, job_id 
            }, 'Missing Twilio credentials');
            throw new Error('Twilio credentials not found');
        }

        const client = twilio(twilio_account_sid, twilio_auth_token); 
        const conferenceName = `conference_${callSid}`;

        console.log('Updating call to redirect to conference entry point...');
        
        // Use the URL method to redirect the call
        const updatedCall = await client.calls(callData.twilioCallSid)
            .update({
                url: `${TOOLS_BASE_URL}/twilio/transfer-conference-entry-point?conferenceName=${encodeURIComponent(conferenceName)}&fromNumber=${encodeURIComponent(fromNumber)}&toNumber=${encodeURIComponent(toNumber)}&companyid=${encodeURIComponent(companyid)}&job_id=${encodeURIComponent(job_id)}&mainCallSid=${encodeURIComponent(callSid)}`,
                method: 'POST'
            });

        console.log('Call redirected successfully. Now creating outbound call to agent...');

        // Create the agent response TwiML - FIXED CONFERENCE CONFIGURATION
        const agentResponse = new twilio.twiml.VoiceResponse();
        agentResponse.say("You are being connected to a user. Here's a quick summary.");
        
        if (conversationSummary) {
            agentResponse.say(conversationSummary, { voice: "alice", language: "en-US" });
        }
        
        const conference_status = `${TOOLS_BASE_URL}/twilio/conference-status`;
        logMessage('Conference status callback URL:', conference_status);
        
        const agentDial = agentResponse.dial();
        
        // FIXED: Correct parameter order and format
        agentDial.conference(conferenceName, {
            startConferenceOnEnter: true,
            endConferenceOnExit: true,
            statusCallback: conference_status,
            statusCallbackEvent: 'start end join leave', // Keep as string - Twilio accepts both formats
            statusCallbackMethod: 'POST'
        });

        // Create outbound call to the agent
        const outboundCall = await client.calls.create({
            to: forwardingMobileNumber,
            from: fromNumber,
            twiml: agentResponse.toString(),
            statusCallback: `${TOOLS_BASE_URL}/twilio/transfer-status?mainCallSid=${callSid}`,
            statusCallbackMethod: 'POST',
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
        });

        console.log('Outbound call initiated to specialist. SID:', outboundCall.sid);
        logMessage('Outbound call initiated to specialist. SID:', outboundCall.sid);

        return {
            status: 'success',
            message: 'Call transfer initiated'
        };

    } catch (error) {
        logMessage('Error transferring call:', error.message || error);
        console.error('Error transferring call:', error);
        
        await log_incoming_call_request('Error transferring call', { 
            ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, direction, companyid, job_id 
        }, error.message);
        
        throw {
            status: 'error',
            message: 'Failed to transfer call',
            error: error.message
        };
    }
}

// Function to retrieve conference recordings programmatically
async function getConferenceRecordings(conferenceSid, twilioClient) {
  try {
    console.log(`Fetching recordings for conference: ${conferenceSid}`);
    
    // Fetch recordings from the CONFERENCE resource, not the call resource
    const recordings = await twilioClient.conferences(conferenceSid)
      .recordings
      .list();

    console.log(`Found ${recordings.length} conference recordings`);
    
    recordings.forEach((recording, index) => {
      console.log(`Recording ${index + 1}:`, {
        sid: recording.sid,
        status: recording.status,
        duration: recording.duration,
        channels: recording.channels,
        url: recording.uri,
        downloadUrl: `${recording.uri}.mp3`
      });
    });

    return recordings;
  } catch (error) {
    console.error('Error fetching conference recordings:', error.message);
    return [];
  }
}

router.get('/transfer-status', async (req, res) => {
  try {
   console.log('*******/transfer-status GET*************');

  logMessage('*Received /transferCall request GET:', JSON.stringify(req.body, null, 2));
  console.log('********************');
  console.log('********************');
  console.log(req.body);
    const {
      CallSid,
      ParentCallSid,
      From,
      To,
      CallStatus,
      ConferenceSid, // May be present if related to conference events
      StatusCallbackEvent // Will be from Dial's statusCallback or Call Resource's statusCallback
    } = req.body;

    console.log('📞 Transfer status received:', {
      CallSid,
      ParentCallSid,
      From,
      To,
      CallStatus,
      ConferenceSid,
      StatusCallbackEvent
    });
  
  //logMessage('CallSid :' +CallSid + ' ParentCallSid :' +ParentCallSid + ' From :' +From + ' To :' +To + ' CallStatus :' +CallStatus + ' ConferenceSid :' +ConferenceSid + ' StatusCallbackEvent :' +StatusCallbackEvent);
   
  res.status(200).send("this is a GET request to /transfer-status endpoint. Please use POST method instead.");
  } catch (error) {
    console.error('❌ Error in /twilio/transfer-status webhook:', error.message);
    logMessage('Get Error in /twilio/transfer-status webhook:', error.message);
    // Even on error, return valid TwiML to Twilio to prevent call termination due to webhook error.
//     const twiml = new twilio.twiml.VoiceResponse();
//     twiml.say('An  occurred during transfer processing. Please try again or contact support.');
//     res.status(500).send(twiml.toString());
  }
});
// Function to retrieve call recordings (for comparison)
async function getCallRecordings(callSid, twilioClient) {
  try {
    console.log(`Fetching recordings for call: ${callSid}`);
    
    // Fetch recordings from the CALL resource
    const recordings = await twilioClient.calls(callSid)
      .recordings
      .list();

    console.log(`Found ${recordings.length} call recordings`);
    return recordings;
  } catch (error) {
    console.error('Error fetching call recordings:', error.message);
    return [];
  }
}
 async function transferActiveCall_1(ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, fromNumber, toNumber, direction, companyid, job_id, conversationSummary, intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy, EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation, BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy) {
    try {
        logMessage('transferActiveCall called with parameters:', JSON.stringify({
            ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, fromNumber, toNumber, direction, companyid, job_id
        }, null, 2));

        if (!isCallForwarding) {
            await log_incoming_call_request('Call forwarding is disabled', { 
                ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, direction, companyid, job_id, conversationSummary,
                intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy,
                EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation,
                BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy
            }, 'transferActiveCall');

            console.log('Call forwarding is disabled');
            return {
                status: 'false',
                message: 'Call forwarding is disabled'
            };
        }

        const callData = activeCalls.get(ultravoxCallId);
        console.log('Call data:', callData);

        if (!callData || !callData.twilioCallSid) {
            logMessage('Call not found or invalid CallSid');
            await log_incoming_call_request('Call not found or invalid CallSid', { 
                ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, job_id, conversationSummary 
            }, 'transferActiveCall');
            throw new Error('Call not found or invalid CallSid');
        }

        const twilioCallSid = callData.twilioCallSid;
        const callSid = twilioCallSid;
        
        console.log('Getting Twilio credentials...');
        const result = await log_TransferCall_gc({
            callid: ultravoxCallId, twilioCallSid, fromNumber, toNumber, forwardingMobileNumber, firstname, 
            lastname, transferReason, isCallForwarding, direction, companyid, job_id, conversationSummary,
            intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy,
            EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation,
            BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy
        }); 

 

        const twilio_account_sid = result?.message?.phone_credentials?.twilio_account_sid;
        const twilio_auth_token = result?.message?.phone_credentials?.twilio_auth_token;

        if (!twilio_account_sid || !twilio_auth_token) {
            await log_incoming_call_request('twilio_account_sid or twilio_auth_token is null', { 
                ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, job_id 
            }, 'Missing Twilio credentials');
            throw new Error('Twilio credentials not found');
        }

        const client = twilio(twilio_account_sid, twilio_auth_token); 
        const conferenceName = `conference_${callSid}`;

        console.log('Updating call to redirect to conference entry point...');
        
        // Use the URL method to redirect the call
        const updatedCall = await client.calls(callData.twilioCallSid)
            .update({
                url: `${TOOLS_BASE_URL}/twilio/transfer-conference-entry-point?conferenceName=${encodeURIComponent(conferenceName)}&fromNumber=${encodeURIComponent(fromNumber)}&toNumber=${encodeURIComponent(toNumber)}&companyid=${encodeURIComponent(companyid)}&job_id=${encodeURIComponent(job_id)}&mainCallSid=${encodeURIComponent(callSid)}`,
                method: 'POST'
            });

        console.log('Call redirected successfully. Now creating outbound call to agent...');

        // Create the agent response TwiML
        const agentResponse = new twilio.twiml.VoiceResponse();
        agentResponse.say("You are being connected to a user. Here's a quick summary.");
        
        if (conversationSummary) {
            agentResponse.say(conversationSummary, { voice: "alice", language: "en-US" });
        }
        const  conference_status=`${TOOLS_BASE_URL}/twilio/conference-status`;
        logMessage('Conference status callback URL:', conference_status);
        const agentDial = agentResponse.dial();
        agentDial.conference(conferenceName, {
            startConferenceOnEnter: true,
            endConferenceOnExit: true,
            statusCallback: conference_status,
            statusCallbackEvent: "start end join leave",
            // statusCallbackEvent: ['start', 'end', 'join', 'leave'],
            statusCallbackMethod: 'POST',
           
            
        });

        // Create outbound call to the agent
        const outboundCall = await client.calls.create({
            to: forwardingMobileNumber,
            from: fromNumber,
            twiml: agentResponse.toString(),
            statusCallback: `${TOOLS_BASE_URL}/twilio/transfer-status?mainCallSid=${callSid}`,
            statusCallbackMethod: 'POST',
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
        });

        console.log('Outbound call initiated to specialist. SID:', outboundCall.sid);
        logMessage('Outbound call initiated to specialist. SID:', outboundCall.sid);

        return {
            status: 'success',
            message: 'Call transfer initiated'
        };

    } catch (error) {
        logMessage('Error transferring call:', error.message || error);
        console.error('Error transferring call:', error);
        
        await log_incoming_call_request('Error transferring call', { 
            ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, direction, companyid, job_id 
        }, error.message);
        
        throw {
            status: 'error',
            message: 'Failed to transfer call',
            error: error.message
        };
    }
}
 
export { router};

// 📋 Available record values:
// Option	Description
// 'do-not-record'	❌ Default. The call is not recorded.
// 'record-from-start'	✅ Recording begins as soon as the first participant joins the conference.
// 'record-from-answer'	✅ Recording begins after the first participant answers.
// 'record-from-ringing'	✅ Recording begins as soon as the call starts ringing. Useful for full call capture including ring tone.
// 'record-from-connect'	✅ Starts recording once both participants are connected in the conference. Best if you only want conversation audio.
// 'true' (deprecated)	Same as 'record-from-start'. Not recommended—use a specific value instead.


