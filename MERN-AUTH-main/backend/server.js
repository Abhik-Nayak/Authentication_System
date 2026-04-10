import express from "express"
import dotenv from "dotenv";
import connectDB from "./database/db.js"
import userRoute from "./routes/userRoute.js"
import authRoute from "./routes/authRoute.js"
import cors from 'cors'
import "./config/passport.js"

const app = express()
dotenv.config();

const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(cors({
    origin:'http://localhost:5173',
    credentials:true
}))

app.use('/api/auth', authRoute)
app.use('/api/user', userRoute)

// Health check / test route
app.get('/api', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is working 🚀'
    });
});

// http://localhost:5000/user/register


app.listen(PORT,()=>{
    connectDB()
    console.log(`Server is listening at port ${PORT}`);  
})