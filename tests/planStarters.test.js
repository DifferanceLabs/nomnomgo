const {test}=require('node:test');
const assert=require('node:assert/strict');
const {emptyProfile,starterChoices}=require('../.route-import-test-build/src/domain/planStarters');
const example=(kind,extra={})=>({starter:'friends',context:'local',intent:'food',categories:['food'],people:[],at:'2026-01-01',kind,...extra});
test('all choices remain accessible for a new account',()=>{
 const choices=starterChoices(emptyProfile);
 assert.deepEqual(choices.map(c=>c.label),['Outing with the family','Father and son fun','Get together with friends']);
 assert.ok(choices.every(c=>!c.people.length));
});
test('explicit feedback outweighs many saves and completions and repeated renders are pure',()=>{
 const profile={...emptyProfile,signals:[...Array(25).fill(example('plan-created')),example('plan-completed'),example('different')]};
 assert.equal(starterChoices(profile).at(-1).id,'friends');
 assert.deepEqual(starterChoices(profile),starterChoices(profile));
 const positive={...emptyProfile,signals:[example('more')]};
 assert.equal(starterChoices(positive)[0].id,'friends');
});
test('travel and revoked companions cannot set lasting or inaccessible defaults',()=>{
 const profile={...emptyProfile,signals:[example('more',{context:'travel',people:['revoked']})]};
 assert.deepEqual(starterChoices(profile),starterChoices(emptyProfile));
 assert.deepEqual(starterChoices(profile,'travel')[0].people,[]);
});
test('group context selects only matching preferences and preserves individual defaults',()=>{
 const profile={...emptyProfile,people:[{id:'known',label:'A'}],signals:[example('more',{people:['known'],intent:'activity'}),example('plan-completed',{intent:'food'})]};
 assert.equal(starterChoices(profile,'local',['known'])[0].intent,'activity');
 assert.equal(starterChoices({...emptyProfile,favoriteCategories:['food']})[0].intent,'food');
});
