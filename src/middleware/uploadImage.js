// const multer = require('multer');
// const { storage } = require('./cloudinary');
// const upload = multer({ storage: storage });

// module.exports = { upload };


const multer = require("multer");
const { cloudinary } = require("./cloudinary");
const crypto = require("crypto");

// Use in-memory storage for processing before upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * Generate SHA-256 hash for image buffer
 */
const generateImageHash = async (buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

/**
 * Upload image to Cloudinary if not already present
 */
const uploadImage = async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
  
      const fileBuffer = req.file.buffer;
      const imageHash = await generateImageHash(fileBuffer);
      console.log("Image Hash:", imageHash);
  
      // Search Cloudinary for an image with the same hash
      const existingImages = await cloudinary.search
        .expression(`tags=${imageHash}`)
        .execute();
  
      if (existingImages.resources.length > 0) {
        req.body.cloudinaryUrl = existingImages.resources[0].secure_url;
        req.body.cloudinaryId = existingImages.resources[0].public_id;
        console.log("Using existing image:", req.body.cloudinaryUrl);
        return next();
      }
  
      // Upload image if not found
      cloudinary.uploader
        .upload_stream(
          { folder: "blog_images", tags: [imageHash], resource_type: "image" },
          (error, result) => {
            if (error) {
              console.error("Cloudinary Upload Error:", error);
              return res.status(500).json({ error: error.message });
            }
            req.body.cloudinaryUrl = result.secure_url;
            req.body.cloudinaryId = result.public_id;

            console.log("Uploaded new image:", req.body.cloudinaryUrl);
            next();
          }
        )
        .end(fileBuffer);
    } catch (err) {
      console.error("Upload Error:", err);
      res.status(500).json({ error: "Error processing image" });
    }
  };

module.exports = { upload, uploadImage };