const PAGE=document.body.dataset.page; // "home", "find" or "post"
const CX=300,CY=260,SCHOOL="Northern Bukidnon State College";
const dist=(x,y)=>Math.round(Math.hypot(x-CX,y-CY)*4/10)*10;
const hues=[["#7fd1b9","#2a9d8f"],["#f5b700","#e07a1f"],["#9ad1f5","#3d7ccf"],["#f4a6b8","#c9506f"],["#c3e88d","#5fa83a"],["#d3b8f5","#7a52c7"]];
const emo=["🏠","🛏️","🌿","🏡","📚","☀️"];
const seed=[]; // no sample rooms: only landlords add listings
let rooms=[...seed],favs=new Set(),flt={},sel=null;
try{favs=new Set(JSON.parse(localStorage.getItem("bn-favs")||"[]"));const u=JSON.parse(localStorage.getItem("bn-user")||"[]");rooms=rooms.concat(u)}catch(e){}
const $=s=>document.querySelector(s),peso=n=>"₱"+n.toLocaleString("en-PH");
const bg=r=>r.photo?`background-image:url(${r.photo})`:`background:linear-gradient(135deg,${hues[r.id%6][0]},${hues[r.id%6][1]})`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("show"),2600)}

/* Messages from renters to landlords (saved in this browser) */
let msgs=[];try{msgs=JSON.parse(localStorage.getItem("bn-msgs")||"[]")}catch(e){}
const saveMsgs=()=>{try{localStorage.setItem("bn-msgs",JSON.stringify(msgs));return true}catch(e){return false}};

/* ---- Google login (Google Identity Services) ----
   1. Create an OAuth "Web application" client ID at console.cloud.google.com > APIs & Services > Credentials
   2. Add your site origin (e.g. http://localhost:5500) under "Authorized JavaScript origins"
   3. Paste the client ID below */
