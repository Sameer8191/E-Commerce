
import { fileTypeFromBuffer } from "file-type";
import cloudinary from "../config/cloudinary.js";
import CloudinaryCleanup from "../models/cloudinary-cleanup.model.js";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const uploadBuffer = (buffer, options) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);

        if (!result) {
          return reject(new Error("Cloudinary returned no result"));
        }

        resolve(result);
      }
    );

    stream.end(buffer);
  });

export const uploadImage = async (
  file,
  folder = "ecommerce/products"
) => {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new Error("Invalid image file");
  }

  const detected = await fileTypeFromBuffer(file.buffer);

  if (!detected || !ALLOWED_TYPES.has(detected.mime)) {
    throw new Error("Unsupported or invalid image file");
  }

  const result = await uploadBuffer(file.buffer, {
    folder,
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
    unique_filename: true,
    overwrite: false,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

// Upload sequentially so completed uploads can be tracked
// and removed if a later upload fails.
export const uploadImages = async (files = []) => {
  const uploaded = [];

  try {
    for (const file of files) {
      uploaded.push(await uploadImage(file));
    }

    return uploaded;
  } catch (error) {
    await deleteCloudinaryImages(uploaded);
    throw error;
  }
};

export const deleteCloudinaryImages = async (images = []) => {
  const targets = images.filter((image) => image?.publicId);
  const results = await Promise.allSettled(
    targets.map((image) =>
      cloudinary.uploader.destroy(image.publicId, {
        resource_type: "image",
        invalidate: true,
      })
    ),
  );

  const failed = results.flatMap((result, index) =>
    result.status === "rejected" || result.value?.result === "error"
      ? [{ publicId: targets[index].publicId, error: result.reason || result.value }]
      : [],
  );

  let queued = [];
  if (failed.length) {
    try {
      await CloudinaryCleanup.bulkWrite(
        failed.map(({ publicId, error }) => ({
          updateOne: {
            filter: { publicId },
            update: {
              $setOnInsert: { publicId },
              $set: {
                nextAttemptAt: new Date(),
                lockedUntil: null,
                lastError: String(error?.message || error).slice(0, 1000),
              },
            },
            upsert: true,
          },
        })),
      );
      queued = failed.map(({ publicId }) => publicId);
    } catch (error) {
      console.error("Unable to persist Cloudinary cleanup tasks:", {
        publicIds: failed.map(({ publicId }) => publicId),
        error,
      });
      try {
        queued = await CloudinaryCleanup.find({
          publicId: { $in: failed.map(({ publicId }) => publicId) },
        }).distinct("publicId");
      } catch (lookupError) {
        console.error("Unable to confirm persisted Cloudinary cleanup tasks:", lookupError);
      }
    }
  }

  for (const { publicId, error } of failed) {
    if (queued.includes(publicId)) {
      console.error("Cloudinary cleanup queued for retry:", publicId, error);
    } else {
      console.error("Cloudinary cleanup could not be queued:", publicId, error);
    }
  }

  return {
    attempted: targets.length,
    queued,
    unqueued: failed
      .map(({ publicId }) => publicId)
      .filter((publicId) => !queued.includes(publicId)),
  };
};
