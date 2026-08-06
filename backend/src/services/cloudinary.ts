import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

export async function uploadProfileImage(image: string): Promise<string> {
  if (!env.cloudinary.cloudName) {
    throw ApiError.badRequest("Image uploads are not configured on this server");
  }

  const result = await cloudinary.uploader.upload(image, {
    folder: "dailyquill/avatars",
    overwrite: true,
    invalidate: true,
    resource_type: "image",
    transformation: [{ width: 500, height: 500, crop: "fill", gravity: "face" }],
  });

  if (!result.secure_url) throw ApiError.badRequest("Image upload failed");
  return result.secure_url;
}
