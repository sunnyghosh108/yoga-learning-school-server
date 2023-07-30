const express =require('express');
const cors =require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion,ObjectId} = require('mongodb');
require('dotenv').config()
const app =express();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleWare
 app.use(cors());

 //
 app.use(express.json());

const corsConfig = {
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
  app.use(cors(corsConfig))
  app.options("", cors(corsConfig))

  // send payment confirmation email
 const sendPaymentConfirmationEmail = payment =>{
  transporter.sendMail({
   from:"bibos@gmail.com",
   to:"payment.email",
   subject:"Your order is confirmed is confirmed.Enjoy the food soon. ",
   text:"Hello World",
   html:`
   <div> 
   <h2> Payment confirmed!!</h2>
   </div>
   `,
  },
  function(error,info){
   if(error){
     console.log(error);
   }else{
     console.log('Email sent:'+info.response);
   }
  });
}




// verifyJWT
  const verifyJWT =(req,res,next)=> {
    const authorization =req.headers.authorization;
    if(!authorization){
        return res.status(401).send({error:true,message:'unauthorized access'});
    }
    //bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
        if(err){
            return res.status(401).send({error:true,message:'unauthorized access'});
        }
        req.decoded = decoded;
        next();
    })
}




//console.log(process.env.DB_PASS);



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o4ydcux.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollecton=client.db("summerCamp").collection("users");
    const menuCollection=client.db("summerCamp").collection("menu");
    const instructorCollecton=client.db("summerCamp").collection("instructor");
    const classCollecton=client.db("summerCamp").collection("classes");
    const cartCollection=client.db("summerCamp").collection("carts");
    const paymentCollection = client.db("summerCamp").collection("payments");
//Access token
    app.post('/jwt',(req,res)=>{
      const user = req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
          expiresIn:'5h'
      })
      res.send({token})
   })

   
     // Warning:use VerifyJWT before using VerifyAdmin
    
     const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollecton.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
   

     //users related api
     app.get('/users',verifyJWT,async(req,res)=>{
      const result =await usersCollecton.find().toArray();
      res.send(result);
     })
     app.post('/users',async(req,res)=>{
      const user = req.body;
      console.log(user);
      const query = {email: user.email}
      const existingUser =await usersCollecton.findOne(query);
      console.log('existinguser',existingUser)
      if(existingUser){
        return res.send({message:'user already exists'})
      }
      const  result= await usersCollecton.insertOne(user);
      res.send(result);
     });
     //security layer verify jwt
     

     app.get('/users/admin/:email',verifyJWT,async(req,res)=>{
      const email = req.params.email;
     if(req.decoded.email !== email){
      res.send({admin:false})
     }
      const query = {email:email}
      const user = await usersCollecton.findOne(query);
      const result = {admin : user?.role === 'admin'}
      res.send(result);
     })

       //admin
     app.patch('/users/admin/:id',async(req,res)=>{
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id)};
      const updateDoc ={
          $set: {
              role: 'admin'
            },
      };
      const result =await usersCollecton.updateOne(filter,updateDoc);
      res.send(result);
        
   })
   // instructor
   app.patch('/users/instructor/:id',async(req,res)=>{
    const id = req.params.id;
    console.log(id);
    const filter = { _id: new ObjectId(id)};
    const updateDoc ={
        $set: {
            role: 'instructor'
          },
    };
    const result =await usersCollecton.updateOne(filter,updateDoc);
    res.send(result);
      
 })

