import express, { json } from 'express';
import twilio from 'twilio';
import 'dotenv/config';
// import { createUltravoxCall } from '../utils/ultravox-utils.js';
// import { createUltravoxCallConfig } from '../config/ultravox-config.js';
import { hangupCall, fetchTelecomNumberByPhone,log_incoming_call_request,log_TransferCall_status,save_phone_company_log,
   log_Conference_end, get_conf_party,getbusinessbyPhoneNumber,log_TransferCall_gc,getTTokenForJob,log_Conference_status } from '../api/erpcall.js';
import {
  TOOLS_BASE_URL,
} from '../config/config.js';
import activeCalls from '../utils/activeCallsStore.js'; // adjust path accordingly
// import { fetchCallDetails } from '../utils/twilioUtils.js';
import { logMessage } from '../utils/logger.js';
 
const VoiceResponse = twilio.twiml.VoiceResponse;
 
const router = express.Router();

 // Function to escape XML entities for TwiML attributes
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

// --- transferActiveCall Function (Agent Leg) ---
async function transferActiveCall(ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, fromNumber, toNumber, direction, companyid, job_id, conversationSummary, intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy, EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation, BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy) {
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
        const callSid = twilioCallSid; // Renaming for clarity as this is the main call SID

        console.log('Getting Twilio credentials...');
        logMessage('Getting Twilio credentials for call transfer:');
        const result = await log_TransferCall_gc({
            callid: ultravoxCallId, twilioCallSid, fromNumber, toNumber, forwardingMobileNumber, firstname, 
            lastname, transferReason, isCallForwarding, direction, companyid, job_id, conversationSummary,
            intent_from, ResponseAccuracy, KnowledgeLimitationHandling, ConfidenceandClarity, ToneandEmpathy,
            EscalationHandling, CustomerSatisfactionOutcome, CustomerBehavior, CustomerEffortLevel, ConversationCompletion, EmotionalShiftDuringConversation,
            BackgroundNoiseLevelCustomer, BackgroundNoiseLevelAI, CallDisruptionDueToNoiseOrAudioQuality, OverallConversationQuality, callIntent, CallerToneandEmpathy
        }); 
        // logMessage('log_TransferCall_gc result:', JSON.stringify(result, null, 2));

        const twilio_account_sid = result?.message?.phone_credentials?.twilio_account_sid;
        const twilio_auth_token = result?.message?.phone_credentials?.twilio_auth_token;
        const transfer_call_recording = result?.message?.transfer_call_recording;
        const max_conf_duration=  result?.message?.max_conf_duration;

        const recordEnabled = transfer_call_recording === 1;

       if (!twilio_account_sid || !twilio_auth_token) {
            await log_incoming_call_request('twilio_account_sid or twilio_auth_token is null', { 
                ultravoxCallId, isCallForwarding, forwardingMobileNumber, firstname, lastname, transferReason, job_id 
            }, 'Missing Twilio credentials');
            throw new Error('Twilio credentials not found');
        }

        const client = twilio(twilio_account_sid, twilio_auth_token); 
        const conferenceName = `conference_${callSid}`;

        console.log('Updating call to redirect to conference entry point...');
        const transferConferenceEntryPoint=`${TOOLS_BASE_URL}/twilio/transfer-conference-entry-point?conferenceName=${encodeURIComponent(conferenceName)}&job_id=${encodeURIComponent(job_id)}&mainCallSid=${encodeURIComponent(callSid)}&record=${encodeURIComponent(recordEnabled)}&max_dur=${encodeURIComponent(max_conf_duration)}`;    

        const updatedCall = await client.calls(callData.twilioCallSid)
            .update({
                url: transferConferenceEntryPoint,
                // url: `${TOOLS_BASE_URL}/twilio/transfer-conference-entry-point?conferenceName=${encodeURIComponent(conferenceName)}&fromNumber=${encodeURIComponent(fromNumber)}&toNumber=${encodeURIComponent(toNumber)}&companyid=${encodeURIComponent(companyid)}&job_id=${encodeURIComponent(job_id)}&mainCallSid=${encodeURIComponent(callSid)}`,
                method: 'POST'
            });

        console.log('Call redirected successfully. Now creating outbound call to agent...');

        // Start building the TwiML response string manually for the agent leg
        let agentTwimlString = `<?xml version="1.0" encoding="UTF-8"?><Response>`;
        agentTwimlString += `<Say>You are being connected to a user. Here's a quick summary.</Say>`;
        
        if (conversationSummary) {
            agentTwimlString += `<Say>${escapeXml(conversationSummary)}</Say>`;
        }

        //const conference_status_URL = `${TOOLS_BASE_URL}/twilio/conference-status?conferenceName=${encodeURIComponent(conferenceName)}&mainCallSid=${mainCallSid}&job_id=${encodeURIComponent(job_id)}`;
        //const recording_status_URL_customer = `${TOOLS_BASE_URL}/twilio/recording-status?conferenceName=${encodeURIComponent(conferenceName)}&mainCallSid=${encodeURIComponent(mainCallSid)}&job_id=${encodeURIComponent(job_id)}`;
       
        const mainCallSid= callSid; // Use the main call SID for the agent leg
        //const conference_status_URL = `${TOOLS_BASE_URL}/twilio/conference-status?conferenceName=${encodeURIComponent(conferenceName)}&mainCallSid=${mainCallSid}`;
        const conference_status_URL=`${TOOLS_BASE_URL}/twilio/conference-status?conferenceName=${encodeURIComponent(conferenceName)}&mainCallSid=${mainCallSid}&job_id=${encodeURIComponent(job_id)}`;
        logMessage('Conference status callback URL for agent:', conference_status_URL);

        // --- Recording Status Callback URL for Agent Leg ---
        // const recording_status_URL_agent = `${TOOLS_BASE_URL}/twilio/recording-status?companyid=${encodeURIComponent(companyid)}&job_id=${encodeURIComponent(job_id)}&mainCallSid=${encodeURIComponent(mainCallSid)}&conferenceName=${encodeURIComponent(conferenceName)}`;
        const recording_status_URL_agent=`${TOOLS_BASE_URL}/twilio/recording-status?conferenceName=${encodeURIComponent(conferenceName)}&mainCallSid=${encodeURIComponent(mainCallSid)}&job_id=${encodeURIComponent(job_id)}`;
        const escapedAgentRecordingStatusUrl = escapeXml(recording_status_URL_agent);


        // Manually construct the <Dial> and <Conference> verbs with attributes
        agentTwimlString += `<Dial>`;
        const escapedAgentStatusUrl = escapeXml(conference_status_URL); // Use the helper function
        
        // const recordEnabled = transfer_call_recording        'false'; // Enable recording for customer leg
        agentTwimlString += `<Conference` +
            ` statusCallback="${escapedAgentStatusUrl}"` +
            ` statusCallbackEvent="start join leave end"` +
            ` statusCallbackMethod="POST"` +
            ` startConferenceOnEnter="true"` +
            ` endConferenceOnExit="true"` + // Agent leaving ends conference
            ` maxDuration="${max_conf_duration}"` + // <--- Added maxDuration
            ` record="${recordEnabled}"`+  // Enable recording
            ` recordingStatusCallback="${escapedAgentRecordingStatusUrl}"` + // Recording status URL
            ` recordingStatusCallbackMethod="POST"` + // Method for recording status
            `>${conferenceName}</Conference>`;
        agentTwimlString += `</Dial>`;
        agentTwimlString += `</Response>`;

        // console.log('Conference TwiML created successfully (MANUAL):', agentTwimlString);
        // logMessage('Conference TwiML created successfully (MANUAL):', agentTwimlString);

        // Create outbound call to the agent using the manually constructed TwiML
        const transferstatusCallBack=`${TOOLS_BASE_URL}/twilio/transfer-status?mainCallSid=${mainCallSid}&job_id=${encodeURIComponent(job_id)}`
        logMessage('Transfer status callback URL:', transferstatusCallBack);
        const outboundCall = await client.calls.create({
            to: forwardingMobileNumber,
            from: fromNumber,
            twiml: agentTwimlString,
            statusCallback: transferstatusCallBack,
            statusCallbackMethod: 'POST',
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
        });

        // console.log('Outbound call initiated to specialist. SID:', outboundCall.sid);
        // logMessage('Outbound call initiated to specialist. SID:', outboundCall.sid);

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


// --- /transfer-conference-entry-point Route (Customer Leg) ---
router.post('/transfer-conference-entry-point', (req, res) => {
    try {
        const {
            conferenceName,
            // fromNumber,
            // toNumber,
            // companyid,
            job_id,
            mainCallSid,
            record,
            max_dur
        } = req.query;

        //twilio/transfer-conference-entry-point?conferenceName=${encodeURIComponent(conferenceName)}&job_id=${encodeURIComponent(job_id)}&mainCallSid=${encodeURIComponent(callSid)}`;
        //record=${encodeURIComponent(recordEnabled)}&max_dur
        logMessage('Received transfer-conference-entry-point request:', JSON.stringify(req.query, null, 2));

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
        
        const conference_status_URL = `${TOOLS_BASE_URL}/twilio/conference-status?conferenceName=${encodeURIComponent(conferenceName)}&mainCallSid=${mainCallSid}&job_id=${encodeURIComponent(job_id)}`;
        const recording_status_URL_customer = `${TOOLS_BASE_URL}/twilio/recording-status?conferenceName=${encodeURIComponent(conferenceName)}&mainCallSid=${encodeURIComponent(mainCallSid)}&job_id=${encodeURIComponent(job_id)}`;
        // const recording_status_URL_customer = `${TOOLS_BASE_URL}/twilio/recording-status?companyid=${encodeURIComponent(companyid)}&job_id=${encodeURIComponent(job_id)}&mainCallSid=${encodeURIComponent(mainCallSid)}&conferenceName=${encodeURIComponent(conferenceName)}`;
        const escapedCustomerRecordingStatusUrl = escapeXml(recording_status_URL_customer);


        // Manually construct the <Dial> and <Conference> verbs with attributes
        customerTwimlString += `<Dial>`;
        const escapedCustomerStatusUrl = escapeXml(conference_status_URL); // Use the helper function
        //const recordEnabled = 'false'; // Enable recording for customer leg
        customerTwimlString += `<Conference` +
            ` statusCallback="${escapedCustomerStatusUrl}"` +
            ` statusCallbackEvent="start join leave end"` +
            ` statusCallbackMethod="POST"` +
            ` startConferenceOnEnter="false"` + // Wait for agent to join first
            ` endConferenceOnExit="false"` +    // Don't end when customer leaves (managed by /conference-status)
            ` record="${record}"` + // Enable recording
            ` maxDuration="${max_dur}"` + // <--- Added maxDuration
            ` recordingStatusCallback="${escapedCustomerRecordingStatusUrl}"` + // Recording status URL
            ` recordingStatusCallbackMethod="POST"` + // Method for recording status
            `>${conferenceName}</Conference>`;
        customerTwimlString += `</Dial>`;
        customerTwimlString += `</Response>`;

        //console.log('Final TwiML sent successfully (MANUAL):', customerTwimlString);
        logMessage('Final TwiML sent successfully (MANUAL):', customerTwimlString);
        res.type('text/xml');
        res.send(customerTwimlString);
        
    } catch (error) {
        console.error('Error in transfer-conference-entry-point:', error.message);
        logMessage('Error in transfer-conference-entry-point:', error.message);
        
        const errorResponse = new VoiceResponse();
        errorResponse.say('There was an error connecting your call. Please contact support.');
        res.type('text/xml');
        res.status(500).send(errorResponse.toString());
    }
});

// --- /conference-status Route (No Changes needed for recording attribute) ---
// console.log('📞 Conference status webhook called!');
// console.log('Headers:', JSON.stringify(req.headers, null, 2));
// console.log('Body:', JSON.stringify(req.body, null, 2));
// console.log('Query:', JSON.stringify(req.query, null, 2));

router.post('/conference-status', async (req, res) => {
    logMessage('Conference status webhook called:');
    logMessage('Body:', JSON.stringify(req.body, null, 2));
    logMessage('Query:', JSON.stringify(req.query, null, 2)); 

    try {
        const {
            ConferenceSid,
            StatusCallbackEvent,
            FriendlyName,
            Timestamp,
            CallSid // The CallSid of the participant who joined/left
        } = req.body;
        
        const mainCallSidFromQuery = req.query.mainCallSid; 
        const job_idFromQuery = req.query.job_id; 
        const conferenceNameFromQuery = req.query.conferenceName; 
        const companyidFromQuery = req.query.companyid; 

        logMessage(`Conference Event: ${StatusCallbackEvent} for Conference: ${FriendlyName} (${ConferenceSid})`);

        const auth_tokens = await getTTokenForJob(job_idFromQuery); 
        if (!auth_tokens?.message?.twilio_account_sid || !auth_tokens?.message?.twilio_auth_token) {
            logMessage('Error: Twilio credentials not found for job_id:', job_idFromQuery);
            return res.status(500).send('Error: Twilio credentials missing');
        }
        const client = twilio(auth_tokens.message.twilio_account_sid, auth_tokens.message.twilio_auth_token);
        
        switch (StatusCallbackEvent) {
            case 'conference-start':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) started.`);
                logMessage(`conference-start ${FriendlyName} (${ConferenceSid}) started.`);
                
                break;

            case 'participant-join':
                console.log(`Participant ${CallSid} joined conference ${FriendlyName}.`);
                logMessage(`participant-join ${CallSid} joined conference ${FriendlyName}.`);

                try {
                  // Log conference start in your system
                  await log_Conference_status({
                      ...req.body,
                      mainCallSid: mainCallSidFromQuery 
                  });
                   

                } catch (error) {
                    console.error(`❌ Error fetching/saving participant ${CallSid} on join for conference ${ConferenceSid}:`, error.message);
                    logMessage(`Error fetching/saving participant ${CallSid} on join:`, error.message);
                }
                break;

            case 'participant-leave':
                console.log(`Participant ${CallSid} left conference ${FriendlyName}.`);
                logMessage(`participant-leave ${CallSid} left conference ${FriendlyName}.`);
                
                try {
                    
                    const conferenceDetails = await client.conferences(ConferenceSid).fetch();
                    if (conferenceDetails.status === 'completed') {
                        logMessage(`Conference ${FriendlyName} (${ConferenceSid}) is already completed due to participant-leave with endConferenceOnExit. 'conference-end' will handle final details.`);
                        return res.status(200).send('OK');
                    }
                    
                    logMessage(`Conference ${FriendlyName} (${ConferenceSid}) is still active. Checking participants...`);
                    const activeParticipants = await client.conferences(ConferenceSid).participants.list();
                    const currentParticipantsCount = activeParticipants.length;

                    console.log(`Conference ${FriendlyName} (${ConferenceSid}): Current active participants after leave: ${currentParticipantsCount}`);
                    logMessage(`Conference ${FriendlyName} (${ConferenceSid}): Current active participants after leave: ${currentParticipantsCount}`);

                    if (currentParticipantsCount === 1) {
                        logMessage(`Only 1 active participant left in conference ${FriendlyName}. Explicitly ending conference.`);
                        await client.conferences(ConferenceSid).update({ status: 'completed' });
                        console.log(`Conference ${FriendlyName} (${ConferenceSid}) successfully ended by explicit command.`);
                        logMessage(`Conference ${FriendlyName} (${ConferenceSid}) successfully ended by explicit command due to 1 participant remaining.`);
                    } else if (currentParticipantsCount === 0) {
                        logMessage(`0 active participants left in conference ${FriendlyName}. Conference should have ended or will end soon.`);
                        console.log(`0 active participants left in conference ${FriendlyName}. Conference should have ended or will end soon.`);
                    }

                } catch (error) {
                    if (error.status === 404) {
                        console.warn(`404 Conference ${ConferenceSid} or participant ${CallSid} not found (might have ended already or participant disconnected abruptly):`, error.message);
                        logMessage(`404 Conference ${ConferenceSid} or participant ${CallSid} not found:`, error.message);
                    } else {
                        console.error(`❌ Error in participant-leave processing for ${ConferenceSid} / ${CallSid}:`, error.message);
                        logMessage(`Error in participant-leave processing for ${ConferenceSid} / ${CallSid}:`, error.message);
                    }
                }
                break;

            case 'conference-end':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) ended.`);
                logMessage(`conference-end ${FriendlyName} (${ConferenceSid}) ended.`);

                // Log conference end in your system
                const confPartyResult = await get_conf_party({
                    ...req.body,
                    mainCallSid: mainCallSidFromQuery,
                    job_id: job_idFromQuery 
                });
                
                logMessage('get_conf_party result:', JSON.stringify(confPartyResult, null, 2));
                let overallConferenceDuration = 0;
                let endReason = "unknown";
                const participantDetails = [];
                
                
                
                try {
                    const conferenceDetails = await client.conferences(ConferenceSid).fetch();
                    logMessage(`Fetched conference details at conference-end for ${ConferenceSid}:`, JSON.stringify(conferenceDetails, null, 2));

                    if (conferenceDetails.dateCreated && conferenceDetails.dateUpdated) {
                        const createdDate = new Date(conferenceDetails.dateCreated);
                        const updatedDate = new Date(conferenceDetails.dateUpdated);
                        overallConferenceDuration = (updatedDate.getTime() - createdDate.getTime()) / 1000;
                    }
                    endReason = conferenceDetails.reasonConferenceEnded || "unknown"; 

                    logMessage(`Overall Conference Duration: ${overallConferenceDuration.toFixed(3)} seconds`);
                    console.log(`Overall Conference Duration: ${overallConferenceDuration.toFixed(3)} seconds`);
                    logMessage(`Conference End Reason: ${endReason}`);
                    console.log(`Conference End Reason: ${endReason}`);

                 
                  let callSidsFromPartyApi = [];
                    if (confPartyResult?.message?.success && confPartyResult.message.party && Array.isArray(confPartyResult.message.party)) {
                        callSidsFromPartyApi = confPartyResult.message.party.map(p => p.callsid).filter(Boolean); // Extract and filter out null/undefined
                        logMessage(`Received ${callSidsFromPartyApi.length} CallSIDs from get_conf_party API: ${JSON.stringify(callSidsFromPartyApi)}`);
                    } else {
                        logMessage(`No valid 'party' data received from get_conf_party API for conference ${ConferenceSid}. Result: ${JSON.stringify(confPartyResult)}`);
                    }

                    // Iterate through these CallSIDs and fetch their details from Twilio
                    let totalDurationP=0;
                    for (const callSid of callSidsFromPartyApi) { 
                        try {
                            const callLeg = await client.calls(callSid).fetch();
                            logMessage(`Fetched CallLeg details for CallSid ${callSid}:`, JSON.stringify(callLeg, null, 2));
                            totalDurationP += parseFloat(callLeg.duration) || 0;
                            participantDetails.push({                                
                                callSid: callLeg.sid,
                                from: callLeg.from,
                                to: callLeg.to,
                                status: callLeg.status,
                                duration: parseFloat(callLeg.duration) || 0,
                                startTime: callLeg.startTime,
                                endTime: callLeg.endTime
                            });
                            

                            // logMessage(`Participant Call ${callLeg.sid} (From: ${callLeg.from}, To: ${callLeg.to}) duration: ${callLeg.duration} seconds, Price: ${callLeg.price || 'N/A'} ${callLeg.priceUnit || ''}`);
                            // console.log(`Participant Call ${callLeg.sid} (From: ${callLeg.from}, To: ${callLeg.to}) duration: ${callLeg.duration} seconds, Price: ${callLeg.price || 'N/A'} ${callLeg.priceUnit || ''}`);
                        } catch (fetchCallError) {
                            console.warn(`⚠️ Could not fetch details for CallSid ${callSid} (might be completed/invalid): ${fetchCallError.message}`);
                            logMessage(`Warning: Could not fetch details for CallSid ${callSid}: ${fetchCallError.message}`);
                        }
                    }

                    const apiPayload = {
                        main_call_sid: mainCallSidFromQuery,
                        conference_sid: ConferenceSid,
                        conference_friendly_name: FriendlyName,
                        overall_duration: overallConferenceDuration,
                        totalDurationP: totalDurationP,
                        end_reason: endReason,
                        participants: participantDetails // Send all collected participant data
                    };
                    logMessage(`Sending conference end details to Backend log_Conference_end: ${JSON.stringify(apiPayload, null, 2)}`);
                    const logConfEnd = await log_Conference_end({
                        apiPayload
                    });
                    logMessage(`log_Conference_end API response: ${JSON.stringify(logConfEnd, null, 2)}`);


                } catch (fetchError) {
                    console.error(`❌ Error in conference-end processing for ${ConferenceSid}:`, fetchError.message);
                    logMessage(`Error in conference-end processing for ${ConferenceSid}:`, fetchError.message);
                }
                break;

            default:
                console.log('Unknown conference event:', StatusCallbackEvent);
                logMessage('Unknown conference event:', StatusCallbackEvent);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('❌ Error handling conference status webhook:', err.message);
        logMessage('Error handling conference status webhook:', err.message);
        res.status(500).send('Error');
    }
});

