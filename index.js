const express = require("express");
const app = express();
const cors = require('cors');
require('dotenv').config();
const multer = require('multer')
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const path = require("path");
const fs = require('fs');
const ObjectId = require('mongodb').ObjectId;
const { MongoClient, ServerApiVersion } = require('mongodb');
const { isArray } = require("util");
const { query } = require("express");
const { json } = require("body-parser");
const SSLCommerzPayment = require('sslcommerz-lts');
const shortid = require("shortid");
const nodemailer = require("nodemailer");
const sharp = require("sharp");
const port = process.env.PORT || 5000;


//sslcommorze intregration start here

const store_id = process.env.SSL_STORE_ID;
const store_passwd = process.env.SSL_STORE_PASS;
const is_live = false //true for live, false for sandbox

//sslcommorze intregration start here

//middleware

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded(
    { extended: true }
));
app.use(bodyParser.json());
// app.use(express.static(__dirname + 'products'));
app.use('/products', express.static('products'))
// iimage upload
const UPLOADS_FOLDER = "./products/";
// difine the sorage

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_FOLDER)
    },
    filename: (req, file, cb) => {
        const fileEXt = path.extname(file.originalname);
        const fileName = file.originalname.replace(fileEXt, '').toLocaleLowerCase().split(" ").join("-") + "-" + Date.now();
        cb(null, fileName + fileEXt);
    },
});
const upload = multer({

    storage: storage,
    limits: {
        fileSize: 10200000, // 10.2MB
    },
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === "image/jpg" ||
            file.mimetype === "image/png" ||
            file.mimetype === "image/jpeg"
        ) {
            cb(null, true)
        }
        else {
            cb(new Error("Only .jpg, .png, .jpeg format allowed!"))
        }
    },

});

// send mail for client invoice
const emailSenderOptions = {
    service: 'gmail',
    auth: {
        user: 'shopinshopbd12@gmail.com',
        pass: 'ajcxdmrlnzfemnvq'
    }
};

const emailClient = nodemailer.createTransport(emailSenderOptions);

function sendOrderEmail(orderInfo, status) {
    const { customerEmail, customerName, orderID, date, time } = orderInfo;

    var email = {
        from: 'shopinshopbd12@gmail.com',
        to: customerEmail,
        subject: `Your order has been ${status === 'Cancel' ? 'Cancelled' : status}. Your order ID is ${orderID}. Time ${date} : ${time}`,
        text: `Your order has been ${status}. Your order ID is ${orderID}. Time ${date} ${time}. We will deliver your product to you very quickly. Thank You`,
        html: `
        <div>
          <p> Hello ${customerName}, </p>
          <h3>Your order has been ${status}</h3>
          <p>${status === 'confirmed' ? 'We will deliver your product to you very quickly' : 'We are unable to confirm your order due to a problem'}. <a href='${process.env.CLIENT_URL}/track-order/${orderID}'>Click</a> on  this link to track your order or check your order status by visiting your profile. <br>Thank You</b> </p>
          
          <h3>Shop in Shop BD</h3>
          <p>530/A, Baridhara-DOHS, Dhaka-1206,Bangladesh</p>
          <p>Bangladesh</p>
          <p><b>Phone : </b>+880178057784</p>
          <p><b>Email : </b>shopinshopbd12@gmail.com</p>
          
        </div>
      `
    };

    emailClient.sendMail(email, function (err, info) {
        if (err) {
            console.log(err);
        }
        else {
            console.log('Message sent: ', info);
        }
    });

};



// send mail for client invoice end




//all user access token verify
const verifyJwt = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized Access' });

    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    });
};




// connected database

