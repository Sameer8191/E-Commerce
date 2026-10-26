import Visitor from "../models/visitor.model.js";

export const recordVisitor = async (req, res) => {
  const visitorId = req.body?.visitorId;
  if (typeof visitorId !== "string" || !/^[a-f0-9-]{36}$/i.test(visitorId)) {
    return res.status(400).json({ success: false, message: "A valid anonymous visitor ID is required" });
  }
  try {
    await Visitor.updateOne({ visitorId }, { $setOnInsert: { visitorId, visitedAt: new Date() } }, { upsert: true });
    return res.status(202).json({ success: true });
  } catch (error) {
    if (error.code === 11000) return res.status(202).json({ success: true });
    console.error("Record visitor error:", error);
    return res.status(500).json({ success: false, message: "Could not record visit" });
  }
};
