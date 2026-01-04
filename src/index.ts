require("dotenv").config();

import express from "express";
import userRouter from "./routes/users";
import authRouter from "./routes/auth";
import rolesRouter from "./routes/roles";
import schoolsRouter from "./routes/schools";




const cors = require("cors");
const app = express();
app.use(cors());
const PORT = process.env.PORT || 8000;

app.use(express.json());
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`); 
});


app.use("/api/v1/auth",authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/schools", schoolsRouter);
app.use("/api/v1/roles", rolesRouter); 













