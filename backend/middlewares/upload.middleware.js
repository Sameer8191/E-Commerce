
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

const bulkProductImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1,
    fields: 1,
    parts: 2,
    fieldNameSize: 100,
    fieldSize: 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.fieldname !== "imagesZip" ||
      !file.originalname.toLowerCase().endsWith(".zip")
    ) {
      const error = new Error("Choose an image ZIP file.");
      error.statusCode = 400;
      return cb(error);
    }
    cb(null, true);
  },
});

export const uploadBulkProductImport = (req, res, next) => {
  bulkProductImportUpload.fields([{ name: "imagesZip", maxCount: 1 }])(
    req,
    res,
    (error) => {
      if (error) {
        console.error("Bulk product upload error:", {
          name: error.name,
          code: error.code,
          message: error.message,
        });
        const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({
          success: false,
          message:
            status === 413
              ? "Image ZIP archive exceeds the 50 MB limit."
              : error.message || "Could not process the product import files.",
        });
      }

      next();
    },
  );
};

// export const uploadProductImages = upload.array(
//   "images",
//   MAX_FILES
// );
