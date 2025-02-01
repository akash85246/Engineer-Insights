const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { GridFSBucket } = require('mongodb');

let gfs = { bucket: null };

async function connect() {
  let uri;

  if (process.env.MONGODB_URI) {
    uri = process.env.MONGODB_URI;
  } else {
    const mongodb = await MongoMemoryServer.create();
    uri = mongodb.getUri();
    console.log("Connected to in-memory MongoDB");
  }

  mongoose.set("strictQuery", true);
  const db = await mongoose.connect(uri);

  console.log(`Connected to MongoDB at ${uri}`);

  const bucket = new GridFSBucket(db.connection.db, {
    bucketName: 'uploads'
  });

  gfs.bucket = bucket;

  return db;
}

module.exports = { connect, gfs };