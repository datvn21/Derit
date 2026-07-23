import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_CONNECTIONSTRING);
    console.log("Link DB success!");
  } catch (error) {
    console.log("Error occur when try to connect to DB!", error);
    process.exit(1);
  }
};
