
import { fileTypeFromBuffer } from "file-type";
import cloudinary from "../config/cloudinary.js";

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
  const results = await Promise.allSettled(
    images
      .filter((image) => image?.publicId)
      .map((image) =>
        cloudinary.uploader.destroy(image.publicId, {
          resource_type: "image",
          invalidate: true,
        })
      )
  );

  // Cleanup failures shouldn't hide the original operation's error.
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        "Cloudinary cleanup failed:",
        result.reason
      );
    }
  }

  return results;
};