const CLIENT_ID="PASTE_YOUR_CLIENT_ID.apps.googleusercontent.com";
let user=null,gInit=false;
try{const u=JSON.parse(localStorage.getItem("bn-auth")||sessionStorage.getItem("bn-auth")||"null");if(u&&u.exp>Date.now())user=u}catch(e){}
function parseJwt(t){const b=t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");return JSON.parse(decodeURIComponent(atob(b).split("").map(c=>"%"+("00"+c.charCodeAt(0).toString(16)).slice(-2)).join("")))}
function onCred(res){
 try{const p=parseJwt(res.credential);
  user={name:p.name||p.email,email:p.email,picture:p.picture||"",exp:Date.now()+7*864e5}; // keep session 7 days
  localStorage.setItem("bn-auth",JSON.stringify(user));
 }catch(e){toast("Login failed. Try again.");return}
 if(PAGE==="login")location.href=nextUrl();else location.reload();
}
function nextUrl(){const n=new URLSearchParams(location.search).get("next");return /^[a-z]+\.html$/.test(n||"")?n:"find.html"}
function renderAuth(){
 const a=document.getElementById("auth");if(!a)return;
 if(user){
  a.innerHTML=`<a class="btn so" href="messages.html">Messages${(n=>n?" ("+n+")":"")(msgs.filter(m=>m.owner===user.email&&!m.read).length)}</a>${user.picture?`<img class="avatar" src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">`:`<span class="avatar ini">${esc((user.name||"?")[0].toUpperCase())}</span>`}<span class="uname">${esc(user.name)}</span><button class="btn so" id="signOut">Sign out</button>`;
  document.getElementById("signOut").onclick=()=>{
   user=null;try{localStorage.removeItem("bn-auth");sessionStorage.removeItem("bn-auth")}catch(e){}
   if(window.google&&google.accounts)google.accounts.id.disableAutoSelect();
   location.reload();
  };
 }else{
  if(PAGE==="login"){a.innerHTML="";return}
  const cur=location.pathname.split("/").pop()||"index.html";
  a.innerHTML=`<a class="btn pri so" href="login.html?next=${encodeURIComponent(cur)}">Login</a>`;
 }
}
window.onGoogleLibraryLoad=renderAuth; // runs if the Google script finishes after this file

/* School location: Northern Bukidnon State College, Kihare, Tankulan, Manolo Fortich. Adjust LAT/LNG if the pin looks off. */
const LAT=8.3596,LNG=124.8686;
const ll=(x,y)=>[LAT-(y-CY)*0.000036,LNG+(x-CX)*0.000036];
const xy=(lat,lng)=>[Math.round(CX+(lng-LNG)/0.000036),Math.round(CY-(lat-LAT)/0.000036)]; // map position -> x,y
let map,layer,lastKey=null;
function drawMap(list){
 if(!map){
  map=L.map("map").setView([LAT,LNG],16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
   maxZoom:19,
   attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  L.marker([LAT,LNG],{title:SCHOOL}).addTo(map).bindTooltip(SCHOOL);
  [250,500,1000].forEach(r=>L.circle([LAT,LNG],{radius:r,color:"#0f3d3e",weight:1.5,dashArray:"5 6",fillOpacity:0}).addTo(map));
  layer=L.layerGroup().addTo(map);
 }
 layer.clearLayers();
 // One clickable marker per room
 list.forEach(r=>{
  const marker=L.marker(ll(r.x,r.y),{title:r.name}).addTo(layer);
  marker.bindTooltip(r.name+" · "+peso(r.price));
  marker.on("click",()=>openRoom(r.id));
 });
 // Fit the map only when the set of visible rooms changes, so opening a room or saving a heart doesn't make the map jump
 const key=list.map(r=>r.id).join(",");
 if(key!==lastKey){
  map.fitBounds([[LAT,LNG],...list.map(r=>ll(r.x,r.y))],{padding:[30,30],maxZoom:17});
  lastKey=key;
 }
}
function filtered(){
 let l=rooms.filter(r=>(!flt.price||r.price<1500)&&(!flt.dist||dist(r.x,r.y)<=500)&&(!flt.wifi||r.wifi)&&(!flt.bath||r.bath)&&(!flt.fav||favs.has(r.id)));
 return l.sort($("#sort").value==="price"?(a,b)=>a.price-b.price:(a,b)=>dist(a.x,a.y)-dist(b.x,b.y));
}
function render(){
 if(PAGE==="find"){
 const l=filtered();
 $("#list").innerHTML=l.length?l.map(r=>`<article class="card ${sel===r.id?"on":""}" data-id="${r.id}" tabindex="0" aria-label="View ${esc(r.name)}"><div class="photo" style="${bg(r)}">${r.photo?"":emo[r.id%6]}<button class="heart" data-fav="${r.id}" aria-pressed="${favs.has(r.id)}" aria-label="Save ${esc(r.name)}">${favs.has(r.id)?"♥":"♡"}</button><span class="badge">${dist(r.x,r.y)} m from campus</span></div><div class="cbody"><h3>${esc(r.name)}</h3><div class="meta">${esc(r.loc)}</div><div class="price">${peso(r.price)}<span class="meta"> /month</span></div><div>${r.wifi?'<span class="tag">WiFi</span>':""}${r.bath?'<span class="tag">Own bathroom</span>':""}</div>${user&&r.owner===user.email?`<button class="del" data-del="${r.id}" aria-label="Delete ${esc(r.name)}">Delete</button>`:""}</div></article>`).join(""):`<div class="empty">${rooms.length?"No rooms match these filters. Turn one off to see more rooms.":"No rooms posted yet.<br><a class=\"btn pri\" href=\"post.html\" style=\"margin-top:14px\">Post a Room</a>"}</div>`;
 $("#result").textContent=l.length+" of "+rooms.length+" rooms";
 drawMap(l);
 }
 if(PAGE==="home"){
 $("#sCount").textContent=rooms.length;$("#sNear").textContent=rooms.filter(r=>dist(r.x,r.y)<=500).length;$("#sMin").textContent=(rooms.length?peso(Math.min(...rooms.map(r=>r.price))):"–");
 }
}
function openRoom(id){
 const r=rooms.find(x=>x.id===id);if(!r)return;sel=id;render();
 const q=ll(r.x,r.y).join(",");
 $("#dTitle").textContent="Room details";
 $("#dBody").innerHTML=`<div class="big" style="${bg(r)}">${r.photo?"":emo[r.id%6]}</div>${r.photo?"":`<div class="thumbs">${[0,1,2].map(i=>`<span style="background:linear-gradient(135deg,${hues[(r.id+i)%6][0]},${hues[(r.id+i)%6][1]})">${emo[(r.id+i)%6]}</span>`).join("")}</div>`}
 <div><h3 style="font-size:1.5rem">${esc(r.name)}</h3><div class="meta">${esc(r.loc)} · ${dist(r.x,r.y)} m (about ${Math.max(1,Math.round(dist(r.x,r.y)/80))} min walk)</div><div class="price" style="font-size:1.2rem">${peso(r.price)} <span class="meta">/month</span></div><p>${esc(r.desc||"Contact the landlord for details.")}</p><span class="tag">${r.wifi?"WiFi":"No WiFi"}</span><span class="tag">${r.bath?"Own bathroom":"Shared bathroom"}</span></div>
 <a class="btn" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Open in Google Maps</a>
 <form id="msgForm" novalidate style="display:grid;gap:10px"><div class="lbl" style="margin:0">Ask the landlord a question</div><div class="qs">${["Is this room still available?","Can I visit this week?","Is the price negotiable?","How much is the deposit?"].map(q=>`<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div><input type="text" id="mName" placeholder="Your name" aria-label="Your name" value="${esc(user?user.name:"")}"><input type="text" id="mContact" placeholder="Your email or phone number" aria-label="Your email or phone number" value="${esc(user?user.email:"")}"><textarea id="mMsg" rows="3" placeholder="Type your question, like when you want to visit" aria-label="Message"></textarea><p class="err" id="mErr" role="alert"></p><button class="btn pri" style="justify-self:end">Send message</button></form>`;
 $("#msgForm").onsubmit=e=>{e.preventDefault();
  const n=$("#mName").value.trim(),c=$("#mContact").value.trim(),m=$("#mMsg").value.trim(),er=$("#mErr");
  if(!n){er.textContent="Enter your name so the landlord knows who is asking.";$("#mName").focus();return}
  if(c.length<7){er.textContent="Add your email or phone number so the landlord can reply.";$("#mContact").focus();return}
  if(m.length<10){er.textContent="Write a message of at least 10 characters, like when you want to visit.";$("#mMsg").focus();return}
  msgs.push({id:Date.now(),roomId:r.id,roomName:r.name,owner:r.owner||"",from:n,contact:c,text:m,t:Date.now(),read:false});
  if(!saveMsgs()){msgs.pop();er.textContent="Could not save the message (browser storage is full).";return}
  $("#dlg").close();toast("Message sent to the landlord of "+r.name)};
 $("#dBody").querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>{const t=$("#mMsg");t.value=(t.value?t.value+" ":"")+b.dataset.q;t.focus()});
 $("#dlg").showModal();
}
if(PAGE==="find"){
$("#dClose").onclick=()=>$("#dlg").close();
$("#dlg").addEventListener("click",e=>{if(e.target.id==="dlg")e.target.close()});
$("#list").addEventListener("click",e=>{const f=e.target.closest("[data-fav]");
 const d=e.target.closest("[data-del]");
 if(d){e.stopPropagation();const id=+d.dataset.del,r=rooms.find(x=>x.id===id);
  if(r&&user&&r.owner===user.email&&confirm('Delete "'+r.name+'"? This cannot be undone.')){rooms=rooms.filter(x=>x.id!==id);favs.delete(id);if(sel===id)sel=null;
   try{localStorage.setItem("bn-user",JSON.stringify(rooms));localStorage.setItem("bn-favs",JSON.stringify([...favs]))}catch(x){}
   render();toast("Room deleted")}
  return}
 if(f){e.stopPropagation();const id=+f.dataset.fav;favs.has(id)?favs.delete(id):favs.add(id);try{localStorage.setItem("bn-favs",JSON.stringify([...favs]))}catch(x){}render();return}
 const c=e.target.closest(".card");if(c)openRoom(+c.dataset.id)});
// Keyboard: Enter or Space on a focused card opens it
$("#list").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.classList.contains("card")){e.preventDefault();openRoom(+e.target.dataset.id)}});
$("#chips").addEventListener("click",e=>{const b=e.target.closest("button[data-f]");if(!b)return;const k=b.dataset.f;flt[k]=!flt[k];b.setAttribute("aria-pressed",flt[k]);render()});
$("#sort").onchange=render;
}

/* Post form (post.html only) */
if(PAGE==="post"){
let photo="";
if(!user){$("#postForm").style.display="none";$("#gate").style.display="block"}
/* Map picker: tap the map to place the pin */
const pm=L.map("pick").setView([LAT,LNG],16);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(pm);
L.circleMarker([LAT,LNG],{radius:9,color:"#0f3d3e",fillColor:"#f5b700",fillOpacity:1,weight:3}).addTo(pm).bindTooltip(SCHOOL);
let pin=null,pos=null;
let auto=true,geoTimer; // auto = Location box was filled by the map, not typed by the landlord
$("#pLoc").addEventListener("input",()=>{auto=false});
function fillAddress(lat,lng){
 clearTimeout(geoTimer);
 geoTimer=setTimeout(async()=>{
  const box=$("#pLoc"),canFill=()=>auto||!box.value.trim();
  try{
   const res=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`);
   const d=await res.json(),ad=d.address||{};
   const text=[ad.road||ad.pedestrian||ad.amenity,ad.neighbourhood||ad.suburb||ad.village||ad.hamlet,ad.city||ad.town||ad.municipality||ad.county].filter(Boolean).join(", ")||d.display_name||"";
   if(text&&canFill()){box.value=text;auto=true}
   else if(!text&&canFill()){box.value=lat.toFixed(5)+", "+lng.toFixed(5);auto=true}
  }catch(e){
   if(canFill()){box.value=lat.toFixed(5)+", "+lng.toFixed(5);auto=true}
  }
 },400);
}
function setPin(lat,lng){
 pos=[lat,lng];
 if(pin)pin.setLatLng(pos);
 else{pin=L.marker(pos,{draggable:true}).addTo(pm);pin.on("dragend",()=>{const q=pin.getLatLng();setPin(q.lat,q.lng)})}
 const p=xy(lat,lng);
 $("#pickInfo").textContent="Pin set: "+dist(p[0],p[1])+" m from the school.";
 $("#pErr").textContent="";
 fillAddress(lat,lng);
}
pm.on("click",e=>setPin(e.latlng.lat,e.latlng.lng));
$("#useMe").onclick=()=>{
 if(!navigator.geolocation){$("#pErr").textContent="Your browser can't get your location. Tap the map instead.";return}
 navigator.geolocation.getCurrentPosition(g=>{setPin(g.coords.latitude,g.coords.longitude);pm.setView(pos,17)},()=>{$("#pErr").textContent="Could not get your location. Tap the map instead."});
};
$("#drop").onclick=()=>$("#pFile").click();
$("#drop").onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("#pFile").click()}};
$("#pFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement("canvas"),s=Math.min(1,600/im.width);c.width=im.width*s;c.height=im.height*s;c.getContext("2d").drawImage(im,0,0,c.width,c.height);photo=c.toDataURL("image/jpeg",.7);$("#drop").style.backgroundImage=`url(${photo})`;$("#drop").textContent=""};im.src=rd.result};rd.readAsDataURL(f)};
$("#postForm").onsubmit=e=>{e.preventDefault();
 if(!user){toast("Login first");return}
 const n=$("#pName").value.trim(),l=$("#pLoc").value.trim(),p=+$("#pPrice").value;
 if(!n||!l||!(p>0)){$("#pErr").textContent="Fill in the boarding house name, location and a price above ₱0.";return}
 if(!pos){$("#pErr").textContent="Tap the map to drop a pin where your boarding house is.";return}
 $("#pErr").textContent="";
 let id;do{id=Date.now()*1000+Math.floor(Math.random()*1000)}while(rooms.some(x=>x.id===id)); // unique numeric id
 const r={id,name:n,loc:l,price:p,x:xy(pos[0],pos[1])[0],y:xy(pos[0],pos[1])[1],wifi:$("#pWifi").checked?1:0,bath:$("#pBath").checked?1:0,photo,owner:user.email,ownerName:user.name,desc:"New listing. Message the landlord for details."};
 rooms.push(r);try{const u=rooms.filter(x=>!seed.includes(x));localStorage.setItem("bn-user",JSON.stringify(u))}catch(x){}
 e.target.reset();photo="";$("#drop").style.backgroundImage="";$("#drop").textContent="Upload photo";
 location.href="find.html#posted"; // go to the Find a Room page
};
}

