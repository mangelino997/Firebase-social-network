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

// get db
const db = admin.firestore();

/* 
    handle token 
    para que funcione debe coincidir el uid del usuario en Athentication (web de firebase)
    con el uid del usuario registrado en Cloud Firestore --> users 
*/
const faAuth = (req: any, res: any, next: any) => {
    let idToken;
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer ')
    ) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        // No token found
        return res.status(403).json({ error: 'Unauthorized' });
    }

    admin
        .auth()
        .verifyIdToken(idToken)
        .then((decodedToken: any) => {
            //res.status(200).json(decodedToken );
            req.user = decodedToken;
            return db
                .collection('users')
                .where('userId', '==', decodedToken.uid)
                .limit(1)
                .get();
        })
        .then((data: any) => {
            req.user.handle = data.docs[0].data().handle;
            req.user.imageUrl = data.docs[0].data().imageUrl;
            return next();
        })
        .catch((err: any) => {
            // Error while verifying token 
            return res.status(403).json(err);
        });
};

// forma de hacer un endpoint con Express
app.get('/screams', (req: any, res: any) => {
    db
        .collection('screams')
        .orderBy('createdAt', 'desc') // para que el orderBy funcione hay que declararlo en Firestore -> indices
        .get()
        .then((data: any[]) => {
            let screams: any[] = [];
            data.forEach(element => {
                screams.push({
                    screamId: element.id,
                    body: element.data().body,
                    userHandle: element.data().userHandle,
                    createdAt: element.data().createdAt,
                    commentCount: element.data().commentCount,
                    likeCount: element.data().likeCount,
                    userImage: element.data().userImage
                });
            });
            return res.json(screams);
        })
        .catch((err: any) => console.log(err))
})

// post one screa,
app.post('/scream', faAuth, (req: any, res: any) => {
    if (req.body.body.trim() === '') {
        return res.status(400).json({ body: 'Body must not be empty' });
    }

    const newScream = {
        body: req.body.body,
        userHandle: req.user.handle, // este viene de faAuth
        userImage: req.user.imageUrl,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0
    };

    db.collection('screams')
        .add(newScream)
        .then((doc: any) => {
            const resScream: any = newScream;
            resScream.screamId = doc.id;
            res.json(resScream);
        })
        .catch((err: any) => {
            res.status(500).json({ error: 'something went wrong' });
        });
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

    // img
    const noImg = 'no-img.png';

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
                imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
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
                return res.status(500).json({ general: "Something went wrong, please try again." })
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
        .then((data: any) => {
            return data.user.getIdToken();
        })
        .then((token: any) => {
            return res.json({ token });
        })
        .catch((err: any) => {
            // auth/wrong-password
            // auth/user-not-user
            return res
                .status(403)
                .json({ general: "Wrong credentials, please try again" });
        });
})

/* upload img user
    install "npm i --save busboy" A node.js module for parsing incoming HTML form data.
    https://www.npmjs.com/package/busboy
*/
// Upload a profile image for user
app.post('/user/img', faAuth, (req: any, res: any) => {
    const BusBoy = require("busboy");
    const path = require("path");
    const os = require("os");
    const fs = require("fs");

    const busboy = new BusBoy({ headers: req.headers });

    let imageToBeUploaded: any = {};
    let imageFileName: any;
    // String for image token
    //let generatedToken = uuid();

    busboy.on("file", (fieldname: any, file: any, filename: any, encoding: any, mimetype: any) => {

        // fieldname, file, filename, encoding, mimetype
        if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
            return res.status(400).json({ error: "Wrong file type submitted" });
        }
        // my.image.png => ['my', 'image', 'png']
        const imageExtension = filename.split(".")[filename.split(".").length - 1];
        // 32756238461724837.png
        imageFileName = `${Math.round(
            Math.random() * 1000000000000
        ).toString()}.${imageExtension}`;
        const filepath = path.join(os.tmpdir(), imageFileName);
        imageToBeUploaded = { filepath, mimetype };
        file.pipe(fs.createWriteStream(filepath));
    });
    busboy.on("finish", () => {
        admin
            .storage()
            .bucket()
            .upload(imageToBeUploaded.filepath, {
                resumable: false,
                metadata: {
                    metadata: {
                        contentType: imageToBeUploaded.mimetype,
                        //Generate token to be appended to imageUrl
                        //firebaseStorageDownloadTokens: generatedToken,
                    },
                },
            })
            .then(() => {
                // Append token to url
                const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
                //const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media&token=${generatedToken}`;
                return db.doc(`/users/${req.user.handle}`).update({ imageUrl });
            })
            .then(() => {
                return res.json({ message: "image uploaded successfully" });
            })
            .catch((err: any) => {
                return res.status(500).json({ error: "something went wrong" });
            });
    });
    busboy.end(req.rawBody);
});


