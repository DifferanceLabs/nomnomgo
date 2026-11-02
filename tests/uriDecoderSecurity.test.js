const test = require('node:test');
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const queryString = require('query-string');

test('legacy navigation query parsing retains Unicode, duplicate keys and malformed escapes', () => {
  assert.deepEqual({ ...queryString.parse('name=%C3%A5&tag=one&tag=two&bad=%zz') }, {
    bad: '%zz', name: 'å', tag: ['one', 'two'],
  });
  const input = { name: '日本語 & café', route: 'a/b?c=d' };
  assert.deepEqual({ ...queryString.parse(queryString.stringify(input)) }, input);
});

test('malformed percent runs finish within a bounded worker deadline', { timeout: 8000 }, async () => {
  await new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      const parse = require(workerData).parse;
      let value = '';
      for (let i = 0; i < 32000; i += 1) {
        value += '%' + Math.floor(i / 256).toString(16).padStart(2, '0')
          + '%' + (i % 256).toString(16).padStart(2, '0') + 'x';
      }
      const result = parse('value=' + value + '%zz');
      parentPort.postMessage(typeof result.value === 'string' && result.value.endsWith('%zz'));
    `, { eval: true, workerData: require.resolve('query-string') });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error('Navigation decoder exceeded its 3-second deadline'));
    }, 3000);
    worker.once('error', error => { clearTimeout(timer); reject(error); });
    worker.once('message', value => {
      clearTimeout(timer);
      void worker.terminate();
      try { assert.equal(value, true); resolve(); } catch (error) { reject(error); }
    });
  });
});
