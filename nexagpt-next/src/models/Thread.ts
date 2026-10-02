import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ImageSchema = new Schema(
  {
    thumbUrl: { type: String, required: true },
    fullUrl: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    title: { type: String, default: "" },
    author: String,
    license: String,
    width: Number,
    height: Number,
  },
  { _id: false },
);

const MessageSchema = new Schema(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, default: "" },
    images: { type: [ImageSchema], default: undefined },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ThreadSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String },
    title: { type: String, default: "New chat" },
    messages: { type: [MessageSchema], default: [] },
  },
  { timestamps: true },
);

ThreadSchema.index({ userId: 1, updatedAt: -1 });

export type ThreadDoc = InferSchemaType<typeof ThreadSchema>;

// In development, hot reloads keep the old compiled model around; drop it so schema
// changes take effect (otherwise unknown fields are silently discarded on save).
if (process.env.NODE_ENV !== "production" && mongoose.models.Thread) mongoose.deleteModel("Thread");

export const Thread: Model<ThreadDoc> =
  (mongoose.models.Thread as Model<ThreadDoc>) ?? mongoose.model<ThreadDoc>("Thread", ThreadSchema);
