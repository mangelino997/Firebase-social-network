
//const {db} = require('../util/admin.tsx');

const config = require('../util/config');

const firebase = require('firebase');
// Initialize Firebase
firebase.initializeApp(config);

const {
    validateSignupData,
    validateLoginData,
} = require("../util/validators");



let token = ""; let userId = "";
exports.signUp = (req: any, res: any) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };

    // errors and return errors if there
    const { valid, errors } = validateSignupData(newUser);
    if (!valid) return res.status(400).json(errors);

    // validate
    db.doc(`/users/ ${newUser.handle}`).get()
        .then((doc: any) => {
            if (doc.exists) {
                return res.status(400).json({ handle: 'this handle is already taken' });
            } else {
                return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password);
            }
        })
        .then((data: any) => {
            userId = data.user.uid;
            return data.user.getIdToken();
        })
        .then((tokn: any) => {
            token = tokn;
            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                userId: userId
            }
            return db.doc(`/users/${newUser.handle}`).set(userCredentials);
        })
        .then(() => {
            return res.status(201).json({ token });
        })
        .catch((err: any) => {
            if (err.code === 'auth/email-already-in-use')
                return res.status(400).json({ email: "Email is already in use." })
            else
                return res.status(500).json({ error: err.code })
        });
}

//
exports.login = (req: any, res: any) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    }

    let errors: any = {};
    if (isEmpty(user.email))
        errors.email = 'Email must not be empty';
    if (isEmpty(user.password))
        errors.email = 'Password must not be empty';

    // return errors if there
    if (Object.keys(errors).length > 0)
        return res.status(400).json(errors);

    firebase
        .auth()
        .signInWithEmailAndPassword(user.email, user.password)
        .then((data: any) => {
            return data.user.getIdToken();
        })
        .then((token: any) => {
            return res.json({ token });
        })
        .catch((err: any) => {
            console.error(err);
            // auth/wrong-password
            // auth/user-not-user
            return res
                .status(403)
                .json({ general: "Wrong credentials, please try again" });
        });
}