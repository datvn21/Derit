import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import mongoose from "mongoose";
import UserModel from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();
export const initPassport = (passport) => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: process.env.CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, cb) => {
        return cb(null, {
          id: profile.id,
          email: profile.emails[0].value,
          avatar: profile.photos[0].value,
          displayName: profile.displayName,
          photos: profile.photos,
        });
      },
    ),
  );

  passport.serializeUser(function (user, done) {
    done(null, { googleId: user.id, email: user.email });
  });

  passport.deserializeUser(async function (serialized, done) {
    try {
      if (!serialized || !serialized.googleId) {
        return done(null, null);
      }

      const user = await UserModel.findOne({ googleId: serialized.googleId });
      if (!user) {
        return done(null, null);
      }

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};