router.post('/conference-status_03Aug_1404', async (req, res) => {
    logMessage('Conference status webhook called:');
    logMessage('Body:', JSON.stringify(req.body, null, 2));
    logMessage('Query:', JSON.stringify(req.query, null, 2)); 

    try {
        const {
            ConferenceSid,
            StatusCallbackEvent,
            FriendlyName,
            Timestamp,
            CallSid // The CallSid of the participant who joined/left
        } = req.body;
        
        const mainCallSidFromQuery = req.query.mainCallSid; 
        const job_idFromQuery = req.query.job_id; 
        const conferenceNameFromQuery = req.query.conferenceName; 
        const companyidFromQuery = req.query.companyid; 

        logMessage(`Conference Event: ${StatusCallbackEvent} for Conference: ${FriendlyName} (${ConferenceSid})`);

        const auth_tokens = await getTTokenForJob(job_idFromQuery); 
        if (!auth_tokens?.message?.twilio_account_sid || !auth_tokens?.message?.twilio_auth_token) {
            logMessage('Error: Twilio credentials not found for job_id:', job_idFromQuery);
            return res.status(500).send('Error: Twilio credentials missing');
        }
        const client = twilio(auth_tokens.message.twilio_account_sid, auth_tokens.message.twilio_auth_token);
        
        switch (StatusCallbackEvent) {
            case 'conference-start':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) started.`);
                logMessage(`conference-start ${FriendlyName} (${ConferenceSid}) started.`);
                
                break;

            case 'participant-join':
                console.log(`Participant ${CallSid} joined conference ${FriendlyName}.`);
                logMessage(`participant-join ${CallSid} joined conference ${FriendlyName}.`);

                try {
                  // Log conference start in your system
                  await log_Conference_status({
                      ...req.body,
                      mainCallSid: mainCallSidFromQuery 
                  });
                  /*
                    // Fetch full participant details when they join
                    const participant = await client.conferences(ConferenceSid).participants(CallSid).fetch();
                    const callDetails = await client.calls(CallSid).fetch(); // Get Call details for from/to/direction

                    const participantData = {
                        callSid: participant.callSid,
                        conferenceSid: participant.conferenceSid,
                        dateJoined: participant.dateCreated, // This is when they joined the conference
                        dateLeft: null, // Will be updated on participant-leave or conference-end
                        duration: 0, // Will be updated
                        price: null, // Will be updated
                        from: callDetails.from,
                        to: callDetails.to,
                        direction: callDetails.direction,
                        // Add any other relevant fields you want to store
                        jobId: job_idFromQuery, // Link to your job_id
                        companyId: companyidFromQuery // Link to your company_id
                    };

                    // Save this initial participant data to your database
                    
                    logMessage(`Saving participant ${participant.callSid} to DB for conference ${ConferenceSid}.`, JSON.stringify(participantData, null, 2));
                    //await saveParticipantToDb(participantData); 
                    logMessage(`Saved participant ${participant.callSid} to DB for conference ${ConferenceSid}.`);
                    */

                } catch (error) {
                    console.error(`❌ Error fetching/saving participant ${CallSid} on join for conference ${ConferenceSid}:`, error.message);
                    logMessage(`Error fetching/saving participant ${CallSid} on join:`, error.message);
                }
                break;

            case 'participant-leave':
                console.log(`Participant ${CallSid} left conference ${FriendlyName}.`);
                logMessage(`participant-leave ${CallSid} left conference ${FriendlyName}.`);
                
                try {
                    // Fetch participant and call details for the leaving participant
                   // const participant = await client.conferences(ConferenceSid).participants(CallSid).fetch();
                    /*const callDetails = await client.calls(CallSid).fetch();

                    // Update the participant's record in your database
                    // Use the 'duration' and 'price' from the Call resource as they are billing-accurate.
                    const updateData = {
                        dateLeft: participant.dateUpdated, // When participant resource was updated (often leave time)
                        duration: parseFloat(callDetails.duration) || 0,
                        price: parseFloat(callDetails.price),
                        priceUnit: callDetails.priceUnit
                    };
                    await updateParticipantInDb(participant.callSid, participant.conferenceSid, updateData);
                    logMessage(`Updated participant ${participant.callSid} in DB for conference ${ConferenceSid}.`);
                    */
                    // Check if conference should end (your existing logic)
                    const conferenceDetails = await client.conferences(ConferenceSid).fetch();
                    if (conferenceDetails.status === 'completed') {
                        logMessage(`Conference ${FriendlyName} (${ConferenceSid}) is already completed due to participant-leave with endConferenceOnExit. 'conference-end' will handle final details.`);
                        return res.status(200).send('OK');
                    }
                    
                    logMessage(`Conference ${FriendlyName} (${ConferenceSid}) is still active. Checking participants...`);
                    const activeParticipants = await client.conferences(ConferenceSid).participants.list();
                    const currentParticipantsCount = activeParticipants.length;

                    console.log(`Conference ${FriendlyName} (${ConferenceSid}): Current active participants after leave: ${currentParticipantsCount}`);
                    logMessage(`Conference ${FriendlyName} (${ConferenceSid}): Current active participants after leave: ${currentParticipantsCount}`);

                    if (currentParticipantsCount === 1) {
                        logMessage(`Only 1 active participant left in conference ${FriendlyName}. Explicitly ending conference.`);
                        await client.conferences(ConferenceSid).update({ status: 'completed' });
                        console.log(`Conference ${FriendlyName} (${ConferenceSid}) successfully ended by explicit command.`);
                        logMessage(`Conference ${FriendlyName} (${ConferenceSid}) successfully ended by explicit command due to 1 participant remaining.`);
                    } else if (currentParticipantsCount === 0) {
                        logMessage(`0 active participants left in conference ${FriendlyName}. Conference should have ended or will end soon.`);
                        console.log(`0 active participants left in conference ${FriendlyName}. Conference should have ended or will end soon.`);
                    }

                } catch (error) {
                    if (error.status === 404) {
                        console.warn(`404 Conference ${ConferenceSid} or participant ${CallSid} not found (might have ended already or participant disconnected abruptly):`, error.message);
                        logMessage(`404 Conference ${ConferenceSid} or participant ${CallSid} not found:`, error.message);
                    } else {
                        console.error(`❌ Error in participant-leave processing for ${ConferenceSid} / ${CallSid}:`, error.message);
                        logMessage(`Error in participant-leave processing for ${ConferenceSid} / ${CallSid}:`, error.message);
                    }
                }
                break;

            case 'conference-end':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) ended.`);
                logMessage(`conference-end ${FriendlyName} (${ConferenceSid}) ended.`);

                // Log conference end in your system
                const result = await get_conf_party({
                    ...req.body,
                    mainCallSid: mainCallSidFromQuery 
                });
                
                let overallConferenceDuration = 0;
                let endReason = "unknown";
                
                
                try {
                    const conferenceDetails = await client.conferences(ConferenceSid).fetch();
                    logMessage(`Fetched conference details at conference-end for ${ConferenceSid}:`, JSON.stringify(conferenceDetails, null, 2));

                    if (conferenceDetails.dateCreated && conferenceDetails.dateUpdated) {
                        const createdDate = new Date(conferenceDetails.dateCreated);
                        const updatedDate = new Date(conferenceDetails.dateUpdated);
                        overallConferenceDuration = (updatedDate.getTime() - createdDate.getTime()) / 1000;
                    }
                    endReason = conferenceDetails.reasonConferenceEnded || "unknown"; 

                    logMessage(`Overall Conference Duration: ${overallConferenceDuration.toFixed(3)} seconds`);
                    console.log(`Overall Conference Duration: ${overallConferenceDuration.toFixed(3)} seconds`);
                    logMessage(`Conference End Reason: ${endReason}`);
                    console.log(`Conference End Reason: ${endReason}`);

                 
                    /*const finalParticipantDetails = await getParticipantsFromDb(ConferenceSid); 
                    
                    logMessage(`Final Participant Details from DB for ended conference ${FriendlyName}:`, JSON.stringify(finalParticipantDetails, null, 2));
                    
                  
                    for (const participant of finalParticipantDetails) {
                        if (!participant.dateLeft || participant.duration === 0) { // If not marked as left or duration is 0
                            try {
                                const callDetails = await client.calls(participant.callSid).fetch();
                                participant.dateLeft = callDetails.endTime || new Date().toISOString(); // Fallback to now
                                participant.duration = parseFloat(callDetails.duration) || 0;
                                participant.price = parseFloat(callDetails.price);
                                participant.priceUnit = callDetails.priceUnit;
                                await updateParticipantInDb(participant.callSid, participant.conferenceSid, {
                                    dateLeft: participant.dateLeft,
                                    duration: participant.duration,
                                    price: participant.price,
                                    priceUnit: participant.priceUnit
                                });
                                logMessage(`Updated missing duration/price for participant ${participant.callSid} at conference-end.`);
                            } catch (error) {
                                console.warn(`Could not fetch final call details for ${participant.callSid} at conference-end: ${error.message}`);
                            }
                        }
                        logMessage(`Final Participant Call ${participant.callSid} (From: ${participant.from}, To: ${participant.to}) duration: ${participant.duration} seconds, Price: ${participant.price || 'N/A'} ${participant.priceUnit || ''}`);
                        console.log(`Final Participant Call ${participant.callSid} (From: ${participant.from}, To: ${participant.to}) duration: ${participant.duration} seconds, Price: ${participant.price || 'N/A'} ${participant.priceUnit || ''}`);
                    } 


                    const apiPayload = {
                        main_call_sid: mainCallSidFromQuery,
                        conference_sid: ConferenceSid,
                        conference_friendly_name: FriendlyName,
                        overall_duration: overallConferenceDuration,
                        end_reason: endReason,
                        participants: finalParticipantDetails // Send data from your DB
                    };
                    
                    const logConfEnd = await log_Conference_end({
                        apiPayload
                    });
                    logMessage(`Sending conference end details to Backend: ${JSON.stringify(apiPayload, null, 2)}`);
                    */ 

                } catch (fetchError) {
                    console.error(`❌ Error in conference-end processing for ${ConferenceSid}:`, fetchError.message);
                    logMessage(`Error in conference-end processing for ${ConferenceSid}:`, fetchError.message);
                }
                break;

            default:
                console.log('Unknown conference event:', StatusCallbackEvent);
                logMessage('Unknown conference event:', StatusCallbackEvent);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('❌ Error handling conference status webhook:', err.message);
        logMessage('Error handling conference status webhook:', err.message);
        res.status(500).send('Error');
    }
});

