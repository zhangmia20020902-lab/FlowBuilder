const db = require("../config/database").pool ;

async function createNotification(userId, type, referenceId, message) {
  const sql = `
    INSERT INTO notifications (user_id, type, reference_id, message)
    VALUES (?, ?, ?, ?)
  `;
  await db.execute(sql, [userId, type, referenceId, message]);
}

async function markAsRead(notificationId) {
  const sql = `UPDATE notifications SET is_read = TRUE WHERE id = ?`;
  await db.execute(sql, [notificationId]);
}

async function markAllAsRead(userId) {
  const sql = `UPDATE notifications SET is_read = TRUE WHERE user_id = ?`;
  await db.execute(sql, [userId]);
}

async function getUserNotifications(userId) {
  const sql = `
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;
  const [rows] = await db.execute(sql, [userId]);
  return rows;
}

module.exports = {
  createNotification,
  markAsRead,
  markAllAsRead,
  getUserNotifications,
};
