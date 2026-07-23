import { Strategy as GoogleStrategy } from "passport-google-oauth20";
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
    done(null, user);
  });

  passport.deserializeUser(async function (user, done) {
    try {
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};
