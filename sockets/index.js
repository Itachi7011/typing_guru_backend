// sockets/index.js
//
// The real Socket.IO backend that SocketContext.jsx (frontend) was
// written against but that never existed (see
// COMPETITIVE_ANALYSIS_AND_ROADMAP.md, "SocketContext.jsx expects a
// different AuthContext shape" / "found it's more incomplete than
// known"). This module builds it: an authenticated handshake reusing the
// same httpOnly `accessToken` cookie every REST call already uses (no
// separate socket-specific auth scheme, no client-side token needed),
// per-user rooms for pushing notifications, and a minimal persisted
// support-chat.
//
// Design decisions:
// - Auth reuses `userAuthentication.js`'s exact validity rules (JWT
//   verify -> user lookup -> isDeleted/isActive -> token-not-revoked
//   check against `user.tokens`) instead of a lighter check, so a
//   logged-out or revoked session can't keep a live socket connection
//   open just because the process hasn't restarted.
// - One room per user (`user:<id>`) is joined automatically on connect.
//   This is what makes server-side code elsewhere able to push a live
//   notification via `emitNewNotification(userId, notification)` without
//   knowing which socket(s) that user currently has open.
// - Support chat is a second, opt-in room (`support:<chatId>`) joined
//   only via the `join_support_chat` event, matching the client API
//   `SocketContext.jsx` already exposes (`joinSupportChat`/
//   `leaveSupportChat`/`sendMessage`). Messages are persisted via the
//   new `SupportChatMessage` model so a support agent (or the same user)
//   reloading the page doesn't lose history — an in-memory-only relay
//   would silently drop messages on every server restart, which isn't a
//   real feature, just a demo of one.
// - No admin-side socket auth is wired in yet (nothing in the admin
//   frontend imports `useSocket`). `sender.userModel` supports
//   `_Admin` in the schema so a future admin-side handshake can reuse
//   this same server without another migration.

const jwt = require('jsonwebtoken');
const { parseCookie } = require('cookie');
const User = require('../models/User/Users');
const UserNotification = require('../models/User/UserNotification');
const SupportChatMessage = require('../models/User/SupportChatMessage');
const { createRedisConnection, isRedisConfigured } = require('../lib/redisClient');

let ioInstance = null;

const parseCookies = (handshake) => {
  const header = handshake.headers?.cookie;
  if (!header) return {};
  try {
    return parseCookie(header);
  } catch {
    return {};
  }
};

// Mirrors userAuthentication.js's validity checks exactly (see that
// file's comments for why both checks exist) so a socket connection
// can't outlive a revoked/expired REST session.
const authenticateSocket = async (socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake);
    const token = cookies.accessToken;

    if (!token) {
      return next(new Error('unauthorized'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({
      _id: decoded.userId,
      isDeleted: false,
      isActive: true,
    });

    if (!user) {
      return next(new Error('unauthorized'));
    }

    const validToken = user.tokens?.some(
      (t) => t.token === token && t.tokenType === 'access' && !t.isRevoked,
    );

    if (!validToken) {
      return next(new Error('unauthorized'));
    }

    socket.data.userId = String(user._id);
    socket.data.userName = user.name;
    next();
  } catch (error) {
    next(new Error('unauthorized'));
  }
};

const initSocket = (server, corsOptions) => {
  const { Server } = require('socket.io');

  const io = new Server(server, {
    cors: {
      origin: corsOptions.origin,
      credentials: true,
    },
  });

  // WHY THIS MATTERS AT SCALE: without this, io.to(room).emit(...) only
  // reaches sockets connected to THIS process. Run more than one API
  // replica behind a load balancer (which is the entire point of
  // horizontal scaling — see README.md "Scaling Beyond The Current
  // Setup") and a notification created by a request that happened to
  // land on replica A would silently never reach a user whose
  // WebSocket connection landed on replica B. The Redis adapter fans
  // every io.to()/emit() out across all connected replicas via Redis
  // pub/sub, so which replica a given request or socket connection
  // lands on stops mattering. A no-op (single-process, in-memory
  // pub/sub) when REDIS_URL isn't set, matching this app's existing
  // "Redis is optional until you actually scale out" pattern.
  if (isRedisConfigured()) {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const pubClient = createRedisConnection();
    const subClient = createRedisConnection();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[sockets] Redis adapter enabled — safe to run multiple API replicas');
  }

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { userId } = socket.data;

    // Personal room — used by emitNewNotification() below so any other
    // part of the backend can push to this user without tracking socket
    // ids itself.
    socket.join(`user:${userId}`);

    socket.on('join_support_chat', (payload) => {
      const chatId = payload?.chatId;
      if (!chatId || typeof chatId !== 'string') return;
      socket.join(`support:${chatId}`);
    });

    socket.on('leave_support_chat', (payload) => {
      const chatId = payload?.chatId;
      if (!chatId || typeof chatId !== 'string') return;
      socket.leave(`support:${chatId}`);
    });

    socket.on('send_message', async (payload) => {
      const chatId = payload?.chatId;
      const text = typeof payload?.message === 'string' ? payload.message.trim() : '';
      const type = ['text', 'image', 'file'].includes(payload?.type) ? payload.type : 'text';

      if (!chatId || typeof chatId !== 'string' || !text) return;
      // Cap message length defensively; the schema also enforces this,
      // but rejecting early avoids an unnecessary DB round trip.
      if (text.length > 2000) return;

      try {
        const saved = await SupportChatMessage.create({
          chatId,
          sender: {
            userId,
            userModel: `${process.env.APP_NAME}_User`,
            name: socket.data.userName,
          },
          message: text,
          type,
        });

        io.to(`support:${chatId}`).emit('new_message', {
          _id: saved._id,
          chatId: saved.chatId,
          sender: saved.sender,
          message: saved.message,
          type: saved.type,
          createdAt: saved.createdAt,
        });
      } catch (error) {
        console.error('send_message error:', error.message);
      }
    });

    socket.on('mark_notification_read', async (payload) => {
      const notificationId = payload?.notificationId;
      if (!notificationId) return;

      try {
        // Ownership check baked into the query itself (recipient must
        // match the authenticated socket's user) rather than fetching
        // then checking, so a spoofed id for someone else's notification
        // simply matches zero documents instead of leaking a 403 vs 404
        // distinction.
        await UserNotification.updateOne(
          { _id: notificationId, 'recipient.userId': userId },
          { $set: { isRead: true, readAt: new Date() } },
        );
      } catch (error) {
        console.error('mark_notification_read error:', error.message);
      }
    });

    socket.on('user_activity', (activity) => {
      // Lightweight presence/telemetry signal only — intentionally not
      // persisted (UserActivity already covers durable activity logging
      // elsewhere via logUserActivity()). Rebroadcast to the user's own
      // other tabs/devices so, e.g., an active-typing-test indicator can
      // stay in sync across open sessions.
      socket.to(`user:${userId}`).emit('user_activity', activity);
    });
  });

  ioInstance = io;
  return io;
};

const getIO = () => ioInstance;

// Called from wherever a notification is created (see routes/userAuth.js
// createNotification()) to push it live to any connected socket(s) for
// that user, in addition to the existing DB persistence. Safe to call
// even if the Socket.IO server hasn't been initialized (e.g. in a script
// or test context) or if the user has no active connection — it's a
// best-effort push, not the source of truth (the DB row is).
const emitNewNotification = (userId, notification) => {
  if (!ioInstance || !userId || !notification) return;
  ioInstance.to(`user:${userId}`).emit('new_notification', notification);
};

module.exports = { initSocket, getIO, emitNewNotification };
