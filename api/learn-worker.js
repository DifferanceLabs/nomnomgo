const { createHash, timingSafeEqual } = require('node:crypto');
const { processOne } = require('../server/learning/worker');
const digest = value => createHash('sha256').update(value).digest();
module.exports = async function worker(req,res) {
  res.setHeader('Cache-Control','no-store');
  const secret=process.env.CRON_SECRET;
  if (!secret || !timingSafeEqual(digest(String(req.headers.authorization || '')),digest('Bearer '+secret))) return res.status(401).end();
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const started=Date.now();
    const batch=[];
    do {
      const metrics=await processOne();
      batch.push(metrics);
      console.info('nng_learning_worker',metrics);
      if (['idle','disabled','retry','rejected'].includes(metrics.status)) break;
    } while (batch.length<10 && Date.now()-started<12000);
    return res.status(200).json({batch});
  } catch { return res.status(503).json({status:'queue_unavailable'}); }
};
