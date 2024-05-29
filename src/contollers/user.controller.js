import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import "dotenv"
import mongoose from "mongoose";


const generateAccessAndRefreshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        console.log(user)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async(req, res) => {
    //algorithm
    //get user details from frontend
    //validation - field should not be empty
    //check if user already exists: username, email
    //check for images, check for avatar
    //upload them to cloudinary, avatar
    //create user object - create entry in database
    //remove password and refresh token field from response
    //check for user creation
    //return response



    const {fullName, email, username, password} = req.body

    if(
        [fullName, email, username, password].some((field) => 
        field?.trim()=== "")
    ){
        throw new ApiError(400, "All fields are required")
    }
    const existedUser = await User.findOne({
        $or: [{ username } , { email }]
    })
    if(existedUser){
        throw new ApiError(409, "User existed already with username or email")
    }
    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){      //used req.files since we have taken an array in user.routes.js
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required :", avatarLocalPath)
    }

    const avatar=await uploadOnCloudinary(avatarLocalPath)
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file not uploaded on cloudinary")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select( 
        "-password -refreshToken"  //yeh nahi chahiye ki display ho
    )
    if(!createdUser) {
        throw new ApiError(500,  "Something went wrong while registering user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
})

const loginUser = asyncHandler(async (req,res) => {
    //algorithm
    //req body -> data
    //username or email
    //find the user in database
    //if no no user found
    //check password
    //if ok generate both access token(short lived) and refreshtoken(long lived)
    //send cookies successfull response

    const {username, email, password} = req.body
    if(!(username || email)){
        throw new ApiError(400, 'Username or email required')
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User doesn't exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(404, "Password Invalid")
    }

   const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

   const loggedInUser = await User.findById(user._id).select("-password, -refreshToken")

   const options = {
    httpOnly: true,
    secure: true
   }

   return res.status(200).cookie('accessToken', accessToken, options)
   .cookie('refreshToken', refreshToken, options)
   .json(
    new ApiResponse(
        200,{
            user: loggedInUser, accessToken, refreshToken
        },
        "User logged in successfully"
    )
   )

 })

 const logoutUser = asyncHandler(async(req,res) => {
    //req.user._id            we have user access here just because of the auth middleware we created

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"))
 })

 const refreshAccessToken = asyncHandler( async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorised request")
    }

    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

    const user = await User.findById(decodedToken?._id)

    if(!user){
        throw new ApiError(401, "Invalid refresh token")
    }

    if(incomingRefreshToken!== user?.refreshToken){
        throw new ApiError(401, "Refresh token is used or expired")
    }
    const options = {
        httpOnly: true,
        secure: true
    }

    const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
        new ApiResponse(
            200,
            {accessToken, refreshToken: newRefreshToken},
            "Access token refreshed successfully" 
        )
    )
 })

 const changeCurrentpassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} =req.body
   const user =  await User.findById(req.user?._id)

   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

   if(!isPasswordCorrect){
    throw new ApiError(400, "Invalid old password")
   }

   user.password = newPassword
   await user.save({validateBeforeSave: false})

   return res.status(200)
   .json(new ApiResponse(200),{},"Password Changed successfully")
 })

 const getCurrentUser = asyncHandler(async(req,res) => {
    return res.status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"))
 })

 const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} =req.body
    if(!fullName || !email){
        throw new ApiError(400, "All fields are required")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
    {
        $set: {
            fullName,
            email
        }
    },
    {new: true}              //ensures updated information returned
)       .select("-password -")               
     return res.status(200)
     .json(new ApiResponse(200, user, "Account details Updated successfully"))

 })


 const updateUserAvatar = asyncHandler(async(req,res) => {
    const avatarLocalPath = req.file?.path                                               //got this operator from multer.middleware.js need only 1 file not multiple files
    
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    //write a function to delete old image on cloudinary

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200)
    .json(
        new ApiResponse(200, user , "Avatar image updated successfully")
    )
}) 

 const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params                     //data extracted from url
    if(!username?.trim()){
        throw new ApiError(400, "Username is missing")
    }

    const channel = User.aggregate([          //aggregate pipelines for calculating subscribers and total subscribed
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions" ,   //database does it by default make the schema plural and to lowercase
                localField: "_id",
                foreignField: "channel",   //took from subscription.model.js
                as: "subscribers" 
            }
        },
        {
            $lookup: {
                from: "subscriptions" ,   //database does it by default make the schema plural and to lowercase
                localField: "_id",
                foreignField: "subscriber",    //took from subscription.model.js
                as: "subscribedTo" 
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"     //added dollar since it is a field here basically calculating total subscribers
                },
                channelSubscribedToCount: {
                    $size: "$subscribers"      //added dollar since it is a field here basically calculating numbers total users subscribed
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},    //checks whether subscribed or not
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {        //fields which will be shown to the user
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel doesn't exists")
    }

    return res.status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
 })

 const getWatchHistory = asyncHandler(async(req , res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id) //did this since mongoose is not applicable inside aggregate pipeline so we make mongoose Id internally
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
 })

export {registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentpassword, getCurrentUser, updateAccountDetails, updateUserAvatar, getUserChannelProfile, getWatchHistory}