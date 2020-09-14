/* 

*/
const admin = require('firebase-admin');
admin.initializeApp();
// get db
const db = admin.firestore();

module.exports = {admin, db};