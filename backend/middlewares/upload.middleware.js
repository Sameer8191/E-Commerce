
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
      const error = new Error("Unsupported image type");
      error.statusCode = 400;
      return cb(error);
    }

    cb(null, true);
  },
});


export const uploadProductImages = (req, res, next) => {
  upload.array("images", MAX_FILES)(req, res, (error) => {
    if (error) {
      console.error("Multer upload error:", {
        name: error.name,
        code: error.code,
        message: error.message,
      });

      return next(error);
    }

    next();
  });
};

// export const uploadProductImages = upload.array(
//   "images",
//   MAX_FILES
// );
