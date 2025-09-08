// mcp-calendar-client.js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

class MCPCalendarClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.serverProcess = null;
  }

  async connect() {
    try {
      // Start the MCP server process
      this.serverProcess = spawn('node', ['google-calendar-mcp-server.js'], {
        stdio: ['pipe', 'pipe', 'inherit']
      });

      // Create transport
      this.transport = new StdioClientTransport({
        reader: this.serverProcess.stdout,
        writer: this.serverProcess.stdin
      });

      // Create client
      this.client = new Client(
        {
          name: 'calendar-client',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      // Connect
      await this.client.connect(this.transport);
      console.log('Connected to Google Calendar MCP Server');
      
      return true;
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
      }
      if (this.serverProcess) {
        this.serverProcess.kill();
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  async createEvent(eventData) {
    try {
      const result = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_calendar_event',
            arguments: eventData
          }
        },
        { timeout: 30000 }
      );
      
      return JSON.parse(result.content[0].text);
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  async checkAvailability(startDateTime, endDateTime, calendarId = 'primary') {
    try {
      const result = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: 'check_availability',
            arguments: {
              calendarId,
              startDateTime,
              endDateTime,
              timeZone: 'Europe/London'
            }
          }
        },
        { timeout: 30000 }
      );
      
      return JSON.parse(result.content[0].text);
    } catch (error) {
      console.error('Error checking availability:', error);
      throw error;
    }
  }

  async findAvailableSlots(startDate, endDate, duration = 60) {
    try {
      const result = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: 'find_available_slots',
            arguments: {
              startDate,
              endDate,
              duration,
              workingHours: { start: '09:00', end: '17:00' },
              timeZone: 'Europe/London'
            }
          }
        },
        { timeout: 30000 }
      );
      
      return JSON.parse(result.content[0].text);
    } catch (error) {
      console.error('Error finding available slots:', error);
      throw error;
    }
  }

  async listEvents(timeMin, timeMax, maxResults = 10) {
    try {
      const result = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: 'list_calendar_events',
            arguments: {
              timeMin,
              timeMax,
              maxResults,
              singleEvents: true,
              orderBy: 'startTime'
            }
          }
        },
        { timeout: 30000 }
      );
      
      return JSON.parse(result.content[0].text);
    } catch (error) {
      console.error('Error listing events:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const mcpCalendarClient = new MCPCalendarClient();

// Updated calendar-tools.js - Enhanced tools with MCP integration
import { mcpCalendarClient } from './mcp-calendar-client.js';
import { TOOLS_BASE_URL } from '../config/config.js';

const assessmentReq = false;
const sharedAssessmentParameters = [
  // ... (same assessment parameters as before)
];

// Enhanced book appointment tool with MCP Calendar integration
const bookAppointmentWithCalendarTool = (FROM, TO, IS_APPOINTMENT_EMAIL) => ({
  temporaryTool: {
    modelToolName: "bookAppointmentWithCalendar",
    description: "Schedule appointments with Google Calendar integration and availability checking",
    staticParameters: [
      { "name": "fromNumber", "location": "PARAMETER_LOCATION_BODY", "value": TO },
      { "name": "toNumber", "location": "PARAMETER_LOCATION_BODY", "value": FROM },
      { "name": "isAppointEmail", "location": "PARAMETER_LOCATION_BODY", "value": IS_APPOINTMENT_EMAIL },
      { "name": "intent_from", "location": "PARAMETER_LOCATION_BODY", "value": "outbound Appointment with Calendar" }
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
      { name: "duration", location: "PARAMETER_LOCATION_BODY", schema: { type: "number", description: "Duration in minutes", default: 60 }, required: false },
      { name: "location", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", description: "Meeting location" }, required: false },
      { name: "conversationSummary", location: "PARAMETER_LOCATION_BODY", schema: { 
          description: "A 2-3 sentence summary of the conversation",
          type: "string"
        }, required: true 
      },
      ...sharedAssessmentParameters
    ],
    http: {
      baseUrlPattern: `${TOOLS_BASE_URL}/calendar/bookAppointmentWithCalendar`,
      httpMethod: "POST",
    }
  }
});

// New tool for checking availability
const checkAvailabilityTool = () => ({
  temporaryTool: {
    modelToolName: "checkAvailability",
    description: "Check availability for a specific date and time slot",
    staticParameters: [],
    automaticParameters: [{
      "name": "callId",
      "location": "PARAMETER_LOCATION_BODY",
      "knownValue": "KNOWN_PARAM_CALL_ID"
    }],
    dynamicParameters: [
      { name: "date", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", format: "date" }, required: true },
      { name: "time", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", format: "time" }, required: true },
      { name: "duration", location: "PARAMETER_LOCATION_BODY", schema: { type: "number", default: 60 }, required: false }
    ],
    http: {
      baseUrlPattern: `${TOOLS_BASE_URL}/calendar/checkAvailability`,
      httpMethod: "POST",
    }
  }
});

// New tool for finding available slots
const findAvailableSlotsTool = () => ({
  temporaryTool: {
    modelToolName: "findAvailableSlots",
    description: "Find available appointment slots within a date range",
    staticParameters: [],
    automaticParameters: [{
      "name": "callId",
      "location": "PARAMETER_LOCATION_BODY",
      "knownValue": "KNOWN_PARAM_CALL_ID"
    }],
    dynamicParameters: [
      { name: "startDate", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", format: "date" }, required: true },
      { name: "endDate", location: "PARAMETER_LOCATION_BODY", schema: { type: "string", format: "date" }, required: true },
      { name: "duration", location: "PARAMETER_LOCATION_BODY", schema: { type: "number", default: 60 }, required: false }
    ],
    http: {
      baseUrlPattern: `${TOOLS_BASE_URL}/calendar/findAvailableSlots`,
      httpMethod: "POST",
    }
  }
});

// Updated createSelectedTools function
function createSelectedToolsWithCalendar(
  FROM,
  TO,
  IS_APPOINTMENT_EMAIL,
  ISCALLFORWARDING,
  FORWARDING_MOBILE_NUMBER,
  COMPANYID,
  JOB_ID,
  use_knowlege_base,
  knowlege_base_id
) {
  console.log('Creating selected tools with Calendar integration');

  const tools = [];
  
  if (
    (use_knowlege_base === true || use_knowlege_base === 1 || use_knowlege_base === "1") &&
    knowlege_base_id
  ) {
    tools.push(queryCorpusTool(knowlege_base_id));
  }

  // Add calendar-enhanced tools
  tools.push(
    checkAvailabilityTool(),
    findAvailableSlotsTool(),
    bookAppointmentWithCalendarTool(FROM, TO, IS_APPOINTMENT_EMAIL),
    transferCallTool(FROM, TO, ISCALLFORWARDING, FORWARDING_MOBILE_NUMBER, COMPANYID, JOB_ID),
    hangUpCallTool(FROM, TO, COMPANYID, JOB_ID),
    confirmAppointmentAttendanceTool(FROM, TO, COMPANYID, JOB_ID)
  );

  return tools;
}

// Updated buildUltravoxCallConfig function
export function buildUltravoxCallConfigWithCalendar(job, use_knowlege_base, knowlege_base_id) {
  // ... (same as before until selectedTools)

  const FROM = job.telecom_phone_number;
  const TO = job.call_phone_no;
  const JOB_ID = job.job_id;
  const IS_APPOINTMENT_EMAIL = job.emailnotification;  
  const ISCALLFORWARDING = job.iscallforwarding;
  const FORWARDING_MOBILE_NUMBER = job.forwardingmobilenumber;
  const