import mongoose from 'mongoose';

// Bug #138: Retry MongoDB connection with exponential backoff (1s,2s,4s,8s,16s).
// Transient DNS / replica-set hiccups at boot used to crash the process; now we
// give the network up to ~31s to settle before exiting.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async () => {
  // Sprint 1 / BUG-B-109: No hardcoded fallback URI. Hard-fail at boot if missing.
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('FATAL: MONGO_URI is not defined in environment variables');
    process.exit(1);
  }

  const MAX_RETRIES = 5;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(uri);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      lastErr = error;
      const msg = error instanceof Error ? error.message : 'unknown error';
      if (attempt === MAX_RETRIES) {
        console.error(`MongoDB connection failed after ${MAX_RETRIES + 1} attempts: ${msg}`);
        break;
      }
      const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s, 8s, 16s
      console.warn(`MongoDB connect attempt ${attempt + 1} failed (${msg}); retrying in ${delay}ms`);
      await sleep(delay);
    }
  }

  if (lastErr instanceof Error) {
    console.error(`Error: ${lastErr.message}`);
  } else {
    console.error('An unknown error occurred during database connection');
  }
  process.exit(1);
};

export default connectDB;
