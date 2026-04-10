import mongoose from "mongoose";

const connectDB = async (attempt = 1): Promise<void> => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error("MongoDB connection skipped: MONGO_URI is not set.");
    return;
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection failed (attempt ${attempt}):`, error);

    if (attempt < 5) {
      const delay = Math.min(5000 * attempt, 20000);
      setTimeout(() => {
        void connectDB(attempt + 1);
      }, delay);
    }
  }
};

export default connectDB;