router.post('/conference-status_03Aug_1302', async (req, res) => {
    
    logMessage('Conference status webhook called:');
    logMessage('Body:', JSON.stringify(req.body, null, 2));
    logMessage('Query:', JSON.stringify(req.query, null, 2)); 

    try {
        const {
            ConferenceSid,
            StatusCallbackEvent,
            FriendlyName,
            Timestamp,
            CallSid // The CallSid of the participant who joined/left
        } = req.body;
        
        // These come from the query parameters you attached to the statusCallback URL
        const mainCallSidFromQuery = req.query.mainCallSid; 
        const job_idFromQuery = req.query.job_id; 
        const conferenceNameFromQuery = req.query.conferenceName; 
        const companyidFromQuery = req.query.companyid; // Make sure this is passed from the originating TwiML generation

        logMessage(`Conference Event: ${StatusCallbackEvent} for Conference: ${FriendlyName} (${ConferenceSid})`);

        // Log the conference status (using your existing log_Conference_status)
        // const logResult = await log_Conference_status({
        //     ...req.body,
        //     mainCallSid: mainCallSidFromQuery 
        // });
        // logMessage('Logging conference Status', logResult);

        // Get Twilio credentials based on job_id
        const auth_tokens = await getTTokenForJob(job_idFromQuery); 
        if (!auth_tokens?.message?.twilio_account_sid || !auth_tokens?.message?.twilio_auth_token) {
            logMessage('Error: Twilio credentials not found for job_id:', job_idFromQuery);
            return res.status(500).send('Error: Twilio credentials missing');
        }
        const client = twilio(auth_tokens.message.twilio_account_sid, auth_tokens.message.twilio_auth_token);
        
        switch (StatusCallbackEvent) {
            case 'conference-start':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) started.`);
               
                logMessage(`conference-start ${FriendlyName} (${ConferenceSid}) started.`);
                const logResult = await log_Conference_status({
                  ...req.body,
                  mainCallSid: mainCallSidFromQuery 
                });
                break;
            case 'conference-end':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) ended.`);
                logMessage(`conference-end ${FriendlyName} (${ConferenceSid}) ended.`);

                const logResult1 = await log_Conference_status({
                    ...req.body,
                    mainCallSid: mainCallSidFromQuery 
                });
                
                let overallConferenceDuration = 0;
                let endReason = "unknown";
                const participantDetails = []; // Array to store details for each participant

                try {
                    const conferenceDetails = await client.conferences(ConferenceSid).fetch();
                    logMessage(`Fetched conference details at conference-end for ${ConferenceSid}:`, JSON.stringify(conferenceDetails, null, 2));

                    if (conferenceDetails.dateCreated && conferenceDetails.dateUpdated) {
                        const createdDate = new Date(conferenceDetails.dateCreated);
                        const updatedDate = new Date(conferenceDetails.dateUpdated);
                        overallConferenceDuration = (updatedDate.getTime() - createdDate.getTime()) / 1000;
                    }
                    endReason = conferenceDetails.reasonConferenceEnded || "unknown"; 

                    logMessage(`Overall Conference Duration: ${overallConferenceDuration.toFixed(3)} seconds`);
                    console.log(`Overall Conference Duration: ${overallConferenceDuration.toFixed(3)} seconds`);
                    logMessage(`Conference End Reason: ${endReason}`);
                    console.log(`Conference End Reason: ${endReason}`);

                    // ****** THE CORRECT WAY TO GET ALL HISTORICAL PARTICIPANTS ******
                    // Query the Call resources, filtering by the ConferenceSid.
                    const historicalCallLegs = await client.calls.list({
                        conferenceSid: ConferenceSid//,
                        // You might also want to filter by a time range if the conference could be very long,
                        // but conferenceSid filter is usually sufficient for all participants.
                        // startTimeAfter: conferenceDetails.dateCreated,
                        // endTimeBefore: conferenceDetails.dateUpdated,
                       // limit: 200 // Adjust limit as necessary for your expected number of participants
                    });
                      
                    logMessage(`Historical Call Legs for ended conference ${FriendlyName} (filtered by ConferenceSid):`, JSON.stringify(historicalCallLegs, null, 2));

                    // Iterate through these call legs to extract participant information
                    for (const callLeg of historicalCallLegs) { 
                        // Each 'callLeg' here represents a participant's connection to the conference.
                        // The `duration` and `price` fields are directly on the Call resource.
                        participantDetails.push({
                            callSid: callLeg.sid, // The Call SID for this participant
                            from: callLeg.from,
                            to: callLeg.to,
                            duration: parseFloat(callLeg.duration), // Duration of this specific call leg
                            price: parseFloat(callLeg.price),
                            priceUnit: callLeg.priceUnit,
                            direction: callLeg.direction 
                        });
                        logMessage(`Participant Call ${callLeg.sid} (From: ${callLeg.from}, To: ${callLeg.to}) duration: ${callLeg.duration} seconds, Price: ${callLeg.price || 'N/A'} ${callLeg.priceUnit || ''}`);
                        console.log(`Participant Call ${callLeg.sid} (From: ${callLeg.from}, To: ${callLeg.to}) duration: ${callLeg.duration} seconds, Price: ${callLeg.price || 'N/A'} ${callLeg.priceUnit || ''}`);
                    }

                    const apiPayload = {
                        main_call_sid: mainCallSidFromQuery,
                        conference_sid: ConferenceSid,
                        conference_friendly_name: FriendlyName,
                        overall_duration: overallConferenceDuration,
                        end_reason: endReason,
                        participants: participantDetails // Send all collected participant data
                    };
                    logMessage(`Preparing API payload for conference end: ${JSON.stringify(apiPayload, null, 2)}`);
                    const logConfEnd = await log_Conference_end({
                        apiPayload
                    });
                    logMessage(`Sending conference end details to Backend: ${JSON.stringify(apiPayload, null, 2)}`);

                } catch (fetchError) {
                    console.error(`❌ Error in conference-end processing for ${ConferenceSid}:`, fetchError.message);
                    logMessage(`Error in conference-end processing for ${ConferenceSid}:`, fetchError.message);
                }
                break;
            case 'participant-join':
                console.log(`Participant ${CallSid} joined conference ${FriendlyName}.`);
                logMessage(`participant-join ${CallSid} joined conference ${FriendlyName}.`);
                const Gotparticipants = await client.conferences(ConferenceSid).participants.list();
                logMessage(`Save it in DB and the get its record Fetched participants for participant-leave `, JSON.stringify(Gotparticipants, null, 2));
                break;
            case 'participant-leave':
                console.log(`Participant ${CallSid} left conference ${FriendlyName}.`);
                logMessage(`participant-leave ${CallSid} left conference ${FriendlyName}.`);
                
                try {
                    const conferenceDetails = await client.conferences(ConferenceSid).fetch();
                    logMessage(`Fetched conference details for participant-leave ${ConferenceSid}:`, JSON.stringify(conferenceDetails, null, 2));
                    // If conference is already completed (e.g., by endConferenceOnExit=true on agent leg),
                    // the 'conference-end' event will follow shortly and handle all final logging/API updates.
                    // So, we just acknowledge the webhook here.
                    if (conferenceDetails.status === 'completed') {
                        logMessage(`Conference === 'completed' ${FriendlyName} (${ConferenceSid}) is already completed due to participant-leave with endConferenceOnExit. Acknowledging webhook; 'conference-end' will handle final details.`);
                        return res.status(200).send('OK');
                    }
                    
                    logMessage(`Line 317 Conference ${FriendlyName} (${ConferenceSid}) is still active. Checking participants...`);
                    const participants = await client.conferences(ConferenceSid).participants.list();
                    logMessage(`Fetched participants for participant-leave `, JSON.stringify(participants, null, 2));
                    const currentParticipantsCount = participants.length;

                    console.log(`Conference ${FriendlyName} (${ConferenceSid}): Current active participants after leave: ${currentParticipantsCount}`);
                    logMessage(`Conference ${FriendlyName} (${ConferenceSid}): Current active participants after leave: ${currentParticipantsCount}`);

                    // If only one participant remains, end the conference
                    if (currentParticipantsCount === 1) {
                        logMessage(`Only 1 active participant left in conference ${FriendlyName}. Explicitly ending conference.`);
                        console.log(`Only 1 active participant left in conference ${FriendlyName}. Explicitly ending conference.`);
                        
                        await client.conferences(ConferenceSid).update({
                            status: 'completed'
                        });
                        console.log(`Conference ${FriendlyName} (${ConferenceSid}) successfully ended by explicit command.`);
                        logMessage(`Conference ${FriendlyName} (${ConferenceSid}) successfully ended by explicit command due to 1 participant remaining.`);
                        
                        // IMPORTANT: The `conference-end` webhook will fire AFTER this explicit completion.
                        // We rely on the `conference-end` event to send final data to Frappe,
                        // as it will have the most complete and final state.
                    } else if (currentParticipantsCount === 0) {
                        logMessage(`0 active participants left in conference ${FriendlyName}. Conference should have ended or will end soon.`);
                        console.log(`0 active participants left in conference ${FriendlyName}. Conference should have ended or will end soon.`);
                        // Similar to above, conference-end event will be triggered.
                    }

                } catch (fetchError) {
                    if (fetchError.status === 404) {
                        console.warn(`404 Conference ${ConferenceSid} not found (might have ended already):`, fetchError.message);
                        logMessage(`404 Conference ${ConferenceSid} not found (might have ended already):`, fetchError.message);
                    } else {
                        console.error(`❌ Error fetching conference participants for ${ConferenceSid}:`, fetchError.message);
                        logMessage(`fetchError Error fetching conference participants for ${ConferenceSid}:`, fetchError.message);
                    }
                }
                break;
            default:
                console.log('Unknown conference event:', StatusCallbackEvent);
                logMessage('Unknown conference event:', StatusCallbackEvent);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('❌ Error handling conference status webhook:', err.message);
        logMessage('Error handling conference status webhook:', err.message);
        res.status(500).send('Error');
    }
});

