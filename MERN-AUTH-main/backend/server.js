import express from "express"
import dotenv from "dotenv";
import connectDB from "./database/db.js"
import userRoute from "./routes/userRoute.js"
import authRoute from "./routes/authRoute.js"
import todoRoute from "./routes/todoRoute.js"
import cors from 'cors'
import "./config/passport.js"
import mongoose from "mongoose"

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
app.use('/api/todos', todoRoute)

// Health check
app.get('/api', (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

    res.status(dbState === 1 ? 200 : 503).json({
        success: dbState === 1,
        message: 'API is working 🚀',
        uptime: Math.floor(process.uptime()) + 's',
        database: dbStatus[dbState] || 'unknown',
    });
});

// http://localhost:5000/user/register


app.listen(PORT,()=>{
    connectDB()
    console.log(`Server is listening at port ${PORT}`);  
})