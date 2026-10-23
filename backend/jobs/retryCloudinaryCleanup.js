import cloudinary from "../config/cloudinary.js";
import CloudinaryCleanup from "../models/cloudinary-cleanup.model.js";

const BATCH_SIZE = 100;
const LEASE_MS = 2 * 60 * 1000;

export const retryCloudinaryCleanup = async (now = new Date()) => {
  const due = await CloudinaryCleanup.find({
    nextAttemptAt: { $lte: now },
    $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
  })
    .select("_id")
    .sort({ nextAttemptAt: 1, _id: 1 })
    .limit(BATCH_SIZE)
    .lean();

  let cleaned = 0;
  let failed = 0;

  for (const { _id } of due) {
    const lockedUntil = new Date(Date.now() + LEASE_MS);
    const task = await CloudinaryCleanup.findOneAndUpdate(
      {
        _id,
        nextAttemptAt: { $lte: now },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
      },
      { $set: { lockedUntil }, $inc: { attempts: 1 } },
      { new: true },
    );
    if (!task) continue;

    try {
      const result = await cloudinary.uploader.destroy(task.publicId, {
        resource_type: "image",
        invalidate: true,
      });
      if (result?.result === "error") {
        throw new Error("Cloudinary returned an error while deleting the image");
      }

      await CloudinaryCleanup.deleteOne({ _id: task._id, lockedUntil });
      cleaned += 1;
    } catch (error) {
      const delayMinutes = Math.min(60, 2 ** Math.min(task.attempts, 6));
      await CloudinaryCleanup.updateOne(
        { _id: task._id, lockedUntil },
        {
          $set: {
            lockedUntil: null,
            nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
            lastError: String(error?.message || error).slice(0, 1000),
          },
        },
      );
      failed += 1;
    }
  }

  return { examined: due.length, cleaned, failed };
};