/* Login page (login.html): email + password, sign up, forgot password, Google */
if(PAGE==="login"){
 if(user)location.replace(nextUrl());
 const KEY="bn-accounts";
 const accts=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){return{}}};
 const saveA=a=>localStorage.setItem(KEY,JSON.stringify(a));
 const hashPw=async(pw,salt)=>{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(salt+pw));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")};
 const M={
  login:{t:"Login",s:'Don\'t have an account? <a href="#" data-mode="signup">Sign up now</a>',b:"Log In",name:0,conf:0,rem:1,forgot:1},
  signup:{t:"Create account",s:'Already have an account? <a href="#" data-mode="login">Log in</a>',b:"Sign Up",name:1,conf:1,rem:0,forgot:0},
  forgot:{t:"Reset password",s:'Remembered it? <a href="#" data-mode="login">Back to Login</a>',b:"Reset Password",name:0,conf:0,rem:0,forgot:0}
 };
 let mode="login";
 function setMode(m){mode=m;const c=M[m];
  $("#aTitle").textContent=c.t;$("#aSub").innerHTML=c.s;$("#aBtn").textContent=c.b;
  $("#fName").hidden=!c.name;$("#fConf").hidden=!c.conf;$("#fRem").hidden=!c.rem;$("#forgotRow").hidden=!c.forgot;
  $("#aNote").hidden=m!=="forgot";
  $("#passLbl").textContent=m==="forgot"?"New password":"Password";
  $("#aPass").autocomplete=m==="login"?"current-password":"new-password";
  $("#aErr").textContent="";
 }
 $("#authCard").addEventListener("click",e=>{const l=e.target.closest("[data-mode]");if(l){e.preventDefault();setMode(l.dataset.mode)}});
 $("#aEye").onclick=()=>{const p=$("#aPass"),h=p.type==="password";p.type=h?"text":"password";$("#aEye").textContent=h?"🙈":"👁";$("#aEye").setAttribute("aria-label",h?"Hide password":"Show password")};
 function finish(em,x,remember){
  user={name:x.name,email:em,picture:"",exp:Date.now()+(remember?30:1)*864e5};
  try{(remember?localStorage:sessionStorage).setItem("bn-auth",JSON.stringify(user))}catch(e){}
  location.href=nextUrl();
 }
 $("#authForm").onsubmit=async e=>{e.preventDefault();
  const err=$("#aErr"),em=$("#aEmail").value.trim().toLowerCase(),pw=$("#aPass").value;err.textContent="";
  if(!/^\S+@\S+\.\S+$/.test(em)){err.textContent="Enter a valid email address.";$("#aEmail").focus();return}
  if(pw.length<6){err.textContent="Password must be at least 6 characters.";$("#aPass").focus();return}
  if(!(window.crypto&&crypto.subtle)){err.textContent="Open the site with http://localhost or https so login can work.";return}
  const a=accts(),newSalt=()=>crypto.getRandomValues(new Uint32Array(2)).join("-");
  if(mode==="signup"){
   const nm=$("#aName").value.trim();
   if(!nm){err.textContent="Enter your full name.";$("#aName").focus();return}
   if(pw!==$("#aConf").value){err.textContent="Passwords do not match.";$("#aConf").focus();return}
   if(a[em]){err.textContent="An account with this email already exists. Log in instead.";return}
   const salt=newSalt();a[em]={name:nm,salt,hash:await hashPw(pw,salt)};saveA(a);finish(em,a[em],true);
  }else if(mode==="forgot"){
   if(!a[em]){err.textContent="No account with that email on this device.";return}
   const salt=newSalt();a[em].salt=salt;a[em].hash=await hashPw(pw,salt);saveA(a);
   setMode("login");$("#aPass").value="";toast("Password updated. Log in with your new password.");
  }else{
   const x=a[em];
   if(!x||x.hash!==await hashPw(pw,x.salt)){err.textContent="Wrong email or password.";return}
   finish(em,x,$("#aRem").checked);
  }
 };
 function gInitBtn(){
  const w=$("#gWrap");
  if(CLIENT_ID.startsWith("PASTE_")){w.hidden=true;return}
  if(!(window.google&&google.accounts))return;
  if(!gInit){google.accounts.id.initialize({client_id:CLIENT_ID,callback:onCred});gInit=true}
  google.accounts.id.renderButton($("#gBtn"),{theme:"outline",size:"large",text:"continue_with",shape:"rectangular",width:300});
 }
 gInitBtn();window.onGoogleLibraryLoad=()=>{renderAuth();gInitBtn()};
 setMode("login");
}

