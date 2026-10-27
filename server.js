const express = require('express');
const app = express();
const path = require('path');
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage
let circles = {};

app.get('/', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','index.html'), (err)=>{
    if(err){
      res.send(`
<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{background:#fff8e1;font-family:sans-serif;padding:15px;text-align:center}
.header{background:#ff6f00;color:white;padding:20px;border-radius:15px}
.btn{width:90%;max-width:350px;padding:18px;margin:10px;border:none;border-radius:12px;font-size:18px;font-weight:bold;color:white;cursor:pointer;display:block;margin:auto}
.orange{background:#ff6f00}.blue{background:#1565c0}
.card{background:white;padding:15px;border-radius:10px;margin:10px 0;text-align:left}
input,select{width:95%;padding:12px;margin:6px 0;border:1px solid #ccc;border-radius:8px}</style></head>
<body><div class="header"><h1>Chamacircles</h1><p>Till 4835569</p><small>Ranges 10-20, 21-30... Infinite</small></div>
<button class="btn orange" onclick="loadOccupied()">🟠 Occupied Ranges</button>
<button class="btn blue" onclick="loadNew()">🔵 New Ranges</button>
<div id="content"></div>
<script>
let pageOcc=0,pageNew=0;
async function loadOccupied(){
 const r=await fetch('/api/ranges/occupied?page='+pageOcc);
 const d=await r.json();
 let h='<h3>Occupied</h3>'; if(d.ranges.length==0) h+='<p>No circles yet</p>';
 d.ranges.forEach(c=>{h+='<div class=card><b>'+c.label+'</b> - '+c.members.length+'/10<br><small>'+c.members.map(m=>m.name).join(', ')+'</small></div>'});
 if(d.hasMore) h+='<button class="btn orange" onclick="pageOcc++;loadOccupied()">Next 5 →</button>';
 document.getElementById('content').innerHTML=h;
}
async function loadNew(){
 const r=await fetch('/api/ranges/available?page='+pageNew);
 const d=await r.json();
 let h='<h3>New Ranges</h3>';
 d.ranges.forEach(rg=>{h+='<div class=card><b>'+rg.label+'</b><button style="float:right;background:#1565c0;color:white;border:none;padding:8px 15px;border-radius:8px" onclick="showJoin('+rg.low+','+rg.high+')">Join</button><div style="clear:both"></div></div>'});
 h+='<button class="btn blue" onclick="pageNew++;loadNew()">Next 5 →</button>';
 document.getElementById('content').innerHTML=h;
}
function showJoin(low,high){
 let o=''; for(let i=low;i<=high;i++) o+='<option>'+i+'</option>';
 document.getElementById('content').innerHTML='<div class=card><h3>Join '+low+' to '+high+'</h3><input id=name placeholder="Name"><input id=phone placeholder="Phone 07..."><select id=amt>'+o+'</select><button class="btn orange" onclick="doJoin('+low+','+high+')">Join & Pay</button><button class="btn blue" onclick="loadNew()">Cancel</button></div>';
}
async function doJoin(low,high){
 const name=document.getElementById('name').value, phone=document.getElementById('phone').value, amount=document.getElementById('amt').value;
 if(!name||!phone) return alert('Enter name and phone');
 const res=await fetch('/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({low,high,name,phone,amount})});
 const data=await res.json(); if(data.error) return alert(data.error);
 alert('Joined! Pay '+data.totalToPay+' to Till 4835569. Members '+data.circle.members.length+'/10');
 if(data.beneficiary) alert('WINNER: '+data.beneficiary.name);
 loadOccupied();
}
loadNew();
</script></body></html>`);
    }
  });
});

app.get('/api/ranges/occupied', (req,res)=>{
  const page=parseInt(req.query.page||0);
  const all=Object.values(circles);
  const slice=all.slice(page*5,(page+1)*5);
  res.json({ranges:slice,hasMore:all.length>(page+1)*5});
});

app.get('/api/ranges/available', (req,res)=>{
  const page=parseInt(req.query.page||0);
  const ranges=[];
  let start=10+page*5*11;
  for(let i=0;i<5;i++){
    const low=start+i*11;
    const high=low+10;
    const key=low+'-'+high;
    if(!circles[key]) ranges.push({low,high,label:low+' to '+high});
  }
  let extra=0;
  while(ranges.length<5){
    const low=start+55+extra*11;
    const high=low+10;
    const key=low+'-'+high;
    if(!circles[key]) ranges.push({low,high,label:low+' to '+high});
    extra++;
  }
  res.json({ranges});
});

app.post('/api/join',(req,res)=>{
  const {low,high,name,phone,amount}=req.body;
  const key=low+'-'+high;
  if(!circles[key]) circles[key]={label:key,members:[],low,high,created:Date.now()};
  const c=circles[key];
  if(c.members.length>=10) return res.json({error:'Circle full!'});
  c.members.push({name,phone,amount:parseInt(amount),joined:Date.now()});
  const circleNum=Object.keys(circles).length;
  const totalToPay=high*10 + 8*circleNum;
  let beneficiary=null;
  if(c.members.length==10){
    const sorted=[...c.members].sort(()=>Math.random()-0.5);
    beneficiary=sorted[0];
  }
  res.json({circle:c,totalToPay,beneficiary});
});

app.post('/api/stkpush',(req,res)=>{ res.json({success:true,message:'STK would be sent to '+req.body.phone}); });

const PORT=process.env.PORT||10000;
app.listen(PORT,()=>console.log('Chamacircles running '+PORT));
