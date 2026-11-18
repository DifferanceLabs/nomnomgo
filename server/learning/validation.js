const actions = new Set(['learn.profile', 'learn.companion', 'learn.outing', 'learn.complete', 'learn.feedback']);
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
function learningData(action, body) {
  if (action === 'learn.profile') return {};
  if (action === 'learn.companion') {
    if (typeof body.label !== 'string' || !body.label.trim() || body.label.trim().length > 60) throw new Error('Choose a short companion name.');
    return { label: body.label.trim() };
  }
  const data = {};
  if (uuid.test(body.sharedId)) data.sharedId = body.sharedId;
  else if (typeof body.sourceKey === 'string' && body.sourceKey.length > 0 && body.sourceKey.length <= 200) data.sourceKey = body.sourceKey;
  else throw new Error('Choose a saved outing.');
  if (action === 'learn.feedback') {
    if (!['more','different','favorite'].includes(body.value)) throw new Error('Choose feedback.');
    data.value = body.value;
    if (body.value === 'favorite') {
      if (typeof body.placeId !== 'string' || !body.placeId || body.placeId.length > 200) throw new Error('Choose a saved place.');
      data.placeId = body.placeId;
    }
  }
  if (action === 'learn.complete' && body.actuals != null) {
    data.actuals = {};
    for (const [key,max] of [['durationMinutes',10080],['spendMinorUnits',100000000]]) {
      if (body.actuals[key] !== undefined) {
        if (!Number.isSafeInteger(body.actuals[key]) || body.actuals[key] < 0 || body.actuals[key] > max) throw new Error('Invalid actuals.');
        data.actuals[key] = body.actuals[key];
      }
    }
    if (data.actuals.spendMinorUnits !== undefined) {
      if (!/^[A-Z]{3}$/.test(body.actuals.currency || '')) throw new Error('Choose a currency.');
      data.actuals.currency = body.actuals.currency;
    }
  }
  return data;
}
module.exports = { actions, learningData };