// get own user details
app.get('/user', faAuth, (req: any, res: any) => {
    let userData: any = {};
    db.doc(`/users/${req.user.handle}`)
        .get()
        .then((doc: any) => {
            if (doc.exists) {
                userData.credentials = doc.data();
                return db
                    .collection("likes")
                    .where("userHandle", "==", req.user.handle)
                    .get();
            }
        })
        .then((data: any) => {
            userData.likes = [];
            data.forEach((doc: any) => {
                userData.likes.push(doc.data());
            });
            return db
                .collection("notifications")
                .where("recipient", "==", req.user.handle)
                .orderBy("createdAt", "desc") // se crea el indice en cloud firestore
                .limit(10)
                .get();
        })
        .then((data: any) => {
            userData.notifications = [];
            data.forEach((doc: any) => {
                userData.notifications.push({
                    recipient: doc.data().recipient,
                    sender: doc.data().sender,
                    createdAt: doc.data().createdAt,
                    screamId: doc.data().screamId,
                    type: doc.data().type,
                    read: doc.data().read,
                    notificationId: doc.id,
                });
            });
            return res.json(userData);
        })
        .catch((err: any) => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
});

// Get any user's details
app.get('/user/:handle', (req: any, res: any) => {
    let userData: any = {};
    db.doc(`/users/${req.params.handle}`)
        .get()
        .then((doc: any) => {
            if (doc.exists) {
                userData.user = doc.data();
                return db
                    .collection("screams")
                    .where("userHandle", "==", req.params.handle)
                    .orderBy("createdAt", "desc")
                    .get();
            } else {
                return res.status(404).json({ errror: "User not found" });
            }
        })
        .then((data: any) => {
            userData.screams = [];
            data.forEach((doc: any) => {
                userData.screams.push({
                    body: doc.data().body,
                    createdAt: doc.data().createdAt,
                    userHandle: doc.data().userHandle,
                    userImage: doc.data().userImage,
                    likeCount: doc.data().likeCount,
                    commentCount: doc.data().commentCount,
                    screamId: doc.id,
                });
            });
            return res.json(userData);
        })
        .catch((err: any) => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
});

// add detail user
app.post('/user', faAuth, (req: any, res: any) => {
    let userDetails = reduceUserDetails(req.body);

    db.doc(`/users/${req.user.handle}`)
        .update(userDetails)
        .then(() => {
            return res.json({ message: "Details added successfully" });
        })
        .catch((err: any) => {
            return res.status(500).json({ error: err.code });
        });
});

const reduceUserDetails = (data: any) => {
    let userDetails: any = {};

    if (!isEmpty(data.bio.trim())) userDetails.bio = data.bio;
    if (!isEmpty(data.website.trim())) {

        // https://website.com
        if (data.website.trim().substring(0, 4) !== 'http') {
            userDetails.website = `http://${data.website.trim()}`;
        } else userDetails.website = data.website;
    }
    if (!isEmpty(data.location.trim())) userDetails.location = data.location;

    return userDetails;
};

app.post('/notifications', faAuth, (req: any, res: any) => {
    let batch = db.batch();
    req.body.forEach((notificationId: any) => {
        const notification = db.doc(`/notifications/${notificationId}`);
        batch.update(notification, { read: true });
    });
    batch
        .commit()
        .then(() => {
            return res.json({ message: "Notifications marked read" });
        })
        .catch((err: any) => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
});

// Fetch one scream
app.get('/scream/:screamId', (req: any, res: any) => {
    let screamData: any = {};
    db.doc(`/screams/${req.params.screamId}`)
        .get()
        .then((doc: any) => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'Scream not found' });
            }
            screamData = doc.data();
            screamData.screamId = doc.id;
            return db
                .collection('comments')
                .orderBy('createdAt', 'desc')
                .where('screamId', '==', req.params.screamId)
                .get();
        })
        .then((data: any) => {
            screamData.comments = [];
            data.forEach((doc: any) => {
                screamData.comments.push(doc.data());
            });
            return res.json(screamData);
        })
        .catch((err: any) => {
            console.error(err);
            res.status(500).json({ error: err.code });
        });
});