router.post('/conference-status_03Aug_1154', async (req, res) => {
    
    logMessage('Conference status webhook called:');
    logMessage('Body:', JSON.stringify(req.body, null, 2));
    logMessage('Query:', JSON.stringify(req.query, null, 2)); 

    try {
        const {
            ConferenceSid,
            StatusCallbackEvent,
            FriendlyName,
            Timestamp,
            CallSid // The CallSid of the participant who joined/left
        } = req.body;
        
        // These come from the query parameters you attached to the statusCallback URL
        const mainCallSidFromQuery = req.query.mainCallSid; 
        const job_idFromQuery = req.query.job_id; 
        const conferenceNameFromQuery = req.query.conferenceName; 
        const companyidFromQuery = req.query.companyid; // Make sure this is passed from the originating TwiML generation

        logMessage(`Conference Event: ${StatusCallbackEvent} for Conference: ${FriendlyName} (${ConferenceSid})`);

        // Log the conference status (using your existing log_Conference_status)
        // const logResult = await log_Conference_status({
        //     ...req.body,
        //     mainCallSid: mainCallSidFromQuery 
        // });
        // logMessage('Logging conference Status', logResult);

        // Get Twilio credentials based on job_id
        const auth_tokens = await getTTokenForJob(job_idFromQuery); 
        if (!auth_tokens?.message?.twilio_account_sid || !auth_tokens?.message?.twilio_auth_token) {
            logMessage('Error: Twilio credentials not found for job_id:', job_idFromQuery);
            return res.status(500).send('Error: Twilio credentials missing');
        }
        const client = twilio(auth_tokens.message.twilio_account_sid, auth_tokens.message.twilio_auth_token);
        
        switch (StatusCallbackEvent) {
            case 'conference-start':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) started.`);
               
                logMessage(`conference-start ${FriendlyName} (${ConferenceSid}) started.`);
                const logResult = await log_Conference_status({
                  ...req.body,
                  mainCallSid: mainCallSidFromQuery 
                });
                break;
            case 'conference-end':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) ended.`);
                logMessage(`conference-end ${FriendlyName} (${ConferenceSid}) ended.`);

                 logMessage(`conference-start ${FriendlyName} (${ConferenceSid}) started.`);
                const logResult1 = await log_Conference_status({
                  ...req.body,
                  mainCallSid: mainCallSidFromQuery 
                });
                
                let overallConferenceDuration = 0;
                let endReason = "unknown";
                const participantDetails = []; // Array to store details for each participant

                try {
                    const conferenceDetails = await client.conferences(ConferenceSid).fetch();
                    logMessage(`Fetched conference details at conference-end for ${ConferenceSid}:`, JSON.stringify(conferenceDetails, null, 2));

                    if (conferenceDetails.dateCreated && conferenceDetails.dateUpdated) {
                        const createdDate = new Date(conferenceDetails.dateCreated);
                        const updatedDate = new Date(conferenceDetails.dateUpdated);
                        overallConferenceDuration = (updatedDate.getTime() - createdDate.getTime()) / 1000;
                    }
                    endReason = conferenceDetails.reasonConferenceEnded || "unknown"; // Get the end reason

                    logMessage(`Overall Conference Duration: ${overallConferenceDuration.toFixed(3)} seconds`);
                    console.log(`Overall Conference Duration: ${overallConferenceDuration.toFixed(3)} seconds`);
                    logMessage(`Conference End Reason: ${endReason}`);
                    console.log(`Conference End Reason: ${endReason}`);

                    const participants = await client.conferences(ConferenceSid).participants.list();
                    logMessage(`Participants for ended conference ${FriendlyName}:`, JSON.stringify(participants, null, 2));

                    // Iterate through participants to get individual call details and cost
                    for (const p of participants) { // Use for...of for async/await in loop
                        let participantPrice = null;
                        let participantPriceUnit = null;

                        try {
                            const callDetails = await client.calls(p.callSid).fetch();
                            participantPrice = callDetails.price;
                            participantPriceUnit = callDetails.priceUnit;
                            logMessage(`Fetched Call details for participant ${p.callSid}. Price: ${participantPrice} ${participantPriceUnit}`);
                        } catch (callFetchError) {
                            console.warn(`Could not fetch call details for participant ${p.callSid}:`, callFetchError.message);
                            logMessage(`Warning: Could not fetch call details for participant ${p.callSid}:`, callFetchError.message);
                            // It's common for call price to not be immediately available right at conference-end
                            // especially for inbound legs or if billing data takes a moment to propagate.
                            // Continue without price if not found.
                        }

                        participantDetails.push({
                            callSid: p.callSid,
                            from: p.from,
                            to: p.to,
                            duration: p.duration, // This is participant's duration in conference
                            price: participantPrice,
                            priceUnit: participantPriceUnit,
                            direction: p.direction // 'inbound' or 'outbound'
                        });
                        logMessage(`Participant ${p.callSid} (From: ${p.from}, To: ${p.to}) duration: ${p.duration} seconds, Price: ${participantPrice || 'N/A'} ${participantPriceUnit || ''}`);
                        console.log(`Participant ${p.callSid} (From: ${p.from}, To: ${p.to}) duration: ${p.duration} seconds, Price: ${participantPrice || 'N/A'} ${participantPriceUnit || ''}`);
                    }

                    // --- Make API call to Frappe to update record ---
                    // Replace 'your_app' and 'your_module' with your actual Frappe app and module names
                    //const frappeApiUrl = `${TOOLS_BASE_URL}/api/method/your_app.your_module.update_conference_end_details`;
                    const apiPayload = {
                        main_call_sid: mainCallSidFromQuery,
                        conference_sid: ConferenceSid,
                        conference_friendly_name: FriendlyName,
                        overall_duration: overallConferenceDuration,
                        end_reason: endReason,
                        participants: participantDetails // Send all collected participant data
                    };
                     const logConfEnd = await log_Conference_end({
                       apiPayload
                    });
                    logMessage(`Sending conference end details to Backend: ${JSON.stringify(apiPayload, null, 2)}`);

                 /*   logMessage(`Sending conference end details to Frappe: ${JSON.stringify(apiPayload, null, 2)}`);

                    const response = await fetch(frappeApiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            // IMPORTANT: Add any necessary authentication headers for your Frappe API here
                            // e.g., 'Authorization': 'token <api_key>:<api_secret>'
                            // Or handle authentication via server-side session if applicable
                        },
                        body: JSON.stringify(apiPayload)
                    });

                    const responseData = await response.json();
                    if (response.ok) {
                        logMessage('Frappe API call successful:', responseData);
                        console.log('Frappe API call successful:', responseData);
                    } else {
                        console.error('Frappe API call failed:', response.status, responseData);
                        logMessage('Frappe API call failed:', response.status, responseData);
                    }*/

                } catch (fetchError) {
                    console.error(`❌ Error in conference-end processing for ${ConferenceSid}:`, fetchError.message);
                    logMessage(`Error in conference-end processing for ${ConferenceSid}:`, fetchError.message);
                }
                break;
            case 'participant-join':
                console.log(`Participant ${CallSid} joined conference ${FriendlyName}.`);
                logMessage(`participant-join ${CallSid} joined conference ${FriendlyName}.`);
                break;
            case 'participant-leave':
                console.log(`Participant ${CallSid} left conference ${FriendlyName}.`);
                logMessage(`participant-leave ${CallSid} left conference ${FriendlyName}.`);
                
                try {
                    const conferenceDetails = await client.conferences(ConferenceSid).fetch();
                    // If conference is already completed (e.g., by endConferenceOnExit=true on agent leg),
                    // the 'conference-end' event will follow shortly and handle all final logging/API updates.
                    // So, we just acknowledge the webhook here.
                    if (conferenceDetails.status === 'completed') {
                        logMessage(`Conference === 'completed' ${FriendlyName} (${ConferenceSid}) is already completed due to participant-leave with endConferenceOnExit. Acknowledging webhook; 'conference-end' will handle final details.`);
                        return res.status(200).send('OK');
                    }
                    
                    logMessage(`Line 317 Conference ${FriendlyName} (${ConferenceSid}) is still active. Checking participants...`);
                    const participants = await client.conferences(ConferenceSid).participants.list();
                    logMessage(`Fetched participants for participant-leave `, JSON.stringify(participants, null, 2));
                    const currentParticipantsCount = participants.length;

                    console.log(`Conference ${FriendlyName} (${ConferenceSid}): Current active participants after leave: ${currentParticipantsCount}`);
                    logMessage(`Conference ${FriendlyName} (${ConferenceSid}): Current active participants after leave: ${currentParticipantsCount}`);

                    // If only one participant remains, end the conference
                    if (currentParticipantsCount === 1) {
                        logMessage(`Only 1 active participant left in conference ${FriendlyName}. Explicitly ending conference.`);
                        console.log(`Only 1 active participant left in conference ${FriendlyName}. Explicitly ending conference.`);
                        
                        await client.conferences(ConferenceSid).update({
                            status: 'completed'
                        });
                        console.log(`Conference ${FriendlyName} (${ConferenceSid}) successfully ended by explicit command.`);
                        logMessage(`Conference ${FriendlyName} (${ConferenceSid}) successfully ended by explicit command due to 1 participant remaining.`);
                        
                        // IMPORTANT: The `conference-end` webhook will fire AFTER this explicit completion.
                        // We rely on the `conference-end` event to send final data to Frappe,
                        // as it will have the most complete and final state.
                    } else if (currentParticipantsCount === 0) {
                        logMessage(`0 active participants left in conference ${FriendlyName}. Conference should have ended or will end soon.`);
                        console.log(`0 active participants left in conference ${FriendlyName}. Conference should have ended or will end soon.`);
                        // Similar to above, conference-end event will be triggered.
                    }

                } catch (fetchError) {
                    if (fetchError.status === 404) {
                        console.warn(`404 Conference ${ConferenceSid} not found (might have ended already):`, fetchError.message);
                        logMessage(`404 Conference ${ConferenceSid} not found (might have ended already):`, fetchError.message);
                    } else {
                        console.error(`❌ Error fetching conference participants for ${ConferenceSid}:`, fetchError.message);
                        logMessage(`fetchError Error fetching conference participants for ${ConferenceSid}:`, fetchError.message);
                    }
                }
                break;
            default:
                console.log('Unknown conference event:', StatusCallbackEvent);
                logMessage('Unknown conference event:', StatusCallbackEvent);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('❌ Error handling conference status webhook:', err.message);
        logMessage('Error handling conference status webhook:', err.message);
        res.status(500).send('Error');
    }
});