const uri = `mongodb+srv://Daily_picks:KYioBFfryp2v2P8l@dailypicks0.6bhcfje.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



// created all api
async function run() {
    try {
        await client.connect();
        const categoriesCollection = client.db("Daily_picks_DB").collection('Categories');
        const productsCollection = client.db("Daily_picks_DB").collection('Products');
        const adminUsersCollection = client.db("Daily_picks_DB").collection('AdminUsers');
        const ordersCollection = client.db("Daily_picks_DB").collection('Orders');
        const couponsCollection = client.db("Daily_picks_DB").collection('Coupons');
        const sliderCollection = client.db("Daily_picks_DB").collection('Slider');
        const customersCollection = client.db("Daily_picks_DB").collection('Customers');
        const paymentInfoCollection = client.db("Daily_picks_DB").collection('paymentInfo');
        const reviewoCollection = client.db("Daily_picks_DB").collection('review');
        const acountCollection = client.db("Daily_picks_DB").collection('acount');
        const analycsCollection = client.db("Daily_picks_DB").collection('analycs');
        const analycsMonthCollection = client.db("Daily_picks_DB").collection('monthAnalycs');


        // admin is verify ?
        // verify admin
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await adminUsersCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            } else {
                res.status(403).send({ message: 'forbidden' });
            }
        };

        // // test mail
        // app.get('/mail/send', async (req, res) => {
        //     sendAppointmentEmail();
        //     console.log(sendAppointmentEmail)
        // })


        // user all api start here
        // all user information api
        app.put('/adminUser/:email', async (req, res) => {
            const email = req.params.email;
            const adminUser = req.body;
            const filter = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: adminUser,
            };
            const result = await adminUsersCollection.updateOne(filter, updateDoc, options);
            if (adminUser.phone) {
                res.send({ result });
            }
            else {
                const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '30d' });
                res.send({ result, token });
            }
        });


        //nid upload machent
        app.put('/adminUser/nid/upload/:email', verifyJwt, upload.fields([
            { name: 'logo', maxCount: 1 },
            { name: 'nid', maxCount: 1 },
            { name: 'bin', maxCount: 1 },
        ]), async (req, res) => {
            const email = req.params.email;
            const logo = req.files.logo[0].path;
            const nid = req.files.nid[0].path;
            const bin = req.files.bin[0].path;
            const filter = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    logo: logo,
                    bin: bin,
                    nid: nid
                },
            };

            const VerifyID = await adminUsersCollection.findOne({ email: email });

            if (VerifyID.bin && VerifyID.logo && VerifyID.nid) {
                const Path1 = VerifyID.logo;
                const Path2 = VerifyID.bin;
                const Path3 = VerifyID.nid;

                fs.unlink(Path1, (err) => {
                    if (err) {
                        console.error(err)
                        return
                    }
                });
                fs.unlink(Path2, (err) => {
                    if (err) {
                        console.error(err)
                        return
                    }
                });
                fs.unlink(Path3, (err) => {
                    if (err) {
                        console.error(err)
                        return
                    }
                });
            }

            const result = await adminUsersCollection.updateOne(filter, updateDoc, options);
            res.send({ result });
        });

        // make admin
        app.put('/adminUser/admin/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAcount = await adminUsersCollection.findOne({ email: requester });
            if (requesterAcount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await adminUsersCollection.updateOne(filter, updateDoc);
                res.send(result);

            }
            else {
                res.status(403).send({ message: "Forbidden" });
            }

        });

        // get all adminUser 
        app.get('/adminUser', verifyJwt, async (req, res) => {

            const userName = req.query.name;
            const pages = req.query.page;

            const filter = {
                name: {
                    $regex: userName.toString(), "$options": "i"
                }
            };

            let adminUser;
            if (pages >= 0) {
                adminUser = await adminUsersCollection.find(filter).skip(pages * 10).limit(10).sort({ "_id": -1 }).toArray();
            }
            else if (userName) {
                adminUser = await adminUsersCollection.find(filter).sort({ "_id": -1 }).toArray();
            }
            else {
                adminUser = await adminUsersCollection.find().sort({ "_id": -1 }).toArray();
            }

            res.send(adminUser);

        });


        //get email === email user

        app.get('/adminUser/user/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAcount = await adminUsersCollection.findOne({ email: requester });

            res.send(requesterAcount);
        })


        // user update profile 
        app.put('/adminUser/Update_profile/:id', async (req, res) => {
            const id = req.params.id;
            const image = req.body.img;
            const phone = req.body.phone;

            const filter = { _id: ObjectId(id) };
            if (image && phone) {
                const options = { upsert: true };

                const updateDoc = {
                    $set: { image: image, phone: phone },
                };
                const result = await adminUsersCollection.updateMany(filter, updateDoc);
                res.send(result);
            }
            else if (image) {
                const options = { upsert: true };

                const updateDoc = {
                    $set: { image: image },
                };
                const result = await adminUsersCollection.updateMany(filter, updateDoc);
                res.send(result);
            }
            else {
                const options = { upsert: true };

                const updateDoc = {
                    $set: { phone: phone },
                };
                const result = await adminUsersCollection.updateMany(filter, updateDoc);
                res.send(result);
            }


        })

        // get admin api

        app.get('/adminUser/:email', async (req, res) => {
            const email = req.params.email;
            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";
            res.send({ admin: isAdmin });
        });

        // delete admin user

        app.delete('/adminUser/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await adminUsersCollection.deleteOne(query);
            res.send(result);
        });
        //email verifacition status update
        app.put('/adminUser/admin/verify/:email', async (req, res) => {
            const email = req.params.email;
            const emailVerified = req.body.emailVerified;
            const filter = { email: email };

            const options = { upsert: true };
            const updateDoc = {
                $set: { emailVerified },
            };
            const result = await adminUsersCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        // appcpt merchent 

        app.put('/adminUser/admin/accept/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body.status;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: { status },
            };
            const result = await adminUsersCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        // pagination api start 

        //user  count 

        app.get('/userCount', async (req, res) => {
            const count = await adminUsersCollection.estimatedDocumentCount();
            res.send({ count });
        });



        // admin user all api end here




        //============================
        //category all api or route creatyed statrt
        //===========================
        // all general category

        app.get('/category/all', verifyJwt, async (req, res) => {
            const cursor = await categoriesCollection.find().toArray();
            res.send(cursor);
        });


        // get all category
        app.get('/category', verifyJwt, verifyAdmin, async (req, res) => {
            const name = req.query.name;
            const query = {
                "category.name": {
                    $regex: name.toString(), "$options": "i"
                }
            };

            if (name) {
                const cursor = categoriesCollection.find(query);
                const categories = await cursor.toArray();
                res.send({ categories });
            }
            else {
                const cursor = categoriesCollection.find({});
                const categories = await cursor.toArray();
                res.send({ categories });
            }
        });

        // add and update category
        app.put('/category/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updatecategory = req.body;
            const query = { _id: ObjectId(id) };
            const options = { upsert: true };

            const updateDoc = {
                $set: {
                    category: updatecategory.newCategory,
                }
            };
            const result = await categoriesCollection.updateOne(query, updateDoc, options);
            res.send(result);

        });

        // update category
        app.put('/categoryStatus/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const categoryStatus = req.body;
            const value = categoryStatus.status.value
            const query = {
                "category.slug": categoryStatus.status.slug,
            };

            const options = {
                upsert: true,

            };
            const updateDoc = {
                $set: {
                    "category.$.status": value
                },
            };
            const result = await categoriesCollection.updateOne(
                query,
                updateDoc,
                options,
            );
            res.send(result);

        });



        // delete category 
        app.put('/category/delete/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const deleteInfo = req.body;
            const query = {
                "category.name": deleteInfo.name,
            };

            const updateDoc = {
                $pull: { "category": { "name": deleteInfo.name } }
            }
            const result = await categoriesCollection.updateOne(
                query,
                updateDoc,
            );
            res.send(result);

        });


        // update all category
        app.put('/category/update/all/:name', verifyJwt, verifyAdmin, async (req, res) => {
            const name = req.params.name;
            const updateCategory = req.body;
            const query = { 'category.slug': name }
            const updateDoc = {
                $set: { "category.$": updateCategory }
            }
            const result = await categoriesCollection.updateOne(query, updateDoc, { "upsert": true });
            res.send(result);
        });

        // delete sub category
        app.put('/subCategory/delete/:slug', verifyJwt, verifyAdmin, async (req, res) => {
            const categorySlug = req.params.slug;
            const subCategorySlug = req.body.slug;

            const result = await categoriesCollection.updateOne({ "category.slug": categorySlug }, {
                "$pull": {
                    "category.$.subCategory": {
                        "slug": subCategorySlug
                    }
                }
            });

            res.send(result);
        });


        //============================
        // category all api end here
        //===========================



        //============================
        //order database start here
        //===========================

        //all order list for admin 

        app.get('/order/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const product = req.query.name || '';
            const pages = req.query.page;
            const status = req.query.status || '';

            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";


            let orders;
            if (!isAdmin) {
                const query = {
                    'products.marchentEmail': email,

                    orderID: {
                        $regex: product.toString(), "$options": "i"
                    },
                    status: {
                        $regex: status.toString(), "$options": "i"
                    }
                };



                if (pages >= 0) {
                    orders = await ordersCollection.find(query).skip(parseInt(pages) * 10).limit(10).sort({ "_id": -1 }).toArray();

                    for (let x of orders) {
                        x.products = x.products.filter(y => y.marchentEmail === email);
                        // x.totalPrice = x.products.map(p => p.productTotalPrice).toString();
                        x.totalPrice = x.products.reduce(
                            (previousValue, currentValue) => previousValue + currentValue.productTotalPrice,
                            0
                        );
                    }


                }
                else if (product || status) {
                    orders = await ordersCollection.find(query).sort({ "_id": -1 }).toArray();

                    for (let x of orders) {
                        x.products = x.products.filter(y => y.marchentEmail === email);
                        // x.totalPrice = x.products.map(p => p.productTotalPrice).toString();
                        x.totalPrice = x.products.reduce(
                            (previousValue, currentValue) => previousValue + currentValue.productTotalPrice,
                            0
                        );
                    }
                }
            }
            if (isAdmin) {
                const query = {
                    orderID: {
                        $regex: product.toString(), "$options": "i"
                    },
                    status: {
                        $regex: status.toString(), "$options": "i"
                    }
                };

                if (pages >= 0) {
                    orders = await ordersCollection.find(query).skip(parseInt(pages) * 10).limit(10).sort({ "_id": -1 }).toArray();
                }
                else if (product || status) {
                    orders = await ordersCollection.find(query).sort({ "_id": -1 }).toArray();
                }
            }

            // else {
            //     orders = await ordersCollection.find({ marchentEmail: email }).toArray();
            // }

            res.send(orders);

        });


        //order count 
        app.get('/order/dashboard/count/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const count = await ordersCollection.countDocuments({ 'products.marchentEmail': email });
            res.send({ count });
        });

        // update order status

        app.put('/order/status/:id', verifyJwt, async (req, res) => {
            const email = req.query.email;
            const id = req.params.id;
            const status = req.body.value;
            const options = { upsert: true };
            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";
            // console.log(email)
            if (isAdmin) {
                const query = { _id: ObjectId(id) };
                const updateDoc = {
                    $set: {
                        status: status,
                    }
                };
                const result = await ordersCollection.updateOne(query, updateDoc, options);
                res.send(result);
            }
            else {

                const results = await ordersCollection.findOne({ _id: ObjectId(id), products: { $elemMatch: { marchentEmail: email } } });

                const final = [];
                for (let x of results.products) {
                    if (x.marchentEmail === email) {
                        x.status = status
                    }
                    final.push(x)
                }
                // console.log(final)


                const result = await ordersCollection.updateMany({ _id: ObjectId(id), products: { $elemMatch: { marchentEmail: email } } }, { $set: { products: final } }, options);
                res.send(result);
            }


        });



        // app.get('/orderCount', async (req, res) => {

        //     const count = await ordersCollection.estimatedDocumentCount();
        //     res.send({ count });
        // });


        //============================
        //order database end here
        //===========================




        //============================
        //Product  database start here
        //===========================

        app.post('/product', verifyJwt, upload.fields([
            { name: 'primaryImage', maxCount: 1 },
            { name: 'secondImage', maxCount: 5 },

        ]), async (req, res) => {
            const today = new Date();
            const { filename: img } = req.files.primaryImage[0];

            if (img) {
                await sharp(req.files.primaryImage[0].path)
                    .resize(1200, 1200, {
                        fit: sharp.fit.contain,
                        background: 'white'
                    })
                    .jpeg({ quality: 100 })
                    .toFile(
                        path.resolve(req.files.primaryImage[0].destination, 'productResized', img)

                    )

                fs.unlinkSync(req.files.primaryImage[0].path)
            }


            const primaryImage = `products/productResized/${img}`;
            // console.log(primaryImage)
            let secondImage = [];
            const secondImagepath = req.files.secondImage ? req.files.secondImage.map((secondPath, index) => req.files.secondImage[index].path) : [];
            // console.log(secondImagepath[0])
            if (secondImagepath.length > 0) {
                for (let x in req.files.secondImage) {
                    const { filename: secondImgName } = req.files.secondImage[x]
                    await sharp(req.files.secondImage[x].path)
                        .resize(1200, 1200, {
                            // fit: sharp.fit.contain, //image full but show background 
                            fit: sharp.fit.contain,
                            background: 'white'

                        })
                        .jpeg({ quality: 100 })
                        .toFile(
                            path.resolve(req.files.secondImage[x].destination, 'productResized', secondImgName)
                        )

                    fs.unlinkSync(req.files.secondImage[x].path);
                    secondImage.push(`products/productResized/${secondImgName}`)
                }
            };
            const productName = req.body.productName;
            const sku = req.body.sku;
            const shortDescription = req.body.shortDescription;
            const logDescription = req.body.logDescription;
            const price = req.body.price;
            const quantity = parseInt(req.body.quantity);
            const deliveryInDhaka = req.body.deliveryInDhaka;
            const outDhaka = req.body.outDhaka;
            const color = req.body.color;
            const size = req.body.size;
            const marchentShop = req.body.marchentShop;
            const marchentEmail = req.body.marchentEmail;
            const marchantPhone = req.body.marchantPhone;
            const brand = req.body.brand;

            let mainCategoryID = JSON.parse(req.body.mainCategory);
            let subCategory = JSON.parse(req.body.SubCategory);
            let category = JSON.parse(req.body.category);
            let productPromo = JSON.parse(req.body.productPromo);

            const orderType = req.body.orderType;
            const sPrice = req.body.sPrice;
            const video = req.body.video;
            const sulg = productName.split(" ").join("_") + "-" + Date.now();
            const date = today.getDate() + '-' + (today.getMonth() + 1) + '-' + today.getFullYear();
            const time = today.toLocaleString('en-US', {
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            });


            // console.log(logDescription === '')

            const productInfo = {
                productName, sku, sPrice, productPromo, brand, mainCategoryID, subCategory, category, orderType, shortDescription, logDescription, price, quantity, deliveryInDhaka, outDhaka, color, size, marchentShop, marchentEmail, marchantPhone, primaryImage, secondImage, sulg, status: 'Pending', date, time, video
            }

            const result = await productsCollection.insertOne(productInfo);
            res.send(result);


        });

        app.get('/product/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const productNames = req.query.name;
            const pages = req.query.page;

            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";
            const projection = { marchentEmail: 1 };
            let products;

            if (!isAdmin) {
                const query = {
                    marchentEmail: email,
                    $or: [{
                        productName: {
                            $regex: productNames.toString(), "$options": "i"
                        }
                    }, {
                        sku: {
                            $regex: productNames.toString(), "$options": "i"
                        }
                    },

                    ],

                };

                if (pages >= 0) {
                    products = await productsCollection.find(query).skip(parseInt(pages) * 50).limit(50).sort({ "_id": -1 }).toArray();

                }
                else if (productNames) {
                    products = await productsCollection.find(query).sort({ "_id": -1 }).toArray();
                } else {
                    products = await productsCollection.find({ marchentEmail: email }).sort({ "_id": -1 }).toArray();
                }
                // console.log('marchent')
            }


            if (isAdmin) {
                const query = {

                    $or: [{
                        productName: {
                            $regex: productNames.toString(), "$options": "i"
                        }
                    }, {
                        sku: {
                            $regex: productNames.toString(), "$options": "i"
                        }
                    },

                    ],
                };
                if (pages >= 0) {
                    products = await productsCollection.find(query).skip(parseInt(pages) * 50).limit(50).sort({ "_id": -1 }).toArray();
                }
                else if (productNames) {
                    products = await productsCollection.find(query).sort({ "_id": -1 }).toArray();
                }
                else {
                    products = await productsCollection.find().sort({ "_id": -1 }).toArray();
                }


            }



            res.send(products);


        });


        //product count 
        app.get('/products/dashboard/count/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";
            if (!isAdmin) {
                const count = await productsCollection.countDocuments({ marchentEmail: email });
                res.send({ count });
            }
            else {
                const count = await productsCollection.countDocuments();
                // console.log(count)
                res.send({ count });

            }

        });

        app.delete('/product/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const primary = req.query.path;
            const secondery = req.query.secondPath;
            const seconderyImagePath = secondery.split(",");
            // console.log('hi', secondery)
            const result = await productsCollection.deleteOne(query);
            if (primary) {

                const pPath = primary;
                fs.unlink(pPath, (err) => {
                    if (err) {
                        console.error(err)
                        return
                    }
                })
            }
            if (secondery) {
                try {
                    var files = seconderyImagePath;
                    files.forEach(path => fs.existsSync(path) && fs.unlinkSync(path))
                    // success code here
                } catch (err) {
                    // error handling here
                    console.error(err)
                }
                // console.log(secondery)
            }

            res.send(result);
        });

        //product info update

        app.patch('/product/update/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const info = req.body;
            const query = { _id: ObjectId(id) };
            // console.log(info.logDescriptions)
            const sprices = parseInt(info.sPrices) > 0 ? parseInt(info.sPrices) : false;

            const doc = {
                $set: {
                    productName: info.productNames,
                    orderType: info.orderTypes,
                    price: info.prices,
                    quantity: parseInt(info.quantitys),
                    deliveryInDhaka: info.deliveryInDhakas,
                    outDhaka: info.outDhakas,
                    color: info.colors,
                    size: info.sizes,
                    sPrice: sprices,
                    video: info.videos,
                    brand: info.brands

                }
            }
            const result = await productsCollection.updateOne(query, doc);
            // console.log
            res.send(result);
        });

        // product image update



        app.patch('/product/image/update/:id', verifyJwt, upload.fields([
            { name: 'primaryImage', maxCount: 1 },
            { name: 'secondImage', maxCount: 5 },

        ]), async (req, res) => {
            const id = req.params.id;
            const pImagrPath = req.query.path;
            const secondery = req.query.sPath;
            const seconderyImagePath = secondery.split(",");
            const query = { _id: ObjectId(id) };
            // console.log(info.logDescriptions)
            let img;
            if (req.files.primaryImage) {
                let { filename } = req.files.primaryImage[0];
                img = filename;
            }

            if (img) {
                await sharp(req.files.primaryImage[0].path)
                    .resize(1200, 1200, {
                        fit: sharp.fit.contain,
                        background: 'white'
                    })
                    .png({ quality: 100 })
                    .toFile(
                        path.resolve(req.files.primaryImage[0].destination, 'productResized', img)

                    )

                fs.unlinkSync(req.files.primaryImage[0].path);

                if (pImagrPath) {

                    const pPath = pImagrPath;
                    fs.unlink(pPath, (err) => {
                        if (err) {
                            console.error(err)
                            return
                        }
                    })
                }

            }

            const primaryImage = pImagrPath && img ? `products/productResized/${img}` : pImagrPath;



            // secondery image function 
            let secondImage = [];
            const secondImagepath = req.files.secondImage ? req.files.secondImage.map((secondPath, index) => req.files.secondImage[index].path) : [];
            if (secondImagepath.length > 0) {
                for (let x in req.files.secondImage) {
                    const { filename: secondImgName } = req.files.secondImage[x]
                    await sharp(req.files.secondImage[x].path)
                        .resize(1200, 1200, {
                            // fit: sharp.fit.contain, //image full but show background 
                            fit: sharp.fit.contain,
                            background: 'white'

                        })
                        .png({ quality: 100 })
                        .toFile(
                            path.resolve(req.files.secondImage[x].destination, 'productResized', secondImgName)
                        )

                    fs.unlinkSync(req.files.secondImage[x].path);
                    secondImage.push(`products/productResized/${secondImgName}`)
                }
            };

            if (secondery && secondImage.length > 0) {
                try {
                    var files = seconderyImagePath;
                    files.forEach(path => fs.existsSync(path) && fs.unlinkSync(path))
                    // success code here
                } catch (err) {
                    // error handling here
                    console.error(err)
                }

            }

            const seconImageUpadate = secondImage.length > 0 ? secondImage : seconderyImagePath;
            // console.log(seconImageUpadate);
            const doc = {
                $set: {
                    primaryImage: primaryImage,
                    secondImage: seconImageUpadate
                }
            }
            const result = await productsCollection.updateOne(query, doc);
            // // console.log
            res.send(result);
        });

        // product category update
        app.patch('/product/category/update/:id', verifyJwt, upload.none(), async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) };
            let mainCategory = JSON.parse(req.body.mainCategory);
            let SubCategory = JSON.parse(req.body.SubCategory);
            let categorys = JSON.parse(req.body.category);


            const doc = {
                $set: {
                    mainCategoryID: mainCategory,
                    category: categorys,
                    subCategory: SubCategory
                }
            }
            const result = await productsCollection.updateOne(query, doc);
            // // console.log
            res.send(result);
        });



        // product image update succfully





        app.put('/product/status/update/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const status = req.body.value;
            const query = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateStatus = {
                $set: {
                    status
                }
            }
            const statusUpdates = await productsCollection.updateOne(query, updateStatus, options);
            res.send(statusUpdates);
        })

        //============================
        //Product  database end here
        //===========================

        //============================
        //Coupons  database stArt here
        //===========================

        app.post('/coupons', verifyJwt, async (req, res) => {
            const coupon = req.body;
            // console.log(coupon)
            const result = await couponsCollection.insertOne(coupon);
            res.send(result);
        });

        //coupons get api

        app.get('/coupons/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const pages = req.query.page;
            const couponName = req.query.couponName;
            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";

            let coupons;

            if (!isAdmin) {
                const query = {
                    email: email,

                    $or: [{
                        name: {
                            $regex: couponName.toString(), "$options": "i"
                        }
                    }, {
                        code: {
                            $regex: couponName.toString(), "$options": "i"
                        }
                    }
                    ]

                };

                if (pages >= 0) {
                    coupons = await couponsCollection.find(query).skip(parseInt(pages) * 10).limit(10).sort({ "_id": -1 }).toArray();

                }
                else if (couponName) {
                    coupons = await couponsCollection.find(query).sort({ "_id": -1 }).toArray();
                } else {
                    coupons = await couponsCollection.find({ email: email }).sort({ "_id": -1 }).toArray();
                }


            }


            if (isAdmin) {
                const query = {
                    $or: [{
                        name: {
                            $regex: couponName.toString(), "$options": "i"
                        }
                    }, {
                        code: {
                            $regex: couponName.toString(), "$options": "i"
                        }
                    }
                    ]
                };
                if (pages >= 0) {
                    coupons = await couponsCollection.find(query).skip(parseInt(pages) * 10).limit(10).toArray();
                }
                else if (couponName) {
                    coupons = await couponsCollection.find(query).toArray();
                }
                else {
                    coupons = await couponsCollection.find().toArray();
                }


            }
            res.send(coupons);
        });

        // coupons delete api

        app.delete('/coupon/delete/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const result = await couponsCollection.deleteOne({ _id: ObjectId(id) });
            res.send(result);
        });


        // coupon edite api

        app.put('/coupon/update/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const updateInfo = req.body;
            const query = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    name: updateInfo.couponName,
                    code: updateInfo.couponCode,
                    percentage: updateInfo.couponPercentage,
                    startDates: updateInfo.satrtDateUpdate,
                    endDates: updateInfo.endDateUpdate
                }
            }

            const couponUpdates = await couponsCollection.updateOne(query, updateDoc);
            res.send(couponUpdates);
        });

        app.put('/coupon/status/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const status = req.body.value;
            const query = { _id: ObjectId(id) };
            const updateStatus = {
                $set: {
                    status
                }
            }

            const statusUpdates = await couponsCollection.updateOne(query, updateStatus);
            res.send(statusUpdates);

        });




        //============================
        //coupons  database end here
        //===========================

        //============================
        //slider  database start here
        //===========================

        app.post('/slider', verifyJwt, upload.single('slider'), async (req, res) => {
            const info = req.body;
            const img = req.file;
            const sliderInfo = {
                title: info.title,
                description: info.descriptrion,
                link: info.link,
                img: img.path,
                textBox: info.textBox
            }

            const slider = await sliderCollection.insertOne(sliderInfo);
            res.send(slider);

        });

        app.get('/slider/:email', verifyJwt, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const titles = req.query.name;
            const query = {
                title: {
                    $regex: titles.toString(), "$options": "i"
                }

            };
            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";
            if (isAdmin) {

                if (titles) {
                    slider = await sliderCollection.find(query).sort({ "_id": -1 }).toArray();
                    res.send(slider)
                }
                else {
                    slider = await sliderCollection.find().sort({ "_id": -1 }).toArray();
                    res.send(slider)
                }
            }
        });

        // slider delete api
        app.delete('/slider/delete/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const path = req.query.path;


            if (path) {
                fs.unlink(path, (err) => {
                    if (err) {
                        console.error(err)
                        return
                    }
                })

            }
            const result = await sliderCollection.deleteOne(query);
            res.send(result);

        });

        app.put('/slider/update/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updateInfo = req.body;
            const query = { _id: ObjectId(id) };

            const updateDoc = {
                $set: {
                    title: updateInfo.title,
                    description: updateInfo.description,
                    link: updateInfo.link,
                    textBox: updateInfo.textBox
                }
            }
            const sliderUpdates = await sliderCollection.updateOne(query, updateDoc);
            res.send(sliderUpdates);
        });

        app.put('/slider/status/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const status = req.body.value;
            const query = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateStatus = {
                $set: { status }
            }
            const sliderstatusUpdate = await sliderCollection.updateOne(query, updateStatus, options);
            res.send(sliderstatusUpdate);
        })

        //============================
        //slider  database end here
        //===========================

        //============================
        // customer all api start here
        //===========================
        app.get('/customer/admin', verifyJwt, verifyAdmin, async (req, res) => {
            const pages = req.query.page;
            const CustomerName = req.query.name;
            const query = {

                $or: [{
                    name: {
                        $regex: CustomerName.toString(), "$options": "i"
                    }
                }, {
                    email: {
                        $regex: CustomerName.toString(), "$options": "i"
                    }
                }
                ]

            };
            const customers = await customersCollection.find(query).skip(parseInt(pages) * 10).limit(10).sort({ "_id": -1 }).toArray();
            res.send(customers);
        });
        // customer delete api

        app.delete('/customer/admin/delete/:id', verifyJwt, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await customersCollection.deleteOne(query);
            res.send(result);

        });




        app.put('/customer/public/:email', async (req, res) => {
            const email = req.params.email;
            const customer = req.body;
            const filter = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: customer,
            };
            const result = await customersCollection.updateOne(filter, updateDoc, options);
            if (customer.phone) {
                res.send({ result });
            }
            else {
                const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '30d' });
                res.send({ result, token });
            }
        });

        app.get('/customer/info/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const customer = await customersCollection.findOne(query);
            res.send(customer);

        });

        app.put('/customer/info/update/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const updateAddress = req.body;
            const filter = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: { address: updateAddress },
            };
            const result = await customersCollection.updateOne(filter, updateDoc, options);
            res.send(result);

        });


        //============================
        // customer all api end here
        //===========================








        //============================
        //client site api start here
        //===========================
        // category api start here

        app.get('/category/client', async (req, res) => {
            const categories = await categoriesCollection.find().toArray();
            res.send(categories);
        });

        //slider public get api created

        app.get('/slider/client/public', async (req, res) => {
            const filter = { status: true }
            const sliders = await sliderCollection.find(filter).toArray();
            // console.log('error')
            res.send(sliders);
        });


        // get all product 
        app.get('/product/client/public', async (req, res) => {
            const pages = req.query.page;
            const filter = { status: 'Accept', "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] } };
            const products = await productsCollection.find(filter).skip(parseInt(pages) * 12).limit(12).sort({ "_id": -1 }).toArray();

            for (let x of products) {
                if (x.review && Array.isArray(x.review)) {
                    const reviewId = x.review.map(function (id) {
                        return new ObjectId(id);
                    })

                    const review = await reviewoCollection.find({ _id: { $in: reviewId } }).toArray();
                    const rating = review.reduce((previousValue, currentValue) => previousValue + currentValue.rating, 0);
                    const avgRating = rating / review.length;
                    // console.log(avgRating)
                    x.avgRating = avgRating;
                }
            }
            res.send(products);

        });
        // get category product 
        app.get('/category/product/client/public/:slug', async (req, res) => {
            const slug = req.params.slug;
            const pages = req.query.page;
            console.log(slug)
            const filter = { status: 'Accept', 'category.slug': slug, "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] } };
            const products = await productsCollection.find(filter).skip(parseInt(pages) * 20).limit(20).sort({ "_id": -1 }).toArray();

            for (let x of products) {
                if (x.review && Array.isArray(x.review)) {
                    const reviewId = x.review.map(function (id) {
                        return new ObjectId(id);
                    })

                    const review = await reviewoCollection.find({ _id: { $in: reviewId } }).toArray();
                    const rating = review.reduce((previousValue, currentValue) => previousValue + currentValue.rating, 0);
                    const avgRating = rating / review.length;
                    // console.log(avgRating)
                    x.avgRating = avgRating;
                }
            }
            res.send(products);

        });
        // get subcategory product 
        app.get('/subCategory/product/client/public/:slug', async (req, res) => {
            const slug = req.params.slug;
            const pages = req.query.page;
            console.log(slug)
            const filter = { status: 'Accept', 'subCategory.slug': slug, "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] } };
            const products = await productsCollection.find(filter).skip(parseInt(pages) * 20).limit(20).sort({ "_id": -1 }).toArray();

            for (let x of products) {
                if (x.review && Array.isArray(x.review)) {
                    const reviewId = x.review.map(function (id) {
                        return new ObjectId(id);
                    })

                    const review = await reviewoCollection.find({ _id: { $in: reviewId } }).toArray();
                    const rating = review.reduce((previousValue, currentValue) => previousValue + currentValue.rating, 0);
                    const avgRating = rating / review.length;
                    // console.log(avgRating)
                    x.avgRating = avgRating;
                }
            }
            res.send(products);

        });
        // get Maincategory product 
        app.get('/mainCategory/product/client/public/:slug', async (req, res) => {
            const slug = req.params.slug;
            const pages = req.query.page;
            // console.log(slug)
            const filter = { status: 'Accept', 'mainCategoryID.value': slug, "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] } };
            const products = await productsCollection.find(filter).skip(parseInt(pages) * 20).limit(20).sort({ "_id": -1 }).toArray();

            for (let x of products) {
                if (x.review && Array.isArray(x.review)) {
                    const reviewId = x.review.map(function (id) {
                        return new ObjectId(id);
                    })

                    const review = await reviewoCollection.find({ _id: { $in: reviewId } }).toArray();
                    const rating = review.reduce((previousValue, currentValue) => previousValue + currentValue.rating, 0);
                    const avgRating = rating / review.length;
                    // console.log(avgRating)
                    x.avgRating = avgRating;
                }
            }
            res.send(products);

        });

        //get subcategory count

        app.get('/product/client/public/subCategory/count/:slug', async (req, res) => {
            const slugs = req.params.slug;
            // console.log(slugs);
            const query = {
                status: 'Accept', 'subCategory.slug': slugs, "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] }
            };
            const count = await productsCollection.countDocuments(query);
            res.send({ count });
        });
        //get maincategory count

        app.get('/product/client/public/mainCategory/count/:slug', async (req, res) => {
            const slugs = req.params.slug;
            // console.log(slugs);
            const query = {
                status: 'Accept', 'mainCategoryID.value': slugs, "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] }
            };
            const count = await productsCollection.countDocuments(query);
            res.send({ count });
        });
        //get subcategory count

        app.get('/product/client/public/subCategory/count/:slug', async (req, res) => {
            const slugs = req.params.slug;
            // console.log(slugs);
            const query = {
                status: 'Accept', 'subCategory.slug': slugs, "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] }
            };
            const count = await productsCollection.countDocuments(query);
            res.send({ count });
        });

        app.get('/top/reating/product/client', async (req, res) => {
            const filter = { status: 'Accept', "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] } };
            const topProducts = await productsCollection.find(filter).toArray();

            for (let x of topProducts) {
                if (x.review && Array.isArray(x.review)) {
                    const reviewId = x.review.map(function (id) {
                        return new ObjectId(id);
                    })

                    const review = await reviewoCollection.find({ _id: { $in: reviewId } }).toArray();
                    const rating = review.reduce((previousValue, currentValue) => previousValue + currentValue.rating, 0);
                    const avgRating = rating / review.length;
                    // console.log(avgRating)
                    x.avgRating = avgRating;
                }
            }

            res.send(topProducts);
        })

        app.get('/allproduct/client/public', async (req, res) => {
            const pages = req.query.page;
            const filter = { status: 'Accept', "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] } };
            const products = await productsCollection.find(filter).skip(parseInt(pages) * 20).limit(20).toArray();

            for (let x of products) {
                if (x.review && Array.isArray(x.review)) {
                    const reviewId = x.review.map(function (id) {
                        return new ObjectId(id);
                    })

                    const review = await reviewoCollection.find({ _id: { $in: reviewId } }).toArray();
                    const rating = review.reduce((previousValue, currentValue) => previousValue + currentValue.rating, 0);
                    const avgRating = rating / review.length;
                    // console.log(avgRating)
                    x.avgRating = avgRating;
                }
            }

            res.send(products);
        });

        // all product count
        app.get('/product/client/public/count', async (req, res) => {

            const count = await productsCollection.countDocuments({ status: 'Accept', "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] } });
            res.send({ count });
        });
        //category product count
        app.get('/product/client/public/category/count/:slug', async (req, res) => {
            const slugs = req.params.slug;
            // console.log(slugs);
            const query = {
                status: 'Accept', 'category.slug': slugs, "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] }
            };
            const count = await productsCollection.countDocuments(query);
            res.send({ count });
        });
        // 'category.[].slug': 'slugs'
        // pre order product starat
        // ==========================
        app.get('/allproduct/client/public/pre-order', async (req, res) => {
            const pages = req.query.page;
            const filter = { orderType: "Pre-Order", status: 'Accept', "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] } };
            const products = await productsCollection.find(filter).skip(parseInt(pages) * 20).limit(20).sort({ "_id": -1 }).toArray();

            for (let x of products) {
                if (x.review && Array.isArray(x.review)) {
                    const reviewId = x.review.map(function (id) {
                        return new ObjectId(id);
                    })

                    const review = await reviewoCollection.find({ _id: { $in: reviewId } }).toArray();
                    const rating = review.reduce((previousValue, currentValue) => previousValue + currentValue.rating, 0);
                    const avgRating = rating / review.length;
                    // console.log(avgRating)
                    x.avgRating = avgRating;
                }
            }
            res.send(products);
        });


        app.get('/product/client/public/count/pre-order', async (req, res) => {
            const count = await productsCollection.countDocuments({ orderType: "Pre-Order", status: 'Accept', "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] } });
            res.send({ count });
        });
        // ==========================
        // pre order product end

        //public single product api
        app.get('/product/client/public/:id', async (req, res) => {
            const id = req.params;
            const query = { _id: ObjectId(id) };
            const product = await productsCollection.findOne(query);
            res.send(product);
        });


        // verify coupon 
        app.get('/coupon/public/verify/:code', async (req, res) => {
            const code = req.params.code;
            const id = req.query.pId;
            const email = req.query.email;
            const options = {
                weekday: "short",
                year: "numeric",
                month: "2-digit",
                day: "numeric"
            };
            const filter = { _id: ObjectId(id) };

            const today = new Date().toLocaleDateString("en", options);
            const query = { code: code, email: email };
            const coupon = await couponsCollection.findOne(query);
            if (coupon) {
                const product = await productsCollection.findOne(filter);
                const startDate = new Date(coupon.startDates).toLocaleDateString("en", options);
                const endDate = new Date(coupon.endDates).toLocaleDateString("en", options);
                const productMainCategory = product.mainCategoryID.map(category => JSON.parse(category).value);
                const productCategory = product.category.map(category => JSON.parse(category).slug);
                const productMainSubCategory = product.subCategory.map(category => JSON.parse(category).slug);
                const productAllCategroy = [...productMainCategory, ...productCategory, ...productMainSubCategory];
                const mainCategory = coupon.mainCategory.map(category => category._id);
                const couponCategory = coupon.category.map(category => category.slug);
                const subCategory = coupon.subCategory.map(category => category.slug);
                const couponAllCategroy = [...mainCategory, ...couponCategory, ...subCategory];

                const result = [];
                for (let x of couponAllCategroy) {
                    const y = productAllCategroy.includes(x)
                    result.push(y)
                }
                const categoryVerify = result.every(value => value === false); // every element is false return true
                const dateVerify = today <= startDate && endDate >= today; // time match then return true

                if (coupon.status && !categoryVerify && dateVerify) {
                    res.send(coupon.percentage)
                }
                else {
                    res.send({ message: 'Your Coupon is not Valid!!' })
                }
            } else {
                res.send({ message: 'Your Coupon is not Valid!!' })
            }

        });


        app.get('/products/cart', async (req, res) => {
            const ids = req.query.name;
            if (ids) {
                const id = ids.split(',').map(id => new ObjectId(id));
                const filter = { "_id": { $in: id } };
                const products = await productsCollection.find(filter).toArray();
                res.send(products);
            }
            else {
                res.send([]);
            }
        });

        // search product api

        app.get('/product/search/public', async (req, res) => {
            const search = req.query.name;

            if (search) {
                const query = {
                    status: "Accept",
                    "$expr": { "$gt": [{ "$toInt": "$quantity" }, 0] },
                    $or: [{
                        productName: {
                            $regex: search.toString(), "$options": "i"
                        }
                    }, {
                        shortDescription: {
                            $regex: search.toString(), "$options": "i"
                        }
                    },

                    ],


                };
                const product = await productsCollection.find(query).sort({ "_id": -1 }).sort({ "_id": -1 }).toArray();
                res.send(product);
            }
            else {
                res.send({ data: false });
            }
        })

        //order post api

        app.post('/order/public', verifyJwt, async (req, res) => {

            const orderInfo = req.body;
            const orderInfos = { ...orderInfo, updatedAt: new Date(Date.now()) };
            // console.log(orderInfos)
            for (let x of orderInfo.products) {
                await productsCollection.updateOne({ _id: ObjectId(x.productId) }, { $inc: { quantity: -parseInt(x.quantity) } });
            }
            const order = await ordersCollection.insertOne(orderInfos);
            sendOrderEmail(orderInfos, 'confirmed');

            res.send(order);
        });

        // get order for public 
        app.get('/orders/:email', verifyJwt, async (req, res) => {
            const pages = req.query.page;
            const email = req.params.email;
            const orders = await ordersCollection.find({ customerEmail: email }).skip(parseInt(pages) * 10).limit(10).sort({ "_id": -1 }).toArray();
            res.send(orders);
        });
        // get order for public 
        app.get('/orders/track/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const track = await ordersCollection.findOne({ orderID: id })
            res.send(track);
        });


        // order count 
        app.get('/orders/count/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const count = await ordersCollection.countDocuments({ customerEmail: email });
            res.send({ count });
        });
        // order cencel
        app.put('/order/cencel/:id', verifyJwt, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: { status: 'Cancel' },
            };
            const cencel = await ordersCollection.updateOne(filter, updateDoc, options);
            res.send(cencel)
        })


        //========================
        //SSL Commerce
        //========================
        // const sslCommerzRoutes = require("./SSLcommerz/Route/sslCommerzRoutes");
        app.use(function (req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });


        // sslcommerz init
        app.post('/online-payment/public', verifyJwt, async (req, res) => {
            const orderInfo = req.body;
            const transactionId = `${shortid.generate()}`;
            const payablePrice = orderInfo.totalPayable;
            const productName = orderInfo?.products?.map(name => name.productName).toString();
            const customerName = orderInfo?.customerName;
            const customerPhone = orderInfo?.customerPhone;


            const data = {
                total_amount: payablePrice,
                currency: 'BDT',
                tran_id: transactionId, // use unique tran_id for each api call
                success_url: `${process.env.SERVER_URL}/ssl-payment-succuss`,
                fail_url: `${process.env.SERVER_URL}/ssl-payment-failure`,
                cancel_url: `${process.env.SERVER_URL}/ssl-payment-cencel`,
                ipn_url: `${process.env.SERVER_URL}/ssl-payment-ipn`,
                shipping_method: 'Courier',
                product_name: productName,
                product_category: 'Electronic',
                product_profile: 'general',
                cus_name: customerName,
                cus_email: orderInfo?.customerEmail,
                cus_add1: orderInfo?.customerDetails,
                cus_city: orderInfo?.customerCity,
                cus_state: orderInfo?.customerState,
                // cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: customerPhone,
                // cus_fax: '01711111111',
                ship_name: customerName,
                ship_add1: orderInfo?.customerDetails,
                // ship_add2: 'Dhaka',
                ship_city: orderInfo?.customerCity,
                ship_state: orderInfo?.customerState,
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            };
            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);

            sslcz.init(data).then(data => {
                if (data?.GatewayPageURL) {
                    orderInfo["transactionId"] = transactionId;
                    if (payablePrice > 0 && customerPhone) {
                        const orderProduct = ordersCollection.insertOne(orderInfo);
                        return res.send({ data: data?.GatewayPageURL })
                    } else {
                        return res.send({ data: false })
                    }
                }
                else {
                    return res.send({ data: false })
                }

            });
        })



        app.post('/ssl-payment-succuss', async (req, res, next) => {
            const { tran_id, card_type } = req.body;
            if (!tran_id) {
                return res.json({ message: "transactionId must be required" });
            }
            else {
                const orderInfo = await ordersCollection.findOne({ transactionId: tran_id });
                // console.log(orderInfo)
                const currentOrder = await ordersCollection.updateOne({ transactionId: tran_id }, { $set: { "paymentDone": true, "paymentMethod": card_type, "updatedAt": new Date(Date.now()), payment: 'success' } }, { upsert: true });
                await paymentInfoCollection.insertOne(req.body);
                for (let x of orderInfo.products) {
                    productsCollection.updateOne({ _id: ObjectId(x.productId) }, { $inc: { quantity: -parseInt(x.quantity) } });
                }
                sendOrderEmail(orderInfo, 'confirmed');

                res.redirect(`${process.env.CLIENT_URL}/orderSuccess/${tran_id}`);
            };


        });
        app.post('/ssl-payment-failure', async (req, res, next) => {
            const { tran_id, card_type } = req.body;

            if (!tran_id) {
                return res.json({ message: "transactionId must be required" });
            }
            else {
                const orderInfo = await ordersCollection.findOne({ transactionId: tran_id });
                // console.log(orderInfo)
                await ordersCollection.updateOne({ transactionId: tran_id }, { $set: { "paymentDone": false, "paymentMethod": card_type, "updatedAt": new Date(Date.now()), payment: 'failed' } }, { upsert: true });
                await paymentInfoCollection.insertOne(req.body);
                sendOrderEmail(orderInfo, 'failed');
                res.redirect(`${process.env.CLIENT_URL}/orderFail/${tran_id}`);

            }

        });


        app.post('/ssl-payment-cencel', async (req, res, next) => {
            const { tran_id, card_type } = req.body;
            if (!tran_id) {
                return res.json({ message: "transactionId must be required" });
            }
            else {
                const orderInfo = await ordersCollection.findOne({ transactionId: tran_id });
                await ordersCollection.updateOne({ transactionId: tran_id }, { $set: { "paymentDone": false, "paymentMethod": card_type, "updatedAt": new Date(Date.now()), payment: 'Cancel', status: 'Cancel' } }, { upsert: true });
                await paymentInfoCollection.insertOne(req.body);
                sendOrderEmail(orderInfo, 'Cancel');
                res.redirect(`${process.env.CLIENT_URL}/orderFail/${tran_id}`);
            }

        });
        app.post('/ssl-payment-ipn', async (req, res, next) => {
            res.redirect(`${process.env.CLIENT_URL}`);
        });



        //========================
        //SSL Commerce
        //========================

        // shop category api
        app.get('/category/all/public/client/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id), 'category.status': true }
            const cursor = await categoriesCollection.findOne(query);
            res.send(cursor);
        });

        //order review

        app.post('/order/review/customer', verifyJwt, async (req, res) => {
            const review = req.body;
            const productsId = review?.reviewModal?.products.map(id => id.productId);
            const final = { rating: review.rating, comment: review.comment, name: review.reviewModal.customerName, email: review.reviewModal.customerEmail, productsId }
            const cursor = await reviewoCollection.insertOne(final);
            const productId = review?.reviewModal?.products.map(function (id) {
                return new ObjectId(id.productId);
            });

            const product = await productsCollection.updateMany({ _id: { $in: productId } }, { $push: { review: cursor.insertedId } }, { upsert: true });
            res.send(cursor);
        });

        // get review collaction
        app.post("/productReview", async (req, res) => {
            const ids = req.body;
            // console.log(Array.isArray(id))
            if (Array.isArray(ids)) {
                const reviewId = ids.map(function (id) {
                    return new ObjectId(id);
                });

                const review = await reviewoCollection.find({ _id: { $in: reviewId } }).toArray();
                const rating = review.reduce((previousValue, currentValue) => previousValue + currentValue.rating, 0);
                const avgRating = rating / review.length;
                res.send({ review, avgRating });
            }
            else {
                res.send([])
            }
        });



        //============================
        //client site api end here
        //===========================

        //============================
        //DashBoard Account start here
        //===========================
        app.get('/today/order-info/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";
            let start = new Date(Date.now());
            start.setHours(0, 0, 0, 0);
            let end = new Date(Date.now());
            end.setHours(23, 59, 59, 999);
            if (isAdmin) {
                const orderInfo = await ordersCollection.find({ updatedAt: { $gte: start, $lt: end } }).sort({ "_id": -1 }).toArray();
                res.send(orderInfo)
            } else {
                const orderInfo = await ordersCollection.find({ updatedAt: { $gte: start, $lt: end }, 'products.marchentEmail': email }).sort({ "_id": -1 }).toArray();
                for (let x of orderInfo) {
                    x.products = x.products.filter(y => y.marchentEmail === email);
                    // x.totalPrice = x.products.map(p => p.productTotalPrice).toString();
                    x.totalPrice = x.products.reduce(
                        (previousValue, currentValue) => previousValue + currentValue.productTotalPrice,
                        0
                    );
                }

                res.send(orderInfo)
            }

        });

        // find order for month 
        app.get('/order/month/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const today = new Date();
            const month = (today.getMonth() + 1);
            const year = today.getFullYear();
            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";

            if (isAdmin) {
                const monthOrder = await ordersCollection.find({

                    $expr: {
                        $and: [
                            {
                                "$eq": [
                                    {
                                        "$month": "$updatedAt"
                                    },
                                    month
                                ]
                            },
                            {
                                "$eq": [
                                    {
                                        "$year": "$updatedAt"
                                    },
                                    year
                                ]
                            }
                        ]
                    }
                }).toArray();
                res.send(monthOrder)
            } else {
                const monthOrder = await ordersCollection.find({
                    'products.marchentEmail': email,
                    $expr: {
                        $and: [
                            {
                                "$eq": [
                                    {
                                        "$month": "$updatedAt"
                                    },
                                    month
                                ]
                            },
                            {
                                "$eq": [
                                    {
                                        "$year": "$updatedAt"
                                    },
                                    year
                                ]
                            }
                        ]
                    }
                }).toArray();
                // console.log(monthOrder.length)
                res.send(monthOrder)
            }

        });
        // find order for month 
        app.get('/order/year/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const today = new Date();
            const year = today.getFullYear();

            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";


            if (isAdmin) {
                const years = await ordersCollection.find({

                    $expr: {
                        $and: [

                            {
                                "$eq": [
                                    {
                                        "$year": "$updatedAt"
                                    },
                                    year
                                ]
                            }
                        ]
                    }
                }).toArray();
                // console.log(monthOrder.length)
                res.send(years)
            } else {
                const years = await ordersCollection.find({
                    'products.marchentEmail': email,
                    $expr: {
                        $and: [

                            {
                                "$eq": [
                                    {
                                        "$year": "$updatedAt"
                                    },
                                    year
                                ]
                            }
                        ]
                    }
                }).toArray();

                res.send(years)
            }

        });
        //===============================
        //DashBoard Account end here
        //===========================
        //===============================
        //DashBoard Account start here
        //===========================
        app.get('/account/order/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;

            // console.log(orders)
            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";




            if (isAdmin) {
                const withdrawInfo = await acountCollection.find().toArray();
                const pendingBalence = withdrawInfo?.reduce((previousValue, currentValue) => previousValue + currentValue.RequestAmount, 0);
                const orders = await ordersCollection.find().toArray();
                let payablePrice = 0;


                for (let price of orders) {
                    if (price.paymentDone && price.products.some(p => p.status === 'Completed')) {
                        const finalPrice = price?.products?.reduce((previousValue, currentValue) => previousValue + (currentValue.productTotalPrice + parseInt(currentValue.deliveryCharge)), 0);
                        payablePrice += finalPrice;
                    }
                }
                let finalPrice = payablePrice - pendingBalence;
                res.send({ finalPrice })
            }
            else {
                const withdrawInfo = await acountCollection.find({ shopEmail: email }).toArray();
                const orders = await ordersCollection.find({ 'products.marchentEmail': email }).toArray();
                const pendingBalence = withdrawInfo?.reduce((previousValue, currentValue) => previousValue + currentValue.RequestAmount, 0);
                let payablePrice = 0;

                for (let price of orders) {
                    if (price.paymentDone && price.products.some(p => p.status === 'Completed' && p.marchentEmail === email)) {
                        const finalPrice = price?.products?.reduce((previousValue, currentValue) => previousValue + (currentValue.productTotalPrice + parseInt(currentValue.deliveryCharge)), 0);
                        payablePrice += finalPrice;
                    }
                }
                let finalPrice = payablePrice - pendingBalence;
                res.send({ finalPrice })
            }

            // console.log(payablePrice)


        });

        app.post('/acount/withdraw', verifyJwt, async (req, res) => {
            const today = new Date();
            const date = today.getDate() + '-' + (today.getMonth() + 1) + '-' + today.getFullYear();
            const time = today.toLocaleString('en-US', {
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            });
            const withdrawInfo = req.body;
            const withdraw = await acountCollection.insertOne({ ...withdrawInfo, date, time });
            res.send(withdraw);
        });
        app.get('/acount/withdraw/:email', verifyJwt, async (req, res) => {

            const email = req.params.email;
            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";
            if (isAdmin) {
                const withdrawInfo = await acountCollection.find().sort({ "_id": -1 }).toArray();
                res.send(withdrawInfo);
            }
            else {
                const withdrawInfo = await acountCollection.find({ shopEmail: email }).sort({ "_id": -1 }).toArray();
                res.send(withdrawInfo);
            }
        });
        app.put('/acount/withdraw/status/:id', async (req, res) => {
            const status = req.body.value;
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: { status: status },
            };
            const widrawStatus = await acountCollection.updateOne(filter, updateDoc, options);
            res.send(widrawStatus);
            // console.log(status)
        });


        //===============================
        //DashBoard Account end here
        //===========================

        //===============================
        //DashBoard Account anaylics end here
        //=================================

        app.get('/anylics/dashboard/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            // veryfy admin
            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";



            let start = new Date(Date.now())
            start.setHours(0, 0, 0, 0);
            let end = new Date(Date.now())
            end.setHours(23, 59, 59, 999);
            let currentDay = new Date(Date.now())
            // currentDay.setTimezone("Asia/Dhaka");
            let sellAmount;

            if (isAdmin) {
                const orderInfo = await ordersCollection.find({ updatedAt: { $gte: start, $lt: end } }).toArray();
                // console.log(orderInfo)
                const totalSellPrice = orderInfo.reduce((previousValue, currentValue) => previousValue + currentValue.totalPrice, 0);
                sellAmount = totalSellPrice;
            }
            else {
                let marchentPrice = 0;
                const orderInfo = await ordersCollection.find({ updatedAt: { $gte: start, $lt: end }, 'products.marchentEmail': email }).toArray();
                // console.log(orderInfo)
                // const totalSellPrice = orderInfo.reduce((previousValue, currentValue) => previousValue + currentValue.totalPrice, 0);
                for (let price of orderInfo) {
                    if (price.products.some(p => p.marchentEmail === email) && price.products.some(p => p.status !== 'Cancel')) {
                        const finalPrice = price?.products?.reduce((previousValue, currentValue) => previousValue + (currentValue.productTotalPrice + parseInt(currentValue.deliveryCharge)), 0);
                        marchentPrice += finalPrice;
                        // console.log(finalPrice)
                    }
                }

                sellAmount = marchentPrice;

            }
            // console.log(sellAmount)
            const query = { date: { $gte: start, $lt: end }, shopEmail: email };
            const updateDoc = {
                $set: {
                    date: currentDay,
                    sell: sellAmount,
                    day: currentDay.getDate(),
                    shopEmail: email
                }
            }
            const options = { upsert: true }
            const dayAnalycs = await analycsCollection.updateOne(query, updateDoc, options)

            res.send(dayAnalycs);
        });

        // month data anylics 

        app.get('/anylics/month/data/dashboard/:email', async (req, res) => {
            const email = req.params.email;
            // veryfy admin
            const users = await adminUsersCollection.findOne({ email: email });
            const isAdmin = users?.role === "admin";



            // let start = new Date(Date.now());
            // start.setHours(0, 0, 0, 0);
            // let end = new Date(Date.now());
            // end.setHours(23, 59, 59, 999);

            const today = new Date();
            const month = (today.getMonth() + 1);
            const year = today.getFullYear();
            let currentDay = new Date(Date.now());

            let sellAmount;

            if (isAdmin) {
                const orderInfo = await ordersCollection.find({

                    $expr: {
                        $and: [
                            {
                                "$eq": [
                                    {
                                        "$month": "$updatedAt"
                                    },
                                    month
                                ]
                            },
                            {
                                "$eq": [
                                    {
                                        "$year": "$updatedAt"
                                    },
                                    year
                                ]
                            }
                        ]
                    }
                }).toArray();
                // console.log(orderInfo)
                const totalSellPrice = orderInfo.reduce((previousValue, currentValue) => previousValue + currentValue.totalPrice, 0);
                sellAmount = totalSellPrice;
            }
            else {
                let marchentPrice = 0;
                const orderInfo = await ordersCollection.find({
                    'products.marchentEmail': email,
                    $expr: {
                        $and: [
                            {
                                "$eq": [
                                    {
                                        "$month": "$updatedAt"
                                    },
                                    month
                                ]
                            },
                            {
                                "$eq": [
                                    {
                                        "$year": "$updatedAt"
                                    },
                                    year
                                ]
                            }
                        ]
                    }
                }).toArray();
                // console.log(orderInfo)

                for (let price of orderInfo) {
                    if (price.products.some(p => p.marchentEmail === email) && price.products.some(p => p.status !== 'Cancel')) {
                        const finalPrice = price?.products?.reduce((previousValue, currentValue) => previousValue + (currentValue.productTotalPrice + parseInt(currentValue.deliveryCharge)), 0);
                        marchentPrice += finalPrice;
                        // console.log(finalPrice)
                    }
                }

                sellAmount = marchentPrice;

            }
            // console.log(sellAmount)
            // const query = { date: { $gte: start, $lt: end }, shopEmail: email };
            const query = {
                singleMonth: { $eq: month }, singleYear: { $eq: year }, shopEmail: email
            };

            const updateDoc = {
                $set: {
                    date: currentDay,
                    sell: sellAmount,
                    singleMonth: currentDay.getMonth() + 1,
                    singleYear: currentDay.getFullYear(),
                    month: currentDay.toLocaleString('en-us', { month: 'short', year: 'numeric' }),
                    shopEmail: email
                }
            }
            const options = { upsert: true }
            const monthAnalycs = await analycsMonthCollection.updateOne(query, updateDoc, options)

            res.send(monthAnalycs);
        });


        // get day anylics data 
        app.get('/get/all-day-data/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;

            const today = new Date();
            const month = (today.getMonth() + 1);
            const year = today.getFullYear();

            const monthAnylics = await analycsCollection.find({
                shopEmail: email,
                $expr: {
                    $and: [
                        {
                            "$eq": [
                                {
                                    "$month": "$date"
                                },
                                month
                            ]
                        },
                        {
                            "$eq": [
                                {
                                    "$year": "$date"
                                },
                                year
                            ]
                        }
                    ]
                }
            }).sort({ "day": 1 }).toArray();
            res.send(monthAnylics)

        });
        // get monthly data anylics data 
        app.get('/get/all-month-data/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;

            const today = new Date();
            // const month = (today.getMonth() + 1);
            const year = today.getFullYear();
            const monthAnylics = await analycsMonthCollection.find({
                shopEmail: email,
                $expr: {
                    $and: [

                        {
                            "$eq": [
                                {
                                    "$year": "$date"
                                },
                                year
                            ]
                        }
                    ]
                }
            }).sort({ "singleMonth": 1 }).toArray();
            res.send(monthAnylics)
        })

        //===============================
        //DashBoard Account anaylics end here
        //===========================

    }
    finally {
        // client.close();
    }

}

run().catch(console.dir);




// create test Api

app.get('/', (req, res) => {
    res.send("Daily Picks Server is running");

});

app.use((err, req, res, next) => {
    if (err) {
        if (err instanceof multer.MulterError) {
            resizeTo.status(500).send(err.message);
        } else {
            res.send("Success");
        }
    }
    else {
        res.send("success");
    }
});


app.listen(port, () => {
    console.log("server is running ...", port);
})