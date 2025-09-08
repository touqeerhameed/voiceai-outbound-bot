// google-calendar-mcp-server.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';

class GoogleCalendarMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'google-calendar-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.oauth2Client = null;
    this.calendar = null;
    this.setupToolHandlers();
  }

  async initializeGoogleCalendar() {
    try {
      // Load credentials from environment or file
      const credentials = {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback'
      };

      this.oauth2Client = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        credentials.redirect_uri
      );

      // Load saved token if exists
      try {
        const tokenData = await fs.readFile('token.json', 'utf8');
        const token = JSON.parse(tokenData);
        this.oauth2Client.setCredentials(token);
      } catch (error) {
        console.log('No saved token found. Need to authenticate.');
        // You'll need to implement OAuth flow here
      }

      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    } catch (error) {
      console.error('Failed to initialize Google Calendar:', error);
    }
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_calendar_event',
            description: 'Creates a new event in Google Calendar',
            inputSchema: {
              type: 'object',
              properties: {
                calendarId: {
                  type: 'string',
                  description: 'Calendar ID (default: primary)',
                  default: 'primary'
                },
                summary: {
                  type: 'string',
                  description: 'Event title/summary'
                },
                description: {
                  type: 'string',
                  description: 'Event description'
                },
                startDateTime: {
                  type: 'string',
                  description: 'Start date and time (ISO 8601 format)'
                },
                endDateTime: {
                  type: 'string',
                  description: 'End date and time (ISO 8601 format)'
                },
                timeZone: {
                  type: 'string',
                  description: 'Time zone (e.g., Europe/London)',
                  default: 'Europe/London'
                },
                attendeeEmails: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of attendee email addresses'
                },
                location: {
                  type: 'string',
                  description: 'Event location'
                }
              },
              required: ['summary', 'startDateTime', 'endDateTime']
            }
          },
          {
            name: 'list_calendar_events',
            description: 'Lists events from Google Calendar',
            inputSchema: {
              type: 'object',
              properties: {
                calendarId: {
                  type: 'string',
                  description: 'Calendar ID (default: primary)',
                  default: 'primary'
                },
                timeMin: {
                  type: 'string',
                  description: 'Start time for search (ISO 8601)'
                },
                timeMax: {
                  type: 'string',
                  description: 'End time for search (ISO 8601)'
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of events',
                  default: 10
                },
                singleEvents: {
                  type: 'boolean',
                  description: 'Expand recurring events',
                  default: true
                },
                orderBy: {
                  type: 'string',
                  description: 'Order by startTime or updated',
                  default: 'startTime'
                }
              }
            }
          },
          {
            name: 'check_availability',
            description: 'Checks availability for a given time slot',
            inputSchema: {
              type: 'object',
              properties: {
                calendarId: {
                  type: 'string',
                  description: 'Calendar ID (default: primary)',
                  default: 'primary'
                },
                startDateTime: {
                  type: 'string',
                  description: 'Start time to check (ISO 8601)'
                },
                endDateTime: {
                  type: 'string',
                  description: 'End time to check (ISO 8601)'
                },
                timeZone: {
                  type: 'string',
                  description: 'Time zone',
                  default: 'Europe/London'
                }
              },
              required: ['startDateTime', 'endDateTime']
            }
          },
          {
            name: 'find_available_slots',
            description: 'Finds available time slots within a date range',
            inputSchema: {
              type: 'object',
              properties: {
                calendarId: {
                  type: 'string',
                  description: 'Calendar ID (default: primary)',
                  default: 'primary'
                },
                startDate: {
                  type: 'string',
                  description: 'Start date for search (YYYY-MM-DD)'
                },
                endDate: {
                  type: 'string',
                  description: 'End date for search (YYYY-MM-DD)'
                },
                duration: {
                  type: 'number',
                  description: 'Desired duration in minutes',
                  default: 60
                },
                workingHours: {
                  type: 'object',
                  properties: {
                    start: { type: 'string', description: 'Working hours start (HH:MM)', default: '09:00' },
                    end: { type: 'string', description: 'Working hours end (HH:MM)', default: '17:00' }
                  }
                },
                timeZone: {
                  type: 'string',
                  description: 'Time zone',
                  default: 'Europe/London'
                }
              },
              required: ['startDate', 'endDate']
            }
          },
          {
            name: 'update_calendar_event',
            description: 'Updates an existing calendar event',
            inputSchema: {
              type: 'object',
              properties: {
                calendarId: {
                  type: 'string',
                  description: 'Calendar ID (default: primary)',
                  default: 'primary'
                },
                eventId: {
                  type: 'string',
                  description: 'Event ID to update'
                },
                summary: {
                  type: 'string',
                  description: 'Event title/summary'
                },
                description: {
                  type: 'string',
                  description: 'Event description'
                },
                startDateTime: {
                  type: 'string',
                  description: 'Start date and time (ISO 8601 format)'
                },
                endDateTime: {
                  type: 'string',
                  description: 'End date and time (ISO 8601 format)'
                },
                timeZone: {
                  type: 'string',
                  description: 'Time zone',
                  default: 'Europe/London'
                }
              },
              required: ['eventId']
            }
          },
          {
            name: 'delete_calendar_event',
            description: 'Deletes a calendar event',
            inputSchema: {
              type: 'object',
              properties: {
                calendarId: {
                  type: 'string',
                  description: 'Calendar ID (default: primary)',
                  default: 'primary'
                },
                eventId: {
                  type: 'string',
                  description: 'Event ID to delete'
                }
              },
              required: ['eventId']
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_calendar_event':
            return await this.createCalendarEvent(args);
          
          case 'list_calendar_events':
            return await this.listCalendarEvents(args);
          
          case 'check_availability':
            return await this.checkAvailability(args);
          
          case 'find_available_slots':
            return await this.findAvailableSlots(args);
          
          case 'update_calendar_event':
            return await this.updateCalendarEvent(args);
          
          case 'delete_calendar_event':
            return await this.deleteCalendarEvent(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async createCalendarEvent(args) {
    const {
      calendarId = 'primary',
      summary,
      description,
      startDateTime,
      endDateTime,
      timeZone = 'Europe/London',
      attendeeEmails = [],
      location
    } = args;

    const event = {
      summary,
      description,
      location,
      start: {
        dateTime: startDateTime,
        timeZone: timeZone
      },
      end: {
        dateTime: endDateTime,
        timeZone: timeZone
      },
      attendees: attendeeEmails.map(email => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 hours before
          { method: 'popup', minutes: 15 } // 15 minutes before
        ]
      }
    };

    const response = await this.calendar.events.insert({
      calendarId,
      resource: event,
      sendUpdates: 'all'
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            eventId: response.data.id,
            htmlLink: response.data.htmlLink,
            summary: response.data.summary,
            start: response.data.start,
            end: response.data.end,
            attendees: response.data.attendees
          }, null, 2)
        }
      ]
    };
  }

  async listCalendarEvents(args) {
    const {
      calendarId = 'primary',
      timeMin,
      timeMax,
      maxResults = 10,
      singleEvents = true,
      orderBy = 'startTime'
    } = args;

    const response = await this.calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents,
      orderBy
    });

    const events = response.data.items || [];
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            count: events.length,
            events: events.map(event => ({
              id: event.id,
              summary: event.summary,
              start: event.start,
              end: event.end,
              location: event.location,
              description: event.description,
              attendees: event.attendees,
              htmlLink: event.htmlLink
            }))
          }, null, 2)
        }
      ]
    };
  }

  async checkAvailability(args) {
    const {
      calendarId = 'primary',
      startDateTime,
      endDateTime,
      timeZone = 'Europe/London'
    } = args;

    const response = await this.calendar.events.list({
      calendarId,
      timeMin: startDateTime,
      timeMax: endDateTime,
      singleEvents: true
    });

    const conflictingEvents = response.data.items || [];
    const isAvailable = conflictingEvents.length === 0;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            available: isAvailable,
            conflictingEvents: conflictingEvents.map(event => ({
              id: event.id,
              summary: event.summary,
              start: event.start,
              end: event.end
            }))
          }, null, 2)
        }
      ]
    };
  }

  async findAvailableSlots(args) {
    const {
      calendarId = 'primary',
      startDate,
      endDate,
      duration = 60,
      workingHours = { start: '09:00', end: '17:00' },
      timeZone = 'Europe/London'
    } = args;

    // Get all events in the date range
    const timeMin = new Date(`${startDate}T00:00:00Z`).toISOString();
    const timeMax = new Date(`${endDate}T23:59:59Z`).toISOString();

    const response = await this.calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const busyEvents = response.data.items || [];
    const availableSlots = [];

    // Generate available slots logic
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
      // Skip weekends (optional - you can modify this)
      if (d.getDay() === 0 || d.getDay() === 6) continue;

      const dayStart = new Date(d);
      const [startHour, startMin] = workingHours.start.split(':');
      dayStart.setHours(parseInt(startHour), parseInt(startMin), 0, 0);

      const dayEnd = new Date(d);
      const [endHour, endMin] = workingHours.end.split(':');
      dayEnd.setHours(parseInt(endHour), parseInt(endMin), 0, 0);

      // Find available slots for this day
      const dayBusyEvents = busyEvents.filter(event => {
        const eventStart = new Date(event.start.dateTime || event.start.date);
        const eventEnd = new Date(event.end.dateTime || event.end.date);
        return eventStart < dayEnd && eventEnd > dayStart;
      });

      // Generate time slots
      for (let slotStart = new Date(dayStart); slotStart < dayEnd; slotStart.setMinutes(slotStart.getMinutes() + 30)) {
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + duration);

        if (slotEnd > dayEnd) break;

        // Check if slot conflicts with any busy event
        const hasConflict = dayBusyEvents.some(event => {
          const eventStart = new Date(event.start.dateTime || event.start.date);
          const eventEnd = new Date(event.end.dateTime || event.end.date);
          return slotStart < eventEnd && slotEnd > eventStart;
        });

        if (!hasConflict) {
          availableSlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            date: d.toISOString().split('T')[0],
            time: slotStart.toTimeString().substr(0, 5)
          });
        }
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            availableSlots: availableSlots.slice(0, 20), // Limit to 20 slots
            totalFound: availableSlots.length
          }, null, 2)
        }
      ]
    };
  }

  async updateCalendarEvent(args) {
    const {
      calendarId = 'primary',
      eventId,
      summary,
      description,
      startDateTime,
      endDateTime,
      timeZone = 'Europe/London'
    } = args;

    const eventUpdate = {};
    if (summary) eventUpdate.summary = summary;
    if (description) eventUpdate.description = description;
    if (startDateTime) eventUpdate.start = { dateTime: startDateTime, timeZone };
    if (endDateTime) eventUpdate.end = { dateTime: endDateTime, timeZone };

    const response = await this.calendar.events.patch({
      calendarId,
      eventId,
      resource: eventUpdate,
      sendUpdates: 'all'
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            eventId: response.data.id,
            updated: response.data.updated,
            summary: response.data.summary,
            start: response.data.start,
            end: response.data.end
          }, null, 2)
        }
      ]
    };
  }

  async deleteCalendarEvent(args) {
    const { calendarId = 'primary', eventId } = args;

    await this.calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: 'all'
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Event ${eventId} deleted successfully`
          }, null, 2)
        }
      ]
    };
  }

  async run() {
    await this.initializeGoogleCalendar();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Google Calendar MCP Server running on stdio');
  }
}

// Start the server
const server = new GoogleCalendarMCPServer();
server.run().catch(console.error);

export default GoogleCalendarMCPServer;