router.post('/conference-status_03Aug_1021', async (req, res) => {
    
    logMessage('Conference status webhook called:');
    logMessage('Body:', JSON.stringify(req.body, null, 2));
    logMessage('Query:', JSON.stringify(req.query, null, 2)); // Add this back for full context

    try {
        const {
            ConferenceSid,
            StatusCallbackEvent,
            FriendlyName,
            Timestamp,
            CallSid // The CallSid of the participant who joined/left
        } = req.body;
        
        // These come from the query parameters you attached to the statusCallback URL
        const mainCallSidFromQuery = req.query.mainCallSid; 
        const job_idFromQuery = req.query.job_id; 
        const conferenceNameFromQuery = req.query.conferenceName; 

        logMessage(`Conference Event: ${StatusCallbackEvent} for Conference: ${FriendlyName} (${ConferenceSid})`);

        // Log the conference status (using your existing log_Conference_status)
        const logResult = await log_Conference_status({
            ...req.body,
            mainCallSid: mainCallSidFromQuery // Use the one from query for logging if more accurate
        });
        logMessage('Logging conference Status', logResult);

        // Get Twilio credentials based on job_id
        const auth_tokens = await getTTokenForJob(job_idFromQuery); // Make sure this function returns { message: { twilio_account_sid, twilio_auth_token } }
        if (!auth_tokens?.message?.twilio_account_sid || !auth_tokens?.message?.twilio_auth_token) {
            logMessage('Error: Twilio credentials not found for job_id:', job_idFromQuery);
            return res.status(500).send('Error: Twilio credentials missing');
        }
        const client = twilio(auth_tokens.message.twilio_account_sid, auth_tokens.message.twilio_auth_token);
        
        switch (StatusCallbackEvent) {
            case 'conference-start':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) started.`);
                logMessage(`conference-start ${FriendlyName} (${ConferenceSid}) started.`);
                break;
            case 'conference-end':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) ended.`);
                logMessage(`conference-end ${FriendlyName} (${ConferenceSid}) ended.`);
                // When the conference ends, it's a good time to retrieve all final details
                // including overall duration and participant durations.
                try {
                    const conferenceDetails = await client.conferences(ConferenceSid).fetch();
                    logMessage(`Fetched conference details at conference-end for ${ConferenceSid}:`, JSON.stringify(conferenceDetails, null, 2));

                    let conferenceDuration = 0;
                    if (conferenceDetails.dateCreated && conferenceDetails.dateUpdated) {
                        const createdDate = new Date(conferenceDetails.dateCreated);
                        const updatedDate = new Date(conferenceDetails.dateUpdated);
                        conferenceDuration = (updatedDate.getTime() - createdDate.getTime()) / 1000;
                    }
                    logMessage(`Overall Conference Duration: ${conferenceDuration.toFixed(3)} seconds`);
                    console.log(`Overall Conference Duration: ${conferenceDuration.toFixed(3)} seconds`);

                    // Fetch and log participant durations for the ended conference
                    const participants = await client.conferences(ConferenceSid).participants.list();
                    logMessage(`participants : `, JSON.stringify(participants, null, 2));
                    logMessage(`Participants for ended conference ${FriendlyName}:`, JSON.stringify(participants, null, 2));

                    participants.forEach(p => {
                        logMessage(`Participant ${p.callSid} (From: ${p.from}, To: ${p.to}) duration: ${p.duration} seconds`);
                        console.log(`Participant ${p.callSid} (From: ${p.from}, To: ${p.to}) duration: ${p.duration} seconds`);
                    });

                } catch (fetchError) {
                    console.error(`❌ Error fetching details for ended conference ${ConferenceSid}:`, fetchError.message);
                    logMessage(`Error fetching details for ended conference ${ConferenceSid}:`, fetchError.message);
                }
                break;
            case 'participant-join':
                console.log(`Participant ${CallSid} joined conference ${FriendlyName}.`);
                logMessage(`participant-join ${CallSid} joined conference ${FriendlyName}.`);
                break;
            case 'participant-leave':
                console.log(`Participant ${CallSid} left conference ${FriendlyName}.`);
                logMessage(`participant-leave ${CallSid} left conference ${FriendlyName}.`);
                
                try {
                    const conferenceDetails = await client.conferences(ConferenceSid).fetch();
                    logMessage(`Line 309 Fetched conference details for ${ConferenceSid}:`, JSON.stringify(conferenceDetails, null, 2));
                    logMessage(`Line 317 Conference ${FriendlyName} (${ConferenceSid}) is still active. Checking participants...`);
                    
                    // Fetch actual list of participants (only if conference is NOT completed yet)
                    const participants = await client.conferences(ConferenceSid).participants.list();
                    logMessage(`Fetched participants`, JSON.stringify(participants, null, 2));
                    const currentParticipantsCount = participants.length;

                    console.log(`Conference ${FriendlyName} (${ConferenceSid}): Current active participants after leave: ${currentParticipantsCount}`);
                    logMessage(`Conference ${FriendlyName} (${ConferenceSid}): Current active participants after leave: ${currentParticipantsCount}`);

                    // If only one participant remains, end the conference
                    if (currentParticipantsCount === 1) {
                        logMessage(`Only 1 active participant left in conference ${FriendlyName}. Explicitly ending conference.`);
                        console.log(`Only 1 active participant left in conference ${FriendlyName}. Explicitly ending conference.`);
                        
                        await client.conferences(ConferenceSid).update({
                            status: 'completed'
                        });
                        logMessage(`Conference statuse change to complete as only one participant`);
                        
                      

                    } else if (currentParticipantsCount === 0) {
                        logMessage(`Conference statuse currentParticipantsCount === 0 `);
                        // logMessage(`0 active participants left in conference ${FriendlyName}. Conference should have ended or will end soon.`);
                        // console.log(`0 active participants left in conference ${FriendlyName}. Conference should have ended or will end soon.`);
                    }

                } catch (fetchError) {
                    if (fetchError.status === 404) {
                        console.warn(`404 Conference ${ConferenceSid} not found (might have ended already):`, fetchError.message);
                        logMessage(`404 Conference ${ConferenceSid} not found (might have ended already):`, fetchError.message);
                    } else {
                        console.error(`❌ Error fetching conference participants for ${ConferenceSid}:`, fetchError.message);
                        logMessage(`fetchError Error fetching conference participants for ${ConferenceSid}:`, fetchError.message);
                    }
                }
                break;
            default:
                console.log('Unknown conference event:', StatusCallbackEvent);
                logMessage('Unknown conference event:', StatusCallbackEvent);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('❌ Error handling conference status webhook:', err.message);
        logMessage('Error handling conference status webhook:', err.message);
        res.status(500).send('Error');
    }
});


