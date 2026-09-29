"use strict"

/**
 * Read-only public proxy for a private S3-compatible bucket.
 *
 * Railway buckets serve nothing publicly, so product images stored in one
 * cannot load in a browser. This service answers public GET (and HEAD, which
 * Express derives from GET automatically) by streaming from the bucket.
 * No other method has a route, so PUT/POST/PATCH/DELETE all 404: the proxy
 * can never write, only read.
 *
 * Env (all required except PORT):
 *   S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 *   S3_REGION (use "auto" for Railway buckets), S3_ENDPOINT,
 *   PORT (provided by Railway; defaults to 8080 locally)
 */

const express = require("express")
const {
  S3Client,
  GetObjectCommand,
} = require("@aws-sdk/client-s3")

const {
  S3_BUCKET,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_REGION = "auto",
  S3_ENDPOINT,
  PORT = "8080",
} = process.env

for (const [name, value] of Object.entries({
  S3_BUCKET,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT,
})) {
  if (!value) {
    console.error(`bucket-proxy: missing required env ${name}`)
    process.exit(1)
  }
}

const s3 = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
  // Virtual-host style matches Railway's bucket URL style.
  forcePathStyle: false,
})

const app = express()
app.disable("x-powered-by")

app.get("/health", (_req, res) => {
  res.status(200).send("OK")
})

app.get(/^\/(.*)$/, async (req, res) => {
  const key = req.params[0]

  // Never serve directory listings, empty keys, or traversal attempts.
  if (!key || key.includes("..")) {
    res.status(400).send("Bad request")
    return
  }

  try {
    const out = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key })
    )
    if (out.ContentType) {
      res.setHeader("Content-Type", out.ContentType)
    }
    if (out.ContentLength !== undefined) {
      res.setHeader("Content-Length", String(out.ContentLength))
    }
    if (out.ETag) {
      res.setHeader("ETag", out.ETag)
    }
    // Product images are content-addressed in practice; cache hard, and let
    // revalidation via ETag handle the rare overwrite.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
    out.Body.pipe(res)
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode
    if (status === 404 || status === 403 || error?.name === "NoSuchKey") {
      // 403 doubles as 404 here: the bucket is private and key existence
      // must not leak, so both map to Not Found.
      res.status(404).send("Not found")
      return
    }
    console.error(`bucket-proxy: GET /${key} failed:`, error)
    res.status(502).send("Upstream error")
  }
})

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`bucket-proxy: serving bucket "${S3_BUCKET}" on port ${PORT}`)
})
