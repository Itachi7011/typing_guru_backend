const mongoose = require('mongoose');

// Backs the real-time support chat exposed over Socket.IO
// (`join_support_chat` / `send_message` / `new_message` events — see
// sockets/index.js). `chatId` groups messages into a conversation; for a
// 1:1 user<->support conversation the convention used by the socket
// server is `chatId === userId` of the user who opened the chat, so a
// user can only ever join their own room and support/admin staff join
// the same room id to respond. Kept intentionally simple (no separate
// "SupportChat" thread document) since this is the first version of the
// feature — a thread/status model (open/closed, assigned agent, etc.)
// can be layered on top of `chatId` later without a schema migration.
const SupportChatMessageSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    index: true,
  },
  sender: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'sender.userModel',
    },
    userModel: {
      type: String,
      required: true,
      enum: [`${process.env.APP_NAME}_User`, `${process.env.APP_NAME}_Admin`],
    },
    name: String,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text',
  },
  readBy: [
    {
      userId: mongoose.Schema.Types.ObjectId,
      readAt: { type: Date, default: Date.now },
    },
  ],
}, {
  timestamps: true,
});

SupportChatMessageSchema.index({ chatId: 1, createdAt: 1 });

module.exports = mongoose.model(
  `${process.env.APP_NAME}_SupportChatMessage`,
  SupportChatMessageSchema,
);