// --- Existing /transfer-status Route (No Changes Needed for Conference Logic) ---
router.post('/transfer-status', async (req, res) => {
    try {
       console.log('*******/transfer-status*************');
    
       logMessage('*Received /transferCall request: post', JSON.stringify(req.body, null, 2));
       
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
    
        const twiml = new twilio.twiml.VoiceResponse();
    
        if (!CallSid) {
          console.warn('Missing CallSid in transfer status webhook. Cannot process.');
          logMessage('Missing CallSid in transfer status webhook. Cannot process.');
          return res.status(200).send(twiml.toString());
        }
        
        const result = await log_TransferCall_status({
          ...req.body,
          mainCallSid
        });
        logMessage('Logging call Status', result);
        console.log('Logging call Status',result);
    
        res.status(200).send(twiml.toString());
      } catch (error) {
        console.error('❌ Error in /twilio/transfer-status webhook:', error.message);
        logMessage('Error in /twilio/transfer-status webhook:', error.message);
      }
});


// --- Existing /recording-status Route (No Changes, already handles queries) ---
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
    
      const {  job_id, mainCallSid, conferenceName } = req.query; // These will now be passed from the TwiML recordingStatusCallbackURL
    
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
      
      if (RecordingUrl && RecordingStatus === 'completed') {

        //Download and save in erpnext like form ultravox we do
        // Construct direct .mp3 download URL
        const mp3Url = `${RecordingUrl}.mp3`;
        
        console.log(`📼 Recording Available: ${mp3Url}`);
        console.log(`📊 Duration: ${RecordingDuration} seconds`);
        console.log(`🔊 Channels: ${RecordingChannels}`);
        
        const recordingDetails = {
          callSid: CallSid,
          conferenceSid: ConferenceSid,
          recordingSid: RecordingSid,
          recordingUrl: mp3Url,
          status: RecordingStatus,
          duration: RecordingDuration,
          channels: RecordingChannels,
          timestamp: Timestamp,          
          jobId: job_id,
          mainCallSid: mainCallSid, // Now available from query
          conferenceName: conferenceName, // Now available from query
          recordingType: isConferenceRecording ? 'conference' : 'call'
        };
    
        console.log('Recording details to save:', recordingDetails);
        logMessage('Recording details to save:', JSON.stringify(recordingDetails, null, 2));
        
        // You can call your database save function here, e.g.:
        // await saveRecordingToDatabase(recordingDetails);
      }
      else{

        logMessage('Recording URL or status is not completed. Recording not saved.'); 
      }
    
      res.status(200).send('Recording status received');
    } catch (error) {
      console.error('❌ Error in recording-status webhook:', error);
      logMessage('Error in recording-status webhook:', error.message);
      res.status(500).send('Internal Server Error');
    }
});

