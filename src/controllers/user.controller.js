import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import jwt from "jsonwebtoken";

const generateAccessTokenandRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if ([username, email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  console.log(req.body);

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or password already exists");
  }

  const user = await User.create({
    username,
    email,
    password,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "user registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    throw new ApiError(400, "email is required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(401, "User does not exist");
  }

  const isPassword = await user.isPasswordCorrect(password);

  if (!isPassword) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } =
    await generateAccessTokenandRefreshToken(user._id);

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshtoken"
  );
  console.log("Access Token Before Setting Cookie:", accessToken);
  console.log("Refresh Token Before Setting Cookie:", refreshToken);

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User loggedIn successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );
    
      const user = await User.findById(decodedToken?._id);
      if (!user) {
        throw new ApiError(401, "Invalid refresh token");
      }
      if(incomingRefreshToken !== user?.refreshToken) {
        throw new ApiError(401, "Refresh Token is expired or used")
      }
    
      const options = {
        httpOnly: true,
        secure: true
      }
    
      const {accessToken,newRefreshToken} = await generateAccessTokenandRefreshToken(user._id)
    
      return res.status(200)
      .cookie("accessToken",accessToken,options)
      .cookie("refreshToken",newRefreshToken,options)
      .json(
        new ApiResponse(
            200,
            {accessToken, refreshToken: newRefreshToken},
            "Access token refreshed"
        )
      )
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
     
  }
});

const getCurrentUser = asyncHandler(async(req,res) => {
  const user = await User.findById(req.user._id).select('-password -refreshToken');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
    return res.status(200)
    .json(
       new ApiResponse( 200, user, "current user fetched successfully")
    )
})


//CONTROLLER FOR EXCELTOJSON

var User = require('../models/user.model');
var csv = require('csvtojson');


const importUser = async (req, res) => {
  try {
    let userData = [];

    // Convert CSV file to JSON
    await csv()
      .fromFile(req.file.path)
      .then(async (response) => {
        for (let x = 0; x < response.length; x++) {
          userData.push({
            username: response[x].username,   // Assuming the CSV has a 'username' field
            email: response[x].email,         // Assuming the CSV has an 'email' field
            password: response[x].password,   // Assuming the CSV has a 'password' field
            role: response[x].role || 'user', // Optional, defaults to 'user'
          });
        }

        // Insert the user data into the database
        for (let user of userData) {
          const newUser = new User(user);
          await newUser.save(); // This will trigger the pre-save hook to hash passwords
        }
      });

    res.status(200).send({ success: true, msg: 'CSV imported successfully' });

  } catch (error) {
    res.status(400).send({ success: false, msg: error.message });
  }
};


export { registerUser, loginUser, logoutUser, refreshAccessToken, getCurrentUser };


export { importUser };