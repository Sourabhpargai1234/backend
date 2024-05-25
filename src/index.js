import connectDB from "./db/index.js";
import 'dotenv/config'

connectDB()
.then(() => {
    app.on("error", (error) => {
        console.log("Error: ",error)
        throw error
    })
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server served at port ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("Mongo DB connecton failed !!! ",err);
})