// --- Existing /transferCall Route (No Changes) ---
router.post('/transferCall', async (req, res) => {

    console.log('/transferCall Transfer call request received:', req.body);  
    logMessage('Received /transferCall request:', JSON.stringify(req.body, null, 2));
    console.log('********************');
    console.log('********************');
    console.log(req.body);
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
      logMessage("/hangUpCall Invalid or missing callId");  
      console.log("/hangUpCall Invalid or missing callId");
      //return res.status(400).json({ success: false, error: 'Invalid or missing callId' });
    }
    console.log(' /hangUpCall callId : ',callId);
    const callDetails = activeCalls.get(callId);

    if (!callDetails || !callDetails.twilioCallSid) {
      console.log("/hangUpCall Call not found or invalid Twilio SID");
      logMessage("/hangUpCall Call not found or invalid Twilio SID");
      return res.status(404).json({ success: false, error: 'Call not found or invalid Twilio SID' });
    }
    console.log(' /hangUpCall callDetails.twilioCallSid : ',callDetails.twilioCallSid);

    const teleCRED =await fetchTelecomNumberByPhone(fromNumber);
    //logMessage('/hangUpCall teleCRED : ' , teleCRED);
    //console.log('teleCRED : ' , teleCRED);

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
    logMessage('/hangUpCall Error hanging up call:', error.message || error);
    console.log('❌ /hangUpCall Error hanging up call:', error.message || error);
    return res.status(500).json({ success: false, error: 'Internal Server Error. Failed to hang up call.' });
  }
});


 
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
 
