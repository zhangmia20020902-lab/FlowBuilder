const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { query } = require("../config/database");

// 取得目前使用者的所有通知（列表頁）
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const notifications = await query(
      `SELECT id, user_id, type, reference_id, message, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.render("pos/notifications", {
      title: "Notifications - FlowBuilder",
      notifications,
    });
  } catch (err) {
    console.error("Error loading notifications:", err);
    res.status(500).render("shared/error", {
      message: "Error loading notifications",
      error: { status: 500, stack: err.stack },
    });
  }
});

// 單一通知：標記已讀（給舊的按鈕用，保留沒關係）
router.post("/:id/read", requireAuth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.session.userId;

    await query(
      `UPDATE notifications 
       SET is_read = TRUE 
       WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.status(500).json({ success: false });
  }
});

// 全部標記已讀（列表頁上方的「Mark All as Read」按鈕）
router.post("/read-all", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    await query(
      `UPDATE notifications 
       SET is_read = TRUE 
       WHERE user_id = ?`,
      [userId]
    );

    res.redirect("/notifications");
  } catch (err) {
    console.error("Error marking all notifications as read:", err);
    res.status(500).render("shared/error", {
      message: "Error updating notifications",
      error: { status: 500, stack: err.stack },
    });
  }
});

// ⭐ 點通知用：自動標記已讀 + 依身分導向正確的 RFQ 頁面
router.get("/open/:id", requireAuth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.session.userId;

    // 找出這則通知（一定要是自己的通知）
    const notifications = await query(
      `SELECT id, user_id, type, reference_id
       FROM notifications
       WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );

    if (!notifications || notifications.length === 0) {
      // 找不到就回列表頁
      return res.redirect("/notifications");
    }

    const notification = notifications[0];

    // 標記已讀
    await query(
      `UPDATE notifications 
       SET is_read = TRUE 
       WHERE id = ?`,
      [notificationId]
    );

    // 預設回通知列表
    let redirectUrl = "/notifications";

    // 如果是 RFQ 邀請，就依身分決定要去哪個詳細頁
    if (notification.type === "RFQ_INVITE" && notification.reference_id) {
      redirectUrl = `/rfqs/${notification.reference_id}`;
    }


    return res.redirect(redirectUrl);
  } catch (err) {
    console.error("Error opening notification:", err);
    res.redirect("/notifications");
  }
});

// ⭐ 提供 navbar 紅點用的 unread-count API
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const rows = await query(
      `SELECT COUNT(*) AS unread 
       FROM notifications 
       WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );

    res.json({ unread: rows[0].unread });
  } catch (err) {
    console.error("Error fetching unread count:", err);
    res.json({ unread: 0 });
  }
});

module.exports = router;
