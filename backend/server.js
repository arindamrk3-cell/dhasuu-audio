require("dotenv").config();
console.log("KEY ID loaded:", !!process.env.B2_KEY_ID);
console.log("APP KEY loaded:", !!process.env.B2_APPLICATION_KEY);
console.log("KEY ID length:", process.env.B2_KEY_ID?.length);
console.log("KEY ID starts:", process.env.B2_KEY_ID?.substring(0, 3));
console.log("BUCKET:", process.env.B2_BUCKET_NAME);
console.log("ENDPOINT:", process.env.B2_ENDPOINT);
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");

const {
  getSignedUrl,
} = require("@aws-sdk/s3-request-presigner");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const ADMIN_KEY = process.env.ADMIN_KEY;

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* -----------------------------
   BACKBLAZE B2
----------------------------- */

const B2_BUCKET = process.env.B2_BUCKET_NAME;
const B2_ENDPOINT = process.env.B2_ENDPOINT;

const s3 = new S3Client({
  endpoint: B2_ENDPOINT,
  region: B2_ENDPOINT
    .replace("https://s3.", "")
    .replace(".backblazeb2.com", ""),
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
});

/* -----------------------------
   MULTER
----------------------------- */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "audio/mp4",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

/* -----------------------------
   B2 METADATA FUNCTIONS
----------------------------- */

const METADATA_KEY = "metadata/audios.json";

async function getAudios() {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: B2_BUCKET,
        Key: METADATA_KEY,
      })
    );

    const text = await response.Body.transformToString();

    return JSON.parse(text);
  } catch (error) {
    if (
      error.name === "NoSuchKey" ||
      error.Code === "NoSuchKey"
    ) {
      return [];
    }

    throw error;
  }
}

async function saveAudios(audios) {
  await s3.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: METADATA_KEY,
      Body: JSON.stringify(audios, null, 2),
      ContentType: "application/json",
    })
  );
}

/* -----------------------------
   HOME
----------------------------- */

app.get("/", (req, res) => {
  res.send("Dhasuu Audio Backend Running");
});

/* -----------------------------
   UPLOAD
----------------------------- */

app.post(
  "/api/upload",
  upload.single("audio"),
  async (req, res) => {
    const key = req.headers["x-admin-key"];

    if (key !== ADMIN_KEY) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No audio file uploaded",
        });
      }

      const title =
        req.body.title || req.file.originalname;

      const artist =
        req.body.artist || "Unknown Artist";

      const category =
        req.body.category || "Other";

      /*
        Create a safe B2 filename
      */

      const b2Key =
        `audio/${Date.now()}-${req.file.originalname}`
          .replace(/\s+/g, "-");

      /*
        Upload file to B2
      */

      await s3.send(
        new PutObjectCommand({
          Bucket: B2_BUCKET,
          Key: b2Key,
          Body: fs.createReadStream(req.file.path),
          ContentType: req.file.mimetype,
        })
      );

      /*
        Delete temporary local file
      */

      fs.unlinkSync(req.file.path);

      /*
        Get existing metadata
      */

      const audios = await getAudios();

      /*
        Create new metadata
      */

      const newAudio = {
        id: Date.now().toString(),
        title,
        artist,
        category,
        key: b2Key,
      };

      audios.push(newAudio);

      /*
        Save metadata back to B2
      */

      await saveAudios(audios);

      res.json({
        message: "Audio uploaded successfully",
        audio: newAudio,
      });

    } catch (error) {
      console.error("UPLOAD ERROR:", error);

      /*
        Remove temporary file if upload failed
      */

      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        message: "Upload failed",
      });
    }
  }
);

/* -----------------------------
   GET AUDIO
----------------------------- */

app.get("/api/audio", async (req, res) => {
  try {
    const audios = await getAudios();

    const result = await Promise.all(
      audios.map(async (audio) => {

        /*
          URL for playing audio
        */

        const playCommand = new GetObjectCommand({
          Bucket: B2_BUCKET,
          Key: audio.key,
        });

        const playUrl = await getSignedUrl(
          s3,
          playCommand,
          {
            expiresIn: 3600,
          }
        );

        /*
          URL for downloading audio
        */

        const downloadCommand = new GetObjectCommand({
          Bucket: B2_BUCKET,
          Key: audio.key,
          ResponseContentDisposition:
            `attachment; filename="${audio.title}.mp3"`,
        });

        const downloadUrl = await getSignedUrl(
          s3,
          downloadCommand,
          {
            expiresIn: 3600,
          }
        );

        return {
          ...audio,
          url: playUrl,
          downloadUrl,
        };
      })
    );

    res.json(result);

  } catch (error) {
    console.error("GET AUDIO ERROR:", error);

    res.status(500).json({
      message: "Failed to get audio files",
    });
  }
});

/* -----------------------------
   SERVER
----------------------------- */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Server running on ${PORT}`
  );
});