// Comment on a comment
app.post('/scream/:screamId/comment', faAuth, (req: any, res: any) => {
    if (req.body.body.trim() === '')
        return res.status(400).json({ comment: 'Must not be empty' });

    const newComment = {
        body: req.body.body,
        createdAt: new Date().toISOString(),
        screamId: req.params.screamId,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl
    };
    console.log(newComment);

    db.doc(`/screams/${req.params.screamId}`)
        .get()
        .then((doc: any) => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'Scream not found' });
            }
            return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
        })
        .then(() => {
            return db.collection('comments').add(newComment);
        })
        .then(() => {
            res.json(newComment);
        })
        .catch((err: any) => {
            console.log(err);
            res.status(500).json({ error: 'Something went wrong' });
        });
});

// Like a scream
app.get('/scream/:screamId/like', faAuth, (req: any, res: any) => {
    const likeDocument = db
        .collection('likes')
        .where('userHandle', '==', req.user.handle)
        .where('screamId', '==', req.params.screamId)
        .limit(1);

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);

    let screamData: any;

    screamDocument
        .get()
        .then((doc: any) => {
            if (doc.exists) {
                screamData = doc.data();
                screamData.screamId = doc.id;
                return likeDocument.get();
            } else {
                return res.status(404).json({ error: 'Scream not found' });
            }
        })
        .then((data: any) => {
            if (data.empty) {
                return db
                    .collection('likes')
                    .add({
                        screamId: req.params.screamId,
                        userHandle: req.user.handle
                    })
                    .then(() => {
                        screamData.likeCount++;
                        return screamDocument.update({ likeCount: screamData.likeCount });
                    })
                    .then(() => {
                        return res.json(screamData);
                    });
            } else {
                return res.status(400).json({ error: 'Scream already liked' });
            }
        })
        .catch((err: any) => {
            console.error(err);
            res.status(500).json({ error: err.code });
        });
});

// unlike scream
app.get('/scream/:screamId/unlike', faAuth, (req: any, res: any) => {
    const likeDocument = db
        .collection('likes')
        .where('userHandle', '==', req.user.handle)
        .where('screamId', '==', req.params.screamId)
        .limit(1);

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);

    let screamData: any;

    screamDocument
        .get()
        .then((doc: any) => {
            if (doc.exists) {
                screamData = doc.data();
                screamData.screamId = doc.id;
                return likeDocument.get();
            } else {
                return res.status(404).json({ error: 'Scream not found' });
            }
        })
        .then((data: any) => {
            if (data.empty) {
                return res.status(400).json({ error: 'Scream not liked' });
            } else {
                return db
                    .doc(`/likes/${data.docs[0].id}`)
                    .delete()
                    .then(() => {
                        screamData.likeCount--;
                        return screamDocument.update({ likeCount: screamData.likeCount });
                    })
                    .then(() => {
                        res.json(screamData);
                    });
            }
        })
        .catch((err: any) => {
            console.error(err);
            res.status(500).json({ error: err.code });
        });
});

