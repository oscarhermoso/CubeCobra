// Load Environment Variables
require('dotenv').config();

const AWS = require('aws-sdk');
const { get, put, invalidate } = require('./cache');

// Load the AWS SDK for Node.js

// Set the region
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-2',
});

const s3 = new AWS.S3();

const getObject = async (bucket, key) => {
  try {
    // Check cache
    const cached = get(key);

    if (cached) {
      return cached;
    }

    const res = await s3
      .getObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();
    let value = JSON.parse(res.Body.toString());

    // if value is a string, need to parse it again
    if (typeof value === 'string') {
      value = JSON.parse(value);
    }

    // Update cache
    await put(key, value);

    return value;
  } catch (err) {
    console.log(`Error getting object ${key} from bucket ${bucket}`);
    console.log(err);
    return null;
  }
};

const putObject = async (bucket, key, value) => {
  // Update cache
  await invalidate(key);
  put(key, value);

  await s3
    .putObject({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(value),
    })
    .promise();
};

const deleteObject = async (bucket, key) => {
  await s3
    .deleteObject({
      Bucket: bucket,
      Key: key,
    })
    .promise();
};

module.exports = {
  getObject,
  putObject,
  deleteObject,
};
