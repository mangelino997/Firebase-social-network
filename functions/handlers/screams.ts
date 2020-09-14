
const { db: any } = require("../util/admin.ts");
/* */
exports.getAllScreams = (req: any, res: any) => {
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
}

exports.postOneScream = (req: any, res: any) => {
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
}