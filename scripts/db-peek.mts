import dotenv from 'dotenv'
import mongoose from 'mongoose'
dotenv.config({ path: '.env.local' })
await mongoose.connect(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 15000 })
const db = mongoose.connection.db!
for (const c of await db.listCollections().toArray()) {
  const n = await db.collection(c.name).countDocuments()
  const doc = await db.collection(c.name).findOne()
  // Field names only — never dump credential values.
  const fields = doc ? Object.keys(doc).join(', ') : '(empty)'
  console.log(`${c.name}: ${n} docs | fields: ${fields}`)
}
await mongoose.disconnect()