//  
app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
  const email = req.params.email;
  if (req.decoded.email !== email) {
    res.send({ instructor: false })
  }
  const query = { email: email }
  const user = await usersCollecton.findOne(query);
  const result = { instructor: user?.role === 'instructor' }
  res.send(result)
})
// 



  //menu
    // app.get('/menu',async(req,res)=>{
    //   const result =await menuCollecton.find().toArray();
    //   res.send(result);
    // })

    // menu related apis
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    })

    app.post('/menu', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem)
      res.send(result);
    })

    app.delete('/menu/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      // const query = { _id: new ObjectId(id) }
      const query = {$or : [ {_id : id} , {_id : new ObjectId(id) } ] }
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })
    // cart collection apis
    app.get('/carts',verifyJWT,async (req,res)=>{
      const email = req.query.email;
      console.log(email);
      if(!email){
          res.send([]);
      }

   const decodedEmail =req.decoded.email;
   if(email !== decodedEmail){
      return res.status(403).send({error:true,message:'forbidden access'})
   }


      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
  });
  app.post('/carts',async(req,res)=>{
      const item = req.body;
      //console.log(item);
      const result = await cartCollection.insertOne(item);
      res.send(result);
  })

  app.delete('/carts/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await cartCollection.deleteOne(query);
      res.send(result);
  })
   // create payment intent
   app.post('/create-payment-intent', verifyJWT, async (req, res) => {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card']
    });

    res.send({
      clientSecret: paymentIntent.client_secret
    })
  })

  // payment related api
  app.post('/payments', verifyJWT, async(req, res) =>{
    const payment = req.body;
    const insertResult = await paymentCollection.insertOne(payment);
     
    const query = {_id: { $in: payment.cartItems.map(id => new ObjectId(id)) }}
    const deleteResult = await cartCollection.deleteMany(query)

    //send an email confirming
      sendPaymentConfirmationEmail(payment);

    res.send({ insertResult, deleteResult});
  })
  app.get('/admin-stats',verifyJWT,verifyAdmin, async(req,res)=>{
    const users = await usersCollecton.estimatedDocumentCount();
    const products = await menuCollection.estimatedDocumentCount();
    const orders = await paymentCollection.estimatedDocumentCount();
    // best way to get sum of a field is to use group and sum operator
    const payments = await paymentCollection.find().toArray();
    const revenue = payments.reduce((sum,payment)=>sum+payment.price,0)
    res.send ({
      revenue,
      users,
      products,
      orders
    })
  })
//order
app.get('/order-stats', verifyJWT, verifyAdmin, async(req, res) =>{
  const pipeline = [
    {
      $lookup: {
        from: 'menu',
        localField: 'menuItems',
        foreignField: '_id',
        as: 'menuItemsData'
      }
    },
    {
      $unwind: '$menuItemsData'
    },
    {
      $group: {
        _id: '$menuItemsData.category',
        count: { $sum: 1 },
        total: { $sum: '$menuItemsData.price' }
      }
    },
    {
      $project: {
        category: '$_id',
        count: 1,
        total: { $round: ['$total', 2] },
        _id: 0
      }
    }
  ];

  const result = await paymentCollection.aggregate(pipeline).toArray()
  res.send(result)

})




   
    //instructor
    app.get('/instructor',async(req,res)=>{
        const result =await instructorCollecton.find().toArray();
        res.send(result);
      })
      
  //addClass

  app.get('/classes',async(req,res)=>{
    const cursor = classCollecton.find();
    const result =await cursor.toArray();
    res.send(result);
  })
  app.post('/classes',async(req,res)=>{
    const newClass =req.body;
    console.log(newClass);
    const result =await classCollecton.insertOne(newClass);
    res.send(result);
  })
//approve
app.patch('/users/classes/:id',async(req,res)=>{
  const id = req.params.id;
  console.log(id);
  const filter = { _id: new ObjectId(id)};
  const updateDoc ={
      $set: {
          role: 'approve'
        },
  };
  const result =await classCollecton.updateOne(filter,updateDoc);
  res.send(result);
    
})
  

const { ObjectId } = require('bson');

// Denied role
app.patch('/users/classes/denied/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const objectId = new ObjectId(id);
    
    const filter = { _id: objectId };
    const updateDoc = {
      $set: {
        role: 'denied',
      },
    };
    const result = await classCollecton.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    console.error('Failed to make denied:', error);
    // Handle the error appropriately (e.g., send an error response to the client)
    res.status(400).send({ error: 'Invalid ID' });
  }
});

// Feedback role
app.patch('/users/classes/feedback/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const objectId = new ObjectId(id);

    const filter = { _id: objectId };
    const updateDoc = {
      $set: {
        role: 'feedback',
      },
    };
    const result = await classCollecton.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    console.error('Failed to make feedback:', error);
    // Handle the error appropriately (e.g., send an error response to the client)
    res.status(400).send({ error: 'Invalid ID' });
  }
});


app.get('/classes/:id', async (req, res) => {
  const classId = req.params.id;
  const result = await classCollecton.findOne({ _id: ObjectId(classId) });
  if (result) {
    res.send(result);
  } else {
    res.status(404).json({ error: 'Class not found' });
  }
});


//  Start





// End




    


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('boy is practicing yoga')
})

app.listen(port,()=>{
    console.log(`boy is practicing yoga on port ${port}`)
})