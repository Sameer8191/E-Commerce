
import multer from "multer";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 5;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
    fields: 20,
    parts: 25,
    fieldNameSize: 100,
    fieldSize: 64 * 1024,
  },

  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error("Unsupported image type"));
    }

    cb(null, true);
  },
});

export const uploadProductImages = upload.array(
  "images",
  MAX_FILES
);