router.post('/conference-status_03Aug_0932', async (req, res) => {
    
    logMessage('Conference status webhook called:');
    logMessage('Body:', JSON.stringify(req.body, null, 2));
    logMessage('Query:', JSON.stringify(req.query, null, 2)); // Add this back for full context

    try {
        const {
            ConferenceSid,
            StatusCallbackEvent,
            FriendlyName,
            Timestamp,
            CallSid // The CallSid of the participant who joined/left
        } = req.body;
        
        // These come from the query parameters you attached to the statusCallback URL
        const mainCallSidFromQuery = req.query.mainCallSid; 
        const job_idFromQuery = req.query.job_id; 
        const conferenceNameFromQuery = req.query.conferenceName; 

        logMessage(`Conference Event: ${StatusCallbackEvent} for Conference: ${FriendlyName} (${ConferenceSid})`);

        // Log the conference status (using your existing log_Conference_status)
        const logResult = await log_Conference_status({
            ...req.body,
            mainCallSid: mainCallSidFromQuery // Use the one from query for logging if more accurate
        });
        logMessage('Logging conference Status', logResult);

        // Get Twilio credentials based on job_id
        const auth_tokens = await getTTokenForJob(job_idFromQuery); // Make sure this function returns { message: { twilio_account_sid, twilio_auth_token } }
        if (!auth_tokens?.message?.twilio_account_sid || !auth_tokens?.message?.twilio_auth_token) {
            logMessage('Error: Twilio credentials not found for job_id:', job_idFromQuery);
            return res.status(500).send('Error: Twilio credentials missing');
        }
        const client = twilio(auth_tokens.message.twilio_account_sid, auth_tokens.message.twilio_auth_token);
        
        switch (StatusCallbackEvent) {
            case 'conference-start':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) started.`);
                logMessage(`conference-start ${FriendlyName} (${ConferenceSid}) started.`);
                break;
            case 'conference-end':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) ended.`);
                logMessage(`conference-end ${FriendlyName} (${ConferenceSid}) ended.`);
                break;
            case 'participant-join':
                console.log(`Participant ${CallSid} joined conference ${FriendlyName}.`);
                logMessage(`participant-join ${CallSid} joined conference ${FriendlyName}.`);
                break;
            case 'participant-leave':
                console.log(`Participant ${CallSid} left conference ${FriendlyName}.`);
                logMessage(`participant-leave ${CallSid} left conference ${FriendlyName}.`);
                
                try {
                    // Fetch conference details to check its current status
                    const conferenceDetails = await client.conferences(ConferenceSid).fetch();
                    logMessage(`Line 309 Fetched conference details for ${ConferenceSid}:`, JSON.stringify(conferenceDetails, null, 2));

                    // If the conference is already completed by endConferenceOnExit, we don't need to do anything.
                    // This handles the case where the agent's 'endConferenceOnExit=true' already terminated it.
                    if (conferenceDetails.status === 'completed') {

                     // Calculate duration from dateCreated and dateUpdated
                    let conferenceDuration = 0;
                    if (conferenceDetails.dateCreated && conferenceDetails.dateUpdated) {
                        const createdDate = new Date(conferenceDetails.dateCreated);
                        const updatedDate = new Date(conferenceDetails.dateUpdated);
                        // Duration in seconds
                        conferenceDuration = (updatedDate.getTime() - createdDate.getTime()) / 1000;
                    }
                      logMessage(`Conference Duration: ${conferenceDuration.toFixed(3)} seconds`); // Format to 3 decimal places
                      
                      logMessage(`Conference completed ${FriendlyName} (${ConferenceSid}) is already completed. No action needed.`);
                      return res.status(200).send('OK');
                    }
                    logMessage(`Line 317 Conference ${FriendlyName} (${ConferenceSid}) is still active. Checking participants...`);
                    // Fetch actual list of participants
                    const participants = await client.conferences(ConferenceSid).participants.list();
                    const currentParticipantsCount = participants.length;

                    console.log(`Conference ${FriendlyName} (${ConferenceSid}): Current active participants after leave: ${currentParticipantsCount}`);
                    logMessage(`Conference ${FriendlyName} (${ConferenceSid}): Current active participants after leave: ${currentParticipantsCount}`);

                    // If only one participant remains, end the conference
                    if (currentParticipantsCount === 1) {
                        logMessage(`Only 1 active participant left in conference ${FriendlyName}. Explicitly ending conference.`);
                        console.log(`Only 1 active participant left in conference ${FriendlyName}. Explicitly ending conference.`);
                        
                        await client.conferences(ConferenceSid).update({
                            status: 'completed'
                        });
                        console.log(`Conference ${FriendlyName} (${ConferenceSid}) successfully ended by explicit command.`);
                        logMessage(`Conference ${FriendlyName} (${ConferenceSid}) successfully ended by explicit command due to 1 participant remaining.`);
                    } else if (currentParticipantsCount === 0) {
                        logMessage(`0 active participants left in conference ${FriendlyName}. Conference should have ended or will end soon.`);
                        console.log(`0 active participants left in conference ${FriendlyName}. Conference should have ended or will end soon.`);
                    }

                } catch (fetchError) {
                    // Log specific error for Twilio API call failures
                    if (fetchError.status === 404) {
                        console.warn(`404 Conference ${ConferenceSid} not found (might have ended already):`, fetchError.message);
                        logMessage(`404 Conference ${ConferenceSid} not found (might have ended already):`, fetchError.message);
                    } else {
                        console.error(`❌ Error fetching conference participants for ${ConferenceSid}:`, fetchError.message);
                        logMessage(`fetchError Error fetching conference participants for ${ConferenceSid}:`, fetchError.message);
                    }
                }
                break;
            default:
                console.log('Unknown conference event:', StatusCallbackEvent);
                logMessage('Unknown conference event:', StatusCallbackEvent);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('❌ Error handling conference status webhook:', err.message);
        logMessage('Error handling conference status webhook:', err.message);
        res.status(500).send('Error');
    }
});
router.post('/conference-status_02July_1729', async (req, res) => {
   
    logMessage('Conference status webhook called:');

    logMessage('Body:', JSON.stringify(req.body, null, 2));

    try {
        const {
            ConferenceSid,
            StatusCallbackEvent,
            FriendlyName,
            Timestamp,
            CallSid // The CallSid of the participant who joined/left
        } = req.body;
        
        
        const mainCallSid = req.query.mainCallSid; // The main customer's CallSid from query param

        const job_idFromQuery = req.query.job_id; // The main customer's CallSid from query param
        const conferenceNameFromQuery = req.query.conferenceName; // Conference name from query param

        
        logMessage(`Conference Event: ${StatusCallbackEvent} for Conference: ${FriendlyName} (${ConferenceSid})`);

        // REPLACE with your function to get auth token
        const result = await log_Conference_status({
          ...req.body,
          mainCallSid
        });
        logMessage('Logging call Status', result);
        const auth_token_from_db = await getTTokenForJob(job_idFromQuery);         
        const client = twilio(auth_token_from_db?.message?.twilio_account_sid, auth_token_from_db?.message?.twilio_auth_token);
        //logMessage(`cleint`, JSON.stringify(client, null, 2));

        switch (StatusCallbackEvent) {
            case 'conference-start':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) started.`);
                logMessage(`conference-start ${FriendlyName} (${ConferenceSid}) started.`);
                break;
            case 'conference-end':
                console.log(`Conference ${FriendlyName} (${ConferenceSid}) ended.`);
                logMessage(`conference-end ${FriendlyName} (${ConferenceSid}) ended.`);
                break;
            case 'participant-join':
                console.log(`Participant ${CallSid} joined conference ${FriendlyName}.`);
                logMessage(`participant-join ${CallSid} joined conference ${FriendlyName}.`);
                break;
            case 'participant-leave':
                console.log(`Participant ${CallSid} left conference ${FriendlyName}.`);
                logMessage(`participant-leave ${CallSid} left conference ${FriendlyName}.`);
                
                try {
                    logMessage(`Fetching conference participants for ***** ${ConferenceSid}...`);
                    const conference = await client.conferences(ConferenceSid).fetch();
                    logMessage(`Fetched conference details for ${ConferenceSid}:`, JSON.stringify(conference, null, 2));
                    const currentParticipants = parseInt(conference.participants);
                    console.log(`Conference ${FriendlyName} (${ConferenceSid}): Current participants after leave: ${currentParticipants}`);

                    if (currentParticipants === 1) {
                        logMessage(`Only 1 participant left in conference ${FriendlyName}. Ending conference.`);
                        console.log(`Only 1 participant left in conference ${FriendlyName}. Ending conference.`);
                        await client.conferences(ConferenceSid).update({
                            status: 'completed'
                        });
                        console.log(`Conference ${FriendlyName} (${ConferenceSid}) successfully ended.`);
                        logMessage(`Conference ${FriendlyName} (${ConferenceSid}) successfully ended due to 1 participant remaining.`);
                    } else if (currentParticipants === 0) {
                        logMessage(`0 participants left in conference ${FriendlyName}. Conference should have ended or will end.`);
                        console.log(`0 participants left in conference ${FriendlyName}. Conference should have ended or will end.`);
                    }

                } catch (fetchError) {
                    console.error(`❌ Error fetching conference participants for ${ConferenceSid}:`, fetchError.message);
                    logMessage(`Error fetching conference participants for ${ConferenceSid}:`, fetchError.message);
                }
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
export { router};

// 📋 Available record values:
// Option	Description
// 'do-not-record'	❌ Default. The call is not recorded.
// 'record-from-start'	✅ Recording begins as soon as the first participant joins the conference.
// 'record-from-answer'	✅ Recording begins after the first participant answers.
// 'record-from-ringing'	✅ Recording begins as soon as the call starts ringing. Useful for full call capture including ring tone.
// 'record-from-connect'	✅ Starts recording once both participants are connected in the conference. Best if you only want conversation audio.
// 'true' (deprecated)	Same as 'record-from-start'. Not recommended—use a specific value instead.


