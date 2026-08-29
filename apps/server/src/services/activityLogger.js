import ActivityLogModel from "../models/ActivityLog.js";

/**
 * Record an activity log entry. Fire-and-forget - never throws.
 * @param {Object} opts
 * @param {string}   opts.activityType  - One of the enum values in ActivityLog schema
 * @param {ObjectId} opts.userId        - User._id (Mongoose ObjectId)
 * @param {ObjectId} [opts.examSessionId]
 * @param {number}   [opts.questionNumber]
 * @param {Object}   [opts.details]     - Arbitrary metadata to store
 * @param {Request}  [opts.req]         - Express request (for IP + UA extraction)
 */
export async function logActivity({
  activityType,
  userId,
  examSessionId = null,
  questionNumber = null,
  details = {},
  req = null,
}) {
  try {
    const ipAddress = req
      ? (req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
        req.socket?.remoteAddress ??
        "")
      : "";
    const userAgent = req ? (req.headers["user-agent"] ?? "") : "";

    await ActivityLogModel.create({
      activityType,
      userId,
      examSessionId: examSessionId ?? null,
      questionNumber: questionNumber ?? null,
      details,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    // Never let logging crash the main request
    console.error("[ActivityLog] Failed to log:", err.message);
  }
}

/**
 * Retrieve the full activity timeline for one student in one session.
 * Returns events sorted by timestamp ASC.
 */
export async function getStudentTimeline(examSessionId, userId) {
  return ActivityLogModel.find({ examSessionId, userId })
    .sort({ timestamp: 1 })
    .lean();
}
