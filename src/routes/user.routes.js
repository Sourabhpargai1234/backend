import { Router } from "express";
import { changeCurrentpassword, getCurrentUser, getUserChannelProfile, getWatchHistory, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails, updateUserAvatar } from "../contollers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()


router.route("/register").post(
    upload.fields([                               //yeh humara middleware hai
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser)


router.route("/login").post(loginUser)
//secured routes
router.route("/logout").post(verifyJWT, logoutUser)  //logout hone se pehle middleware function perform hoga
router.route("/refreshToken").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT, changeCurrentpassword)
router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route("/update-account").patch(verifyJWT,updateAccountDetails)

router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
//router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage) //not done this yet

router.route("/c/:username").get(verifyJWT, getUserChannelProfile)  //standard route for handling params

router.route("/history").get(verifyJWT, getWatchHistory)



export default router