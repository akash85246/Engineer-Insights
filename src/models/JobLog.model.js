const mongoose = require("mongoose");

const jobLogSchema = new mongoose.Schema({
  jobName: { type: String, required: true },
  status: { type: String, required: true },
  message: { type: String },
  timestamp: { type: Date, default: Date.now },
});

const JobLog = mongoose.model("JobLog", jobLogSchema);

module.exports = JobLog;