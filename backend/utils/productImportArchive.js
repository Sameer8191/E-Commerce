import yauzl from "yauzl";

const MAX_IMAGE_FILES = 2500;
const MAX_ARCHIVE_ENTRIES = 5000;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_ARCHIVE_CONTENT_SIZE = 50 * 1024 * 1024;

const isSafeArchivePath = (filename) => {
  if (
    !filename ||
    filename.startsWith("/") ||
    filename.includes("\\") ||
    /^[a-zA-Z]:/.test(filename)
  ) {
    return false;
  }

  return filename
    .split("/")
    .every((part) => part && part !== "." && part !== "..");
};

const importError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

export const readProductImageArchive = (buffer) =>
  new Promise((resolve, reject) => {
    const files = new Map();
    let fileCount = 0;
    let entryCount = 0;
    let totalSize = 0;
    let actualTotalSize = 0;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    yauzl.fromBuffer(
      buffer,
      {
        lazyEntries: true,
        decodeStrings: true,
        validateEntrySizes: true,
        strictFileNames: true,
      },
      (error, zipFile) => {
        if (error) {
          fail(importError("Could not read the image ZIP archive."));
          return;
        }

        zipFile.on("error", () =>
          fail(importError("Could not read the image ZIP archive.")),
        );
        zipFile.on("end", () => {
          if (!settled) {
            settled = true;
            resolve(files);
          }
        });
        zipFile.on("entry", (entry) => {
          entryCount += 1;
          if (entryCount > MAX_ARCHIVE_ENTRIES) {
            fail(importError("The image ZIP contains too many entries."));
            zipFile.close();
            return;
          }

          if (entry.fileName.endsWith("/")) {
            if (!isSafeArchivePath(entry.fileName.slice(0, -1))) {
              fail(importError("The image ZIP contains an unsafe file path."));
              zipFile.close();
              return;
            }
            zipFile.readEntry();
            return;
          }

          const fileMode = (entry.externalFileAttributes >>> 16) & 0o170000;
          if (fileMode === 0o120000 || !isSafeArchivePath(entry.fileName)) {
            fail(importError("The image ZIP contains an unsafe file path."));
            zipFile.close();
            return;
          }

          fileCount += 1;
          totalSize += entry.uncompressedSize;
          if (
            fileCount > MAX_IMAGE_FILES ||
            entry.uncompressedSize > MAX_IMAGE_SIZE ||
            totalSize > MAX_ARCHIVE_CONTENT_SIZE
          ) {
            fail(importError("The image ZIP exceeds the allowed image limits."));
            zipFile.close();
            return;
          }
          if (files.has(entry.fileName)) {
            fail(importError("The image ZIP contains duplicate file names."));
            zipFile.close();
            return;
          }

          zipFile.openReadStream(entry, (streamError, stream) => {
            if (streamError) {
              fail(importError("Could not read an image from the ZIP archive."));
              zipFile.close();
              return;
            }

            const chunks = [];
            let size = 0;
            stream.on("data", (chunk) => {
              size += chunk.length;
              actualTotalSize += chunk.length;
              if (
                size > MAX_IMAGE_SIZE ||
                actualTotalSize > MAX_ARCHIVE_CONTENT_SIZE
              ) {
                fail(importError("The image ZIP exceeds the allowed image limits."));
                stream.destroy();
                zipFile.close();
                return;
              }
              chunks.push(chunk);
            });
            stream.on("error", () => {
              fail(importError("Could not read an image from the ZIP archive."));
              zipFile.close();
            });
            stream.on("end", () => {
              if (settled) return;
              files.set(entry.fileName, {
                buffer: Buffer.concat(chunks),
                originalname: entry.fileName.split("/").pop(),
              });
              zipFile.readEntry();
            });
          });
        });
        zipFile.readEntry();
      },
    );
  });
