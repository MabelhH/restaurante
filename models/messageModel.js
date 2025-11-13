const mongoose=require('mongoose')
const Shema=mongoose.Schema
const MessageShema=new Shema({
    username:String,
    message:String
})
const Message=mongoose.model('Message',MessageShema)

module.exports=Message