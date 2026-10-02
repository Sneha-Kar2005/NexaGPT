import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof UserSchema>;

// In development, hot reloads keep the old compiled model around; drop it so schema
// changes take effect (otherwise unknown fields are silently discarded on save).
if (process.env.NODE_ENV !== "production" && mongoose.models.User) mongoose.deleteModel("User");

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ?? mongoose.model<UserDoc>("User", UserSchema);
