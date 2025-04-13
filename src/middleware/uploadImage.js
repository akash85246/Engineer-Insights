const multer = require("multer");
const { cloudinary } = require("./cloudinary");
const crypto = require("crypto");

const storage = multer.memoryStorage();
const upload = multer({ storage });


const generateImageHash = async (buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

const uploadImage = async (req, res, next) => {
    try {
      if (!req.file) {
        return next();
    }
  
      const fileBuffer = req.file.buffer;
      const imageHash = await generateImageHash(fileBuffer);
      console.log("Image Hash:", imageHash);
  
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