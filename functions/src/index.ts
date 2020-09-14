import * as functions from 'firebase-functions';
const admin = require('firebase-admin');
admin.initializeApp();
const app = require('express')();

const config = {
    apiKey: "AIzaSyCwwgm8EvRqUKdu1afNvAbYbdodnHKEeiw",
    authDomain: "react-social-network-6b4e1.firebaseapp.com",
    databaseURL: "https://react-social-network-6b4e1.firebaseio.com",
    projectId: "react-social-network-6b4e1",
    storageBucket: "react-social-network-6b4e1.appspot.com",
    messagingSenderId: "626199538337",
    appId: "1:626199538337:web:64b8a60e18ec1adfa25ee0",
    measurementId: "G-3CEH9BP7B4"
};

const firebase = require('firebase');
// Initialize Firebase
firebase.initializeApp(config);


// forma de hacer un endpont con Firebase
// export const getScreams = functions.https.onRequest((req, res) => {
//     admin.firestore().collection('screams').get()
//         .then((data: any[]) => {
//             let screams: any[] = [];

//             data.forEach(element => {
//                 screams.push(element.data());
//             });
//             return res.json(screams);
//         })
//         .catch((err: any) => console.log(err))
// })

// get db
const db = admin.firestore();

// forma de hacer un endpoint con Express
app.get('/screams', (req: any, res: any) => {
    db
        .collection('screams')
        .orderBy('createdAt', 'desc')
        .get()
        .then((data: any[]) => {
            let screams: any[] = [];
            data.forEach(element => {
                screams.push({
                    screamId: element.id,
                    body: element.data().body,
                    userHandle: element.data().userHandle,
                    createdAt: element.data().createdAt
                });
            });
            return res.json(screams);
        })
        .catch((err: any) => console.log(err))
})

app.post('/scream', (req: any, res: any) => {
    const newScream = {
        body: req.body.body,
        userHandle: req.body.userHandle,
        createdAt: new Date().toISOString()
    }

    db
        .collection('screams')
        .add(newScream)
        .then((doc: any) => {
            res.json({ message: `document ${doc.id} created successfully` })
        })
        .catch((err: any) => res.status(500).json({ error: 'something went wrong' }))
})

// valida si el campo esta vacio
const isEmpty = (field: string) => {
    if (field.trim() === '')
        return true
    else
        return false;
}

// valida si el email es correcto
const isEmail = (email: string) => {
    const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (email.match(emailRegEx))
        return true;
    else
        return false;
}

// Sign up route
let token = ""; let userId = "";
app.post('/signup', (req: any, res: any) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };

    // errors
    let errors: any = {};
    if (isEmpty(newUser.email))
        errors.email = 'Email must not be empty';
    else if (!isEmail(newUser.email))
        errors.email = 'Must be a valid Email';
    if (isEmpty(newUser.password))
        errors.password = 'Must not be empty';
    if (newUser.password !== newUser.confirmPassword)
        errors.confirmPassword = 'Passwords must match'; //la contrasenia no puede ser debil >5 caract
    if (isEmpty(newUser.handle))
        errors.handle = 'Handle must not be empty';

    // return errors if there
    if (Object.keys(errors).length > 0)
        return res.status(400).json(errors);

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
});

// Login
app.post('/login', (req: any, res: any) => {
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
        .then((data:any) => {
          return data.user.getIdToken();
        })
        .then((token:any) => {
          return res.json({ token });
        })
        .catch((err:any) => {
          console.error(err);
          // auth/wrong-password
          // auth/user-not-user
          return res
            .status(403)
            .json({ general: "Wrong credentials, please try again" });
        });
})


// URL base https://base.com/api/
export const api = functions.https.onRequest(app);