/* Landlord inbox (messages.html) */
if(PAGE==="messages"){
 const box=$("#msgList");
 const fmt=t=>new Date(t).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"});
 function drawInbox(){
  const mine=msgs.filter(m=>m.owner===user.email).sort((a,b)=>b.t-a.t);
  box.innerHTML=mine.length?mine.map(m=>{
   const mail=m.contact.includes("@"),href=mail?"mailto:"+encodeURI(m.contact)+"?subject="+encodeURIComponent("Re: "+m.roomName):"tel:"+m.contact.replace(/[^\d+]/g,"");
   return `<article class="msg ${m.read?"":"new"}"><div class="mh"><b>${esc(m.from)}</b><span class="meta">${fmt(m.t)}</span></div><div class="meta">About: ${esc(m.roomName)} · ${esc(m.contact)}</div><p>${esc(m.text)}</p><div class="macts"><a class="btn so" href="${esc(href)}">${mail?"Reply by email":"Call"}</a><button class="btn so" data-del="${m.id}">Delete</button></div></article>`}).join(""):
   `<div class="empty">No messages yet. When someone asks about your room, it shows up here.</div>`;
  if(mine.some(m=>!m.read)){mine.forEach(m=>m.read=true);saveMsgs()}
 }
 if(!user){box.innerHTML=`<div class="empty">Login to see questions about your rooms.<br><a class="btn pri" href="login.html?next=messages.html" style="margin-top:14px">Login</a></div>`}
 else{
  drawInbox();
  box.addEventListener("click",e=>{const d=e.target.closest("[data-del]");if(!d)return;const id=+d.dataset.del;msgs=msgs.filter(m=>m.id!==id);saveMsgs();drawInbox();toast("Message deleted")});
 }
}

/* Theme + menu */
const root=document.documentElement;
function setTheme(t){root.dataset.theme=t;try{localStorage.setItem("bn-theme",t)}catch(e){}$("#theme").textContent=t==="dark"?"☀":"☾"}
let saved=null;try{saved=localStorage.getItem("bn-theme")}catch(e){}
setTheme(saved||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"));
$("#theme").onclick=()=>setTheme(root.dataset.theme==="dark"?"light":"dark");
$("#menuBtn").onclick=()=>{const o=$("#nav").classList.toggle("open");$("#menuBtn").setAttribute("aria-expanded",o)};
$("#nav").addEventListener("click",()=>$("#nav").classList.remove("open"));
renderAuth();
render();
if(PAGE==="find"&&location.hash==="#posted"){toast("Room posted");history.replaceState(null,"","find.html")}