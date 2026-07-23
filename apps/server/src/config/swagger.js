import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "DERIT API Documentation",
      version: "1.0.0",
      description:
        "API documentation for DERIT (Development Environment for Real-time Interactive Testing) - An online exam platform for programming courses",
      contact: {
        name: "DERIT Team",
      },
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:5001",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "connect.sid",
          description: "Session cookie authentication",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "User ID",
            },
            email: {
              type: "string",
              description: "User email",
            },
            name: {
              type: "string",
              description: "User name",
            },
            avatar: {
              type: "string",
              description: "User avatar URL",
            },
            role: {
              type: "string",
              enum: ["student", "lecturer"],
              description: "User role",
            },
            studentId: {
              type: "string",
              description: "Student ID (for students only)",
            },
            isActive: {
              type: "boolean",
              description: "Whether the user is active",
            },
          },
        },
        ExamTemplate: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Template ID",
            },
            templateName: {
              type: "string",
              description: "Template name",
            },
            examType: {
              type: "string",
              enum: ["OOP", "DSA"],
              description: "Exam type",
            },
            language: {
              type: "string",
              enum: ["java", "python"],
              description: "Programming language",
            },
            duration: {
              type: "number",
              description: "Exam duration in minutes",
            },
            examCodes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: {
                    type: "string",
                    description: "Exam code",
                  },
                  pdfPath: {
                    type: "string",
                    description: "Path to exam PDF",
                  },
                  questions: {
                    type: "array",
                    description: "Array of questions",
                  },
                },
              },
            },
            createdBy: {
              type: "string",
              description: "Creator user ID",
            },
          },
        },
        ExamSession: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Session ID",
            },
            examTemplateId: {
              type: "string",
              description: "Template ID",
            },
            sessionName: {
              type: "string",
              description: "Session name",
            },
            accessKey: {
              type: "string",
              description: "Access key for students",
            },
            startTime: {
              type: "string",
              format: "date-time",
              description: "Session start time",
            },
            endTime: {
              type: "string",
              format: "date-time",
              description: "Session end time",
            },
            whitelist: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Whitelisted student IDs",
            },
            blacklist: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Blacklisted student IDs",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
            },
          },
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
  },
  apis: ["./app/route/*.js", "./index.js"],
};

export const swaggerSpec = swaggerJsdoc(options);
