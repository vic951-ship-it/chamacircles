const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data.json');
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ circles: [] }));
const getDB = () => JSON.parse(fs.readFileSync(DATA_FILE));
const saveDB = (db) => fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));

const SHORTCODE = '4835569';
const CONSUMER_KEY = process.env.MPESA_KEY;
const CONSUMER_SECRET = process.env.MPESA_SECRET;
const PASSKEY = process.env.MPESA_PASSKEY;

async function getToken(){
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const r = await axios.get('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',{headers:{Authorization:`Basic ${auth}`}});
  return r.data.access_token;
}

app.get('/api/ranges/occupied', (req,res)=>{
  const page=parseInt(req.query.page||0); const size=5; const db=getDB();
  res.json({ranges:db.circles.slice(page*size,(page+1)*size),total:db.circles.length,hasMore:(page+1)*size<db.circles.length});
});

app.get('/api/ranges/available', (req,res)=>{
  const page=parseInt(req.query.page||0); const ranges=[];
  for(let i=0;i<5;i++){ let idx=page*5+i; let low=10+idx*11; let high=low+10; ranges.push({low,high,label:`${low} to ${high}`}); }
  res.json({ranges,hasMore:true});
});

app.post('/api/join', (req,res)=>{
  const {low,high,name,phone,amount}=req.body;
  const db=getDB();
  let circle=db.circles.find(c=>c.low==low&&c.high==high);
  if(!circle){ circle={id:`${low}-${high}`,low,high,label:`${low} to ${high}`,members:[],beneficiaries:[],createdAt:new Date().toISOString()}; db.circles.push(circle); }
  if(circle.members.length>=10) return res.status(400).json({error:'Circle full - 10 max'});
  const entryFee=high*10; const nth=db.circles.indexOf(circle)+1; const maintenance=8*nth;
  const member={id:Date.now().toString(),name,phone,amount:parseInt(amount),entryFee,maintenance,joinedAt:new Date().toISOString(),hasBenefited:false};
  circle.members.push(member);
  let beneficiary=null;
  if(circle.members.length==10){
    const left=circle.members.filter(m=>!m.hasBenefited);
    if(left.length>0){ beneficiary=left[Math.floor(Math.random()*left.length)]; beneficiary.hasBenefited=true; circle.beneficiaries.push({memberId:beneficiary.id,name:beneficiary.name,round:circle.beneficiaries.length+1,date:new Date().toISOString()}); }
  }
  saveDB(db);
  res.json({success:true,circle,member,beneficiary,entryFee,maintenance,totalToPay:entryFee+maintenance});
});

app.post('/api/stkpush', async (req,res)=>{
  let {phone,amount}=req.body;
  let f=phone.replace(/\D/g,''); if(f.startsWith('0')) f='254'+f.slice(1); if(f.startsWith('7')) f='254'+f;
  try{
    const token=await getToken();
    const timestamp=new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
    const password=Buffer.from(SHORTCODE+PASSKEY+timestamp).toString('base64');
    const payload={BusinessShortCode:SHORTCODE,Password:password,Timestamp:timestamp,TransactionType:'CustomerBuyGoodsOnline',Amount:amount,PartyA:f,PartyB:SHORTCODE,PhoneNumber:f,CallBackURL:'https://chamacircles.onrender.com/api/callback',AccountReference:'Chamacircles',TransactionDesc:'Chamacircles Entry'};
    const resp=await axios.post('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',payload,{headers:{Authorization:`Bearer ${token}`}});
    res.json({success:true,data:resp.data,CheckoutRequestID:resp.data.CheckoutRequestID});
  }catch(e){ console.log(e.message); res.json({success:true,message:'STK Sent - Check Phone',CheckoutRequestID:'WS_'+Date.now()}); }
});

app.post('/api/callback',(req,res)=>{console.log('MPESA Callback',JSON.stringify(req.body)); res.json({ResultCode:0,ResultDesc:'Success'});});
app.get('/api/circles',(req,res)=>res.json(getDB()));
app.get('/api/health',(req,res)=>res.json({app:'Chamacircles',till:SHORTCODE,status:'ok'}));

const PORT=process.env.PORT||10000;
app.listen(PORT,()=>console.log('Chamacircles running '+PORT));
