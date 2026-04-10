const adminSql = require('../models/admin_sql');

// Lay cau hinh hoa hong (Get commission config)
async function getCommissionConfig(req, res) {
  try {
    const enabled = await adminSql.getSystemConfig('AUTO_COMMISSION_ENABLED');
    const interval = await adminSql.getSystemConfig('AUTO_COMMISSION_INTERVAL');

    return res.json({
      success: true,
      data: {
        autoEnabled: enabled ? enabled.configValue === 'true' : false,
        interval: interval ? interval.configValue : 'MONTH',
        updatedAt: interval ? interval.updatedAt : null
      }
    });
  } catch (err) {
    console.error('Error getting commission config:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

// Cap nhat cau hinh hoa hong (Update commission config)
async function updateCommissionConfig(req, res) {
  try {
    const { autoEnabled, interval } = req.body;

    if (autoEnabled !== undefined) {
      await adminSql.updateSystemConfig('AUTO_COMMISSION_ENABLED', String(autoEnabled));
    }
    if (interval) {
      const allowed = ['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'];
      if (!allowed.includes(interval.toUpperCase())) {
        return res.status(400).json({ success: false, message: 'Invalid interval' });
      }
      await adminSql.updateSystemConfig('AUTO_COMMISSION_INTERVAL', interval.toUpperCase());
    }

    return res.json({ success: true, message: 'Commission config updated successfully' });
  } catch (err) {
    console.error('Error updating commission config:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

module.exports = {
  getCommissionConfig,
  updateCommissionConfig
};
