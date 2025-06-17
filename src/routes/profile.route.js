const express = require("express");
const { upload,uploadImage } = require('../middleware/uploadImage'); 
const router = express.Router();
const profileController = require("../controllers/profile.controller");
const { Auth } = require("../middleware/auth");
router.get("/search", profileController.searchProfile);
router.get("/search/saveBlogs",profileController.getSavedBlogs);
router.get("/available/:username", profileController.checkUsernameAvailability);


router.get("/usersBlocked",profileController.getAllBlockedUsers);


router.patch("/mode", profileController.updateMode);
router.get('/recent', profileController.getRecent);
router.patch("/notification", profileController.updateNotification);
router.patch("/suggestions", profileController.updateSuggestions);
router.patch("/newsletter", profileController.updateNewsletter);
router.patch("/2fa", profileController.update2fa);
router.patch("/block/:id", profileController.blockUser);
router.patch("/recent", profileController.updateRecent);

router.put("/edit", upload.single('avatar'),uploadImage, profileController.updateProfile);

router.delete("/delete", profileController.deleteProfile);

module.exports = router;