const userLogin=(req,res,next)=>{
  let isLogin=true
  if (!isLogin) {
        return res.status(401).json({'mensage':'usuario no logueado'})

  }
  next()
}
module.exports=userLogin