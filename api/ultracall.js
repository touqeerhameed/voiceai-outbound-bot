 import axios from 'axios';
import dotenv from 'dotenv';
import twilio from 'twilio';
import https from 'https';
import { logMessage } from '../utils/logger.js';
import {
  DELAY_BETWEEN_OUTBOUND_CALL,ERP_API_BASE_URL ,CREATE_LOG_CALL_REQUEST_LOGGER,E_ADMIN_API_KEY
   ,E_ADMIN_API_SECRET,ULTRAVOX_API_URL,ULTRAVOX_OUTBOUND_API_URL,TOOLS_BASE_URL,
} from '../config/config.js';
import { getCallSessionDocname,log_incoming_call_request,uploadRecordingViaCustomAPI,GET_teleCreden,update_jobStatus,getuv } from './erpcall.js';

import { buildUltravoxCallConfig} from '../utils/ultravox-utils.js';
import {formattedTime} from '../utils/util.js';
import activeCalls from '../utils/activeCallsStore.js'; // adjust path accordingly
dotenv.config();

export async function getCallTranscript_Ultra(callId,UVdate) {
  let allMessages = [];
    logMessage('getCallTranscript_Ultra called with callId:', callId);
    //console.log('getCallTranscript_Ultra called with callId:', callId);
  try {
    if (!callId) {
      logMessage('Missing callId in getCallTranscript_Ultra');
      //console.log('Missing callId in getCallTranscript_Ultra');
      return null;
    }

    const url = `${ULTRAVOX_API_URL}/calls/${callId}/messages`;
    logMessage('Fetching messages from URL:', url);
    //console.log('Fetching messages from URL:', url);

    const response = await fetch(url, {
      headers: {
        // 'X-API-Key': ULTRAVOX_API_KEY,
        'X-API-Key': UVdate,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      await log_incoming_call_request('Ultravox API responded with status getCallTranscript_Ultra():',  response.message, response.status);
      logMessage(`Ultravox API responded with status ${response.status}`);   
      //console.error(`Ultravox API responded with status ${response.status}`);
      return null;
    }

    const data = await response.json();
    logMessage('Fetched call data from Ultravox:', data);      
    //console.log('Fetched call data from Ultravox:', data);

    allMessages = allMessages.concat(data.results || []);

    return {
      callId,
      messages: allMessages
    };

  } catch (error) {
    logMessage('Error fetching Ultravox messages:', error.message);      
    //console.error('Error fetching Ultravox messages:', error.message);
    return null;
  }
}

export async function getCallRecording_Ultra(callId,UVdate) { 
  
  try {
    if (!callId) {
      console.error('Missing callId in getCallRecording_Ultra');
      return null;
    }
    
    // 1. Fetch recording from Ultravox
    const recordingUrl = `${ULTRAVOX_API_URL}/calls/${callId}/recording`;   

    const response = await fetch(recordingUrl, {
      headers: {
        // 'X-API-Key': ULTRAVOX_API_KEY,
        'X-API-Key': UVdate,
        //'Accept': 'audio/mpeg' // Typically recordings are in MP3 format
      }
    });
    

    if (!response.ok) {
      console.log(`Ultravox recording API error: ${response.status}`);
      await log_incoming_call_request(
        'Ultravox Recording API Error', 
        { status: response.status, callId },
        null
      );
      return null;
    }
    
     

    // 2. Get recording as Blob
    const recordingBlob = await response.blob();    
   
    const doctname= await getCallSessionDocname(callId);    

    const docnameValue = doctname?.message?.name;
    if (!docnameValue) {
    console.log('Docname missing or undefined. Cannot upload recording.');
    return null;
    }
    
    // 3. Upload fiel t0 ERPNext
   const uploadResult = await uploadRecordingViaCustomAPI({
    fileBlob: recordingBlob,
    filename: `${callId}.mp3`,
    doctype: 'Call Session Log',
    docname: docnameValue,    
    apiKey: E_ADMIN_API_KEY,
    apiSecret: E_ADMIN_API_SECRET,
    baseUrl: ERP_API_BASE_URL
  });

  if (!uploadResult.success) {
    logMessage('File upload failed:', uploadResult.error);      
    //console.error('File upload failed:', uploadResult.error);
    await log_incoming_call_request(
      'Recording Upload Failed',
      { callId, error: uploadResult.error },
      null
    );
    return null;
  }

  } catch (error) {
    logMessage('Error in getCallRecording_Ultra:', error);      
    // console.error('Error in getCallRecording_Ultra:', error);
    await log_incoming_call_request(
      'Recording Attachment Error', 
      { error: error.message, callId },
      null
    );
    return null;
  }
}

export async function deleteCall_U(callId,UVdate) {
    logMessage(`Attempting to delete Ultravox call with ID: ${callId}`);

    try {
        // Step 1: Validate the callId. A callId is required for the API request.
        if (!callId) {
            logMessage('Error: Missing callId. Deletion request aborted.');
            // Log the error to your ERP system for tracking
            await log_incoming_call_request('Ultravox Deletion Error', 'Missing callId', 'Client Error');
            return false;
        }

        // Step 2: Construct the API URL.
        // This URL matches the structure from the Ultravox documentation.
        const urlToDelete = `${ULTRAVOX_API_URL}/calls/${callId}`;

        // Step 3: Make the DELETE request to the Ultravox API.
        const response = await fetch(urlToDelete, {
            method: 'DELETE',
            headers: {
                'X-API-Key': UVdate,
                // 'X-API-Key': ULTRAVOX_API_KEY,
                'Accept': 'application/json'
            }
        });

        // Step 4: Handle the API response.
        if (response.ok) {
            // The API returns a successful status (e.g., 200, 204)
            logMessage(`Successfully deleted Ultravox call with ID: ${callId}`);
            return true;
        } else {
            // The API returned an error status code.
            const errorBody = await response.text();
            logMessage(`Failed to delete Ultravox call ${callId}. Status: ${response.status}, Body: ${errorBody}`);
            // Log the failure to your ERP system
            await log_incoming_call_request(
                'Ultravox Deletion Failed',
                { callId, status: response.status, errorBody },
                'API Error'
            );
            return false;
        }

    } catch (error) {
        // Step 5: Handle network or other unexpected errors.
        logMessage(`Unexpected error during Ultravox call deletion for ID ${callId}: ${error.message}`);
        console.error('Stack trace:', error.stack);
        await log_incoming_call_request(
            'Ultravox Deletion Unexpected Error',
            { callId, error: error.message },
            'System Error'
        );
        return false;
    }
}
 

 //checkis this used
export async function createUltravoxCall(job,use_knowlege_base,knowlege_base_id,UVdate) {
  try {
    //console.log('ULTRAVOX_API_KEY here:', ULTRAVOX_API_KEY );
    // logMessage('ULTRAVOX_API_KEY here:', ULTRAVOX_API_KEY);
    //console.log('ULTRAVOX_OUTBOUND_API_URL:', ULTRAVOX_OUTBOUND_API_URL);
    logMessage('ULTRAVOX_OUTBOUND_API_URL:', ULTRAVOX_OUTBOUND_API_URL);
    if ( !ULTRAVOX_OUTBOUND_API_URL) {
      throw new Error('Missing Ultravox configuration - check environment variables');
    }
    logMessage(' createUltravoxCall job:', job);
    logMessage(' use_knowlege_base:', use_knowlege_base);
    logMessage(' knowlege_base_id:', knowlege_base_id);
    //console.log('job dat:', job);
   
    const payload = buildUltravoxCallConfig(job,use_knowlege_base,knowlege_base_id); // Store the payload
    //console.log('ULTRAVOX_CALL_CONFIG complete:', payload);
    logMessage(' ULTRAVOX_CALL_CONFIG complete:', payload);

    //return; //THis is for teting
    const request = https.request(ULTRAVOX_OUTBOUND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'X-API-Key': ULTRAVOX_API_KEY
        'X-API-Key': UVdate
      }
    });
    console.log('request ',request);
 

    return new Promise((resolve, reject) => {
    let data = '';

    request.on('response', (response) => {
      response.on('data', chunk => data += chunk);

      response.on('end', () => {
        const contentType = response.headers['content-type'] || '';

        if (!contentType.includes('application/json')) {
          console.error('Unexpected content-type:', contentType);
          console.error('Response body:', data);

          return reject(new Error('Ultravox API did not return JSON.'));
        }

        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (parseErr) {
          console.error('Failed to parse Ultravox response as JSON:', data);
          reject(new Error('Invalid JSON from Ultravox API'));
        }
      });
    });

    request.on('error', reject);
    request.write(JSON.stringify(payload));  // use `payload` (you already built it earlier)
    request.end();
  });
 
    
  } catch (error) {
    logMessage('Critical error in createUltravoxCall:', error);    
    log_incoming_call_request('Error in createUltravoxCall',  error,  error.message);
    
    //throw error;
  }
}  
async function initiateCall(job) {
try {
  
  let TWILIO_NUMBER=job.telecom_phone_number;     
  const UVdate = await getuv(TWILIO_NUMBER);
  if(!UVdate)
  {
      logMessage(`UVdate not found in ERP for twilio: ${TWILIO_NUMBER} uv: ${ UVdate}`);
      return res.status(200).json({ success: true, ignored: true });
  }

  const TELECOME_PHONE_NUMBER=TWILIO_NUMBER;//job.telecom_phone_number;
  const COMPANYID=job.business_id;

  const telecom_credential = await GET_teleCreden(TELECOME_PHONE_NUMBER,COMPANYID);
  if (!telecom_credential) {
    throw new Error('Telecom credential not found for the provided phone number.');
  }
  const use_knowlege_base =  telecom_credential?.message?.data?.use_knowlege_base;
  const knowlege_base_id =  telecom_credential?.message?.data?.knowlege_base_id;

  const ultravoxResponse = await createUltravoxCall(job,use_knowlege_base,knowlege_base_id,UVdate);
  logMessage('🔍 Full Ultravox Call Response:', JSON.stringify(ultravoxResponse, null, 2));    
  //console.log('🔍 Full Ultravox Call Response:', JSON.stringify(ultravoxResponse, null, 2));
  const { joinUrl,callId } = ultravoxResponse;
  const ultravoxCallId=callId;

  //const { joinUrl } = await createUltravoxCall(job);
  if(joinUrl === undefined || joinUrl === null) {
   logMessage('joinUrl is undefined or null. Please check the job configuration.');    
   //console.log('joinUrl is undefined or null. Please check the job configuration.');
   log_incoming_call_request('Error in initiateCall', job,  'createUltravoxCall Error in joining call');
   
   logMessage('Formatted time:', job.job_id);    
   //console.log('Formatted time:', job.job_id);
   await updateJobRecord(
    job.job_id,
    'not-join',
    '',
    formattedTime,0
    );
   return;
  } 
  logMessage('joinUrl:', joinUrl);     
  //console.log('joinUrl:', joinUrl);
 
  const CALL_PHONE_NO = job.call_phone_no;
  
  // logMessage('Telecom credential:', telecom_credential);     
  //console.log('Telecom credential:', telecom_credential);
  const TWILIO_ACCOUNT_SID =  telecom_credential?.message?.data?.twilio_account_sid;
  const TWILIO_AUTH_TOKEN =  telecom_credential?.message?.data?.twilio_auth_token;
  // const CALL_PHONE_NO = telecom_credential?.message?.data?.call_phone_no;

  // console.log('TWILIO_ACCOUNT_SID:', TWILIO_ACCOUNT_SID);
  // console.log('TWILIO_AUTH_TOKEN:', TWILIO_AUTH_TOKEN);
  console.log('CALL_PHONE_NO:', CALL_PHONE_NO);

  
  const client = twilio(TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN);  
  logMessage('Twilio client line 219 : ',client);     
  // console.log('Twilio client line 219 : ',client);    
  const call = await client.calls.create({
    twiml: `<Response><Connect><Stream url="${joinUrl}"/></Connect></Response>`,
    to: CALL_PHONE_NO,
    from: TELECOME_PHONE_NUMBER,//twilio
    statusCallback: `${TOOLS_BASE_URL}/whook/callStatus?job_id=${job.job_id}&ultravoxCallId=${ultravoxCallId}`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST'
  });
  // Format the timestamp to ISO or readable string

   if (!call) {

      await log_incoming_call_request('Ultravox call creation got call undefined', body, ` ${CALL_PHONE_NO} -  ${job.job_id}`);
      throw new Error('Error occur in creating a call');
    }
   logMessage('Call initiated successfully:', call);      
   //console.log('Call initiated successfully:', call);
   const twilioCallSid= call.sid;
   activeCalls.set(ultravoxCallId, { twilioCallSid,
    createdAt: new Date().toISOString(),
    type: 'outbound',
    status: 'active'

   });

  await updateJobRecord(
    job.job_id,
    'initiated',
    call.sid,
    formattedTime,0
    );
  return call; 

} catch (error) {
  logMessage('Error in initiateCall:', error);      
  //console.error('Error in initiateCall:', error);
   
      await updateJobRecord(
        job.job_id,
        'Failed',
        `Error: ${error.message}`,
        formattedTime,0
      );
       log_incoming_call_request('Error in initiateCall', error,  error.message);
  throw error;
}
} 

 export async function triggerOutboundCall(jobs) {
  if (!Array.isArray(jobs)) {
    console.log("🚨 Expected an array of jobs but received:", typeof jobs);
    return;
  }

  for (const job of jobs) {
    try {
      // console.log(`🔔 Outbound call job found:`, job);
      //console.log(`📞 Triggering outbound call for: ${job.full_name} - ${job.call_phone_no}`);
      logMessage(`📞 Triggering outbound call for: ${job.full_name} - ${job.call_phone_no}`);      

      // TODO: Replace this with your actual outbound call logic
      // Example: await ultravox.call(job.call_phone_no, job.prompt);

      // For now, simulate a delay (optional)
      if(job.credit_business>0 ) //CHECK IF CREDIT IS AVAILABLE
      {

        const call =await initiateCall(job);        
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_OUTBOUND_CALL* 1000)); // Convert seconds to milliseconds
      }
      else
      {
        const BUSINESS_CREDIT_FIN_OUTBOUND = 'Business Credit finished OUTBOUND';
        const logresult= await log_incoming_call_request('Sorry, Business Credit finished, contact Company', job,BUSINESS_CREDIT_FIN_OUTBOUND );
        //console.log('Log result:', logresult);
        logMessage('Log result:', logresult);      

        //console.log(`❌ Job ${job.job_id} has no credit left. Skipping call.`);
        logMessage(`❌ Job ${job.job_id} has no credit left. Skipping call.`);      
        await updateJobRecord(
          job.job_id,
          'no-credit',
          '',
          formattedTime,0
        );
      }

    } catch (err) {
      logMessage(`❌ Failed to process job ${job.job_id}:`, err);      
      //console.log(`❌ Failed to process job ${job.job_id}:`, err);
    }
  }
}

export async function updateJobRecord(jobId, status, sid = '',updated_time,callduration) {
    try {
       
       console.log(`Updating job record at  ${jobId} with status: ${status} and notes: ${sid}`);
       const result=  await update_jobStatus(
          jobId, 
          status,
          sid, 
          updated_time,
          callduration
        );
  
    } catch (error) {
      logMessage(`Failed to Job: ${jobId}:`, error.message);      
      //console.log(`Failed to Job: ${jobId}:`, error.message);
      throw error;
    }
  }

  // async function updateCallStatus_wh(bodydetails) {
  //   try {
       
  //      console.log(`updateCallRecord ... `,bodydetails);
  //      const result=  await update_callstatus_whevent(bodydetails);
  
  //   } catch (error) {
  //     console.log(`Failed to Job: ${jbodydetails}:`, error.message);
  //     throw error;
  //   }
  // }