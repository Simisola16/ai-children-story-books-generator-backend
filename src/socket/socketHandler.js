let ioInstance = null;

function initializeSocket(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Join story room
    socket.on('story:join', (storyId) => {
      if (storyId) {
        const room = `story:${storyId}`;
        socket.join(room);
        console.log(`[Socket.io] Socket ${socket.id} joined room ${room}`);
      }
    });

    // Leave story room
    socket.on('story:leave', (storyId) => {
      if (storyId) {
        const room = `story:${storyId}`;
        socket.leave(room);
        console.log(`[Socket.io] Socket ${socket.id} left room ${room}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
}

function getIO() {
  return ioInstance;
}

/**
 * Emits real-time progress update for a story
 */
function emitStoryStatus({ storyId, status, pageNumber, totalPages, message, pageData }) {
  if (!ioInstance) return;
  const room = `story:${storyId}`;
  ioInstance.to(room).emit('story:status', {
    storyId,
    status,
    pageNumber: pageNumber ?? null,
    totalPages: totalPages ?? null,
    message: message || '',
    pageData: pageData || null,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emits story completion event
 */
function emitStoryComplete({ storyId, story }) {
  if (!ioInstance) return;
  const room = `story:${storyId}`;
  ioInstance.to(room).emit('story:complete', {
    storyId,
    story,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emits friendly error event
 */
function emitStoryError({ storyId, message }) {
  if (!ioInstance) return;
  const room = `story:${storyId}`;
  ioInstance.to(room).emit('story:error', {
    storyId,
    message: message || 'Something went wrong during story generation. Please try again.',
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  initializeSocket,
  getIO,
  emitStoryStatus,
  emitStoryComplete,
  emitStoryError,
};
