import ExamSessionModel from "../models/ExamSession.js";
import ExamTemplateModel from "../models/ExamTemplate.js";
import { uploadSessionPdfs, deleteSessionPdfs } from "./r2Service.js";
import { notifySessionUpdate } from "../routes/examSession.js";

let lifecycleTimer = null;
let isChecking = false;

/**
 * Activate an exam session: set status to 'ongoing' and upload its PDF files to Cloudflare R2.
 */
export async function activateSession(sessionId) {
  const session = await ExamSessionModel.findById(sessionId).populate(
    "examTemplateId",
  );
  if (!session) return null;

  session.status = "ongoing";

  if (session.examTemplateId) {
    try {
      const r2Resources = await uploadSessionPdfs(
        session,
        session.examTemplateId,
      );
      session.r2Resources = r2Resources;
    } catch (err) {
      console.error(
        `[SessionLifecycle] Failed to upload R2 resources for session ${sessionId}:`,
        err.message,
      );
    }
  }

  await session.save();
  notifySessionUpdate(session._id);
  return session;
}

/**
 * Deactivate an exam session: set status to 'ended' and delete its PDF files from Cloudflare R2.
 */
export async function deactivateSession(sessionId) {
  const session = await ExamSessionModel.findById(sessionId);
  if (!session) return null;

  session.status = "ended";

  const r2Keys = session.r2Resources?.map((r) => r.r2Key) || [];
  try {
    await deleteSessionPdfs(session._id, r2Keys);
  } catch (err) {
    console.error(
      `[SessionLifecycle] Failed to delete R2 resources for session ${sessionId}:`,
      err.message,
    );
  }

  session.r2Resources = [];
  await session.save();
  notifySessionUpdate(session._id);
  return session;
}

/**
 * Check and transition session statuses based on real-time clock.
 */
export async function checkSessionLifecycle() {
  if (isChecking) return;
  isChecking = true;

  try {
    const now = new Date();

    // 1. Find scheduled sessions whose startTime has arrived and have not ended
    const sessionsToStart = await ExamSessionModel.find({
      status: "scheduled",
      startTime: { $lte: now },
      endTime: { $gt: now },
    }).populate("examTemplateId");

    for (const session of sessionsToStart) {
      console.log(
        `[SessionLifecycle] Auto-starting session ${session._id} ("${session.sessionName}")`,
      );
      session.status = "ongoing";
      if (session.examTemplateId) {
        try {
          session.r2Resources = await uploadSessionPdfs(
            session,
            session.examTemplateId,
          );
        } catch (err) {
          console.error(
            `[SessionLifecycle] Error auto-uploading R2 PDFs for session ${session._id}:`,
            err.message,
          );
        }
      }
      await session.save();
      notifySessionUpdate(session._id);
    }

    // 2. Find ongoing sessions whose endTime has passed
    const sessionsToEnd = await ExamSessionModel.find({
      status: "ongoing",
      endTime: { $lte: now },
    });

    for (const session of sessionsToEnd) {
      console.log(
        `[SessionLifecycle] Auto-ending session ${session._id} ("${session.sessionName}")`,
      );
      session.status = "ended";
      const r2Keys = session.r2Resources?.map((r) => r.r2Key) || [];
      try {
        await deleteSessionPdfs(session._id, r2Keys);
      } catch (err) {
        console.error(
          `[SessionLifecycle] Error auto-deleting R2 PDFs for session ${session._id}:`,
          err.message,
        );
      }
      session.r2Resources = [];
      await session.save();
      notifySessionUpdate(session._id);
    }
  } catch (error) {
    console.error("[SessionLifecycle] Error during lifecycle check:", error.message);
  } finally {
    isChecking = false;
  }
}

/**
 * Start the background session lifecycle interval checker.
 */
export function startSessionLifecycleScheduler(intervalMs = 30000) {
  if (lifecycleTimer) return;
  console.log(`[SessionLifecycle] Scheduler started (checking every ${intervalMs / 1000}s)`);
  
  // Run an initial check after a short delay
  setTimeout(() => {
    checkSessionLifecycle().catch((err) =>
      console.error("[SessionLifecycle] Initial check error:", err.message),
    );
  }, 2000);

  lifecycleTimer = setInterval(() => {
    checkSessionLifecycle().catch((err) =>
      console.error("[SessionLifecycle] Periodic check error:", err.message),
    );
  }, intervalMs);
}

/**
 * Stop the background scheduler.
 */
export function stopSessionLifecycleScheduler() {
  if (lifecycleTimer) {
    clearInterval(lifecycleTimer);
    lifecycleTimer = null;
    console.log("[SessionLifecycle] Scheduler stopped");
  }
}