// Delete a scream
app.delete('/scream/:screamId', faAuth, (req: any, res: any) => {
    const document = db.doc(`/screams/${req.params.screamId}`);
    document
        .get()
        .then((doc: any) => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'Scream not found' });
            }
            if (doc.data().userHandle !== req.user.handle) {
                return res.status(403).json({ error: 'Unauthorized' });
            } else {
                return document.delete();
            }
        })
        .then(() => {
            res.json({ message: 'Scream deleted successfully' });
        })
        .catch((err: any) => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
});
// URL base https://base.com/api/
export const api = functions.https.onRequest(app);

// Notifications
exports.createNotificationOnLike = functions
    .region('us-central1')
    .firestore.document('likes/{id}')
    .onCreate((snapshot) => {
        return db
            .doc(`/screams/${snapshot.data().screamId}`)
            .get()
            .then((doc: any) => {
                if (
                    doc.exists &&
                    doc.data().userHandle !== snapshot.data().userHandle
                ) {
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        type: 'like',
                        read: false,
                        screamId: doc.id
                    });
                }
            })
            .catch((err: any) => console.error(err));
    });
exports.deleteNotificationOnUnLike = functions
    .region('us-central1')
    .firestore.document('likes/{id}')
    .onDelete((snapshot) => {
        return db
            .doc(`/notifications/${snapshot.id}`)
            .delete()
            .catch((err: any) => {
                console.error(err);
                return;
            });
    });
exports.createNotificationOnComment = functions
    .region('us-central1')
    .firestore.document('comments/{id}')
    .onCreate((snapshot) => {
        return db
            .doc(`/screams/${snapshot.data().screamId}`)
            .get()
            .then((doc: any) => {
                if (
                    doc.exists &&
                    doc.data().userHandle !== snapshot.data().userHandle
                ) {
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        type: 'comment',
                        read: false,
                        screamId: doc.id
                    });
                }
            })
            .catch((err: any) => {
                console.error(err);
                return;
            });
    });

// handle change image for user
exports.onUserImageChange = functions
    .region('us-central1')
    .firestore.document('/users/{userId}')
    .onUpdate((change) => {
        if (change.before.data().imageUrl !== change.after.data().imageUrl) {
            const batch = db.batch();
            return db
                .collection('screams')
                .where('userHandle', '==', change.before.data().handle)
                .get()
                .then((data: any) => {
                    data.forEach((doc: any) => {
                        const scream = db.doc(`/screams/${doc.id}`);
                        batch.update(scream, { userImage: change.after.data().imageUrl });
                    });
                    return batch.commit();
                });
        } else return true;
    });

// handle trigger for delete posts / screams
exports.onScreamDelete = functions
    .region('us-central1')
    .firestore.document('/screams/{screamId}')
    .onDelete((snapshot, context) => {
        const screamId = context.params.screamId;
        const batch = db.batch();
        return db
            .collection('comments')
            .where('screamId', '==', screamId)
            .get()
            .then((data: any) => {
                data.forEach((doc: any) => {
                    batch.delete(db.doc(`/comments/${doc.id}`));
                });
                return db
                    .collection('likes')
                    .where('screamId', '==', screamId)
                    .get();
            })
            .then((data: any) => {
                data.forEach((doc: any) => {
                    batch.delete(db.doc(`/likes/${doc.id}`));
                });
                return db
                    .collection('notifications')
                    .where('screamId', '==', screamId)
                    .get();
            })
            .then((data: any) => {
                data.forEach((doc: any) => {
                    batch.delete(db.doc(`/notifications/${doc.id}`));
                });
                return batch.commit();
            })
            .catch((err: any) => console.error(err));
    });
