/**
 * Mongoose connection, cached across hot reloads.
 *
 * Next dev re-evaluates modules on every edit; without this global cache you
 * leak a new connection pool per reload and Mongo starts refusing connections
 * about twenty minutes into a hackathon. Standard, boring, necessary.
 */
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var __mongoose: MongooseCache | undefined
}

const cached: MongooseCache = global.__mongoose ?? { conn: null, promise: null }
global.__mongoose = cached

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.')
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      // Fail fast in dev rather than hanging a request for 30s.
      serverSelectionTimeoutMS: 10_000,
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (reason) {
    cached.promise = null
    throw reason
  }

  return cached.conn
}

export { mongoose }
