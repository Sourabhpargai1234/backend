import mongoose, {Schema} from "mongoose"
const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId,  //who subscribes here
        ref: "User"
    },
    channel: {
        type: Schema.Types.ObjectId,  //who is being subscribed
        ref: "User"
    }
},{timestamps: true})
export const Subscription = mongoose.model("Subscription", subscriptionSchema)