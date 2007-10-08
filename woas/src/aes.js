
// AES encryption for StickWiki
// adapted by legolas558
// license: GNU/GPL
// original code from http://home.versatel.nl/MAvanEverdingen/Code/
// this is a javascript conversion of a C implementation by Mike Scott

var bData;
var sData;
var aes_i;
var aes_j;
var tot;
var key = [];

var wMax = 0xFFFFFFFF;
function rotb(b,n){ return ( b<<n | b>>>( 8-n) ) & 0xFF; }
function rotw(w,n){ return ( w<<n | w>>>(32-n) ) & wMax; }
function getW(a,i){ return a[i]|a[i+1]<<8|a[i+2]<<16|a[i+3]<<24; }
function setW(a,i,w){ a.splice(i,4,w&0xFF,(w>>>8)&0xFF,(w>>>16)&0xFF,(w>>>24)&0xFF); }
function setWInv(a,i,w){ a.splice(i,4,(w>>>24)&0xFF,(w>>>16)&0xFF,(w>>>8)&0xFF,w&0xFF); }
function getB(x,n){ return (x>>>(n*8))&0xFF; }

	var utf8sets = [0x800,0x10000,0x110000];

	function unExpChar(c){
	  return "unexpected character '"+String.fromCharCode(c)+"' (code 0x"+c.toString(16)+").";
	}

	function utf8Encrypt(sData){
	  var k, i=0, z=sData.length;
	  var bData = [];
	  while (i<z) {
	    c = sData.charCodeAt(i++);
	    if (c<0x80){ bData.push(c); continue; }
	    k=0; while(k<utf8sets.length && c>=utf8sets[k]) k++;
	    if (k>=utf8sets.length) {
			alert("UTF-8: "+unExpChar(c));
			return null;
		}
		j=bData.length;
	    for (var n=j+k+1;n>j;n--){ bData[n]=0x80|(c&0x3F); c>>>=6; }
	    bData[j]=c+((0xFF<<(6-k))&0xFF);
	    j += k+2;
	  }
	  return bData;
	}

	function utf8Decrypt(bData){
	  var z=bData.length;
	  var c;
	  var k, d = 0, i = 0;
	  var sData = "";
	  while (i<z) {
	    c = bData[i++];
	    k=0; while(c&0x80){ c=(c<<1)&0xFF; k++; }
	    c >>= k;
	    if (k==1||k>4) {
	//		throw
			log('UTF-8: invalid first byte');	// log:1
			return null;
		}
	    for (var n=1;n<k;n++){
	      d = bData[i++];
	      if (d<0x80||d>0xBF) break;
	      c=(c<<6)+(d&0x3F);
	    }
	    if ( (k==2&&c<0x80) || (k>2&&c<utf8sets[k-3]) ) {
			log("UTF-8: invalid sequence");	// log:1
			return null;
		}
	    sData+=String.fromCharCode(c);
	  }
	  return sData;
	}

function split_bytes(s) {
	var l=s.length;
	var arr=[];
	for(var i=0;i<l;i++)
		arr.push(s.charCodeAt(i));
	return arr;
}
	
function merge_bytes(arr) {
	var l=arr.length;
	var s="";
	for(var i=0;i<l;i++)
		s+=String.fromCharCode(arr[i]);
	return s;
}

var aesNk;
var aesNr;

var aesPows;
var aesLogs;
var aesSBox;
var aesSBoxInv;
var aesRco;
var aesFtable;
var aesRtable;
var aesFi;
var aesRi;
var aesFkey;
var aesRkey;

function aesMult(x, y){ return (x&&y) ? aesPows[(aesLogs[x]+aesLogs[y])%255]:0; }

function aesPackBlock() {
  return [ getW(bData,aes_i), getW(bData,aes_i+4), getW(bData,aes_i+8), getW(bData,aes_i+12) ];
}

function aesUnpackBlock(packed){
  for ( var mj=0; mj<4; mj++,aes_i+=4) setW( bData, aes_i, packed[mj] );
}

function aesXTime(p){
  p <<= 1;
  return p&0x100 ? p^0x11B : p;
}

function aesSubByte(w){
  return aesSBox[getB(w,0)] | aesSBox[getB(w,1)]<<8 | aesSBox[getB(w,2)]<<16 | aesSBox[getB(w,3)]<<24;
}

function aesProduct(w1,w2){
  return aesMult(getB(w1,0),getB(w2,0)) ^ aesMult(getB(w1,1),getB(w2,1))
       ^ aesMult(getB(w1,2),getB(w2,2)) ^ aesMult(getB(w1,3),getB(w2,3));
}

function aesInvMixCol(x){
  return aesProduct(0x090d0b0e,x)     | aesProduct(0x0d0b0e09,x)<<8 |
         aesProduct(0x0b0e090d,x)<<16 | aesProduct(0x0e090d0b,x)<<24;
}

function aesByteSub(x){
  var y=aesPows[255-aesLogs[x]];
  x=y;  x=rotb(x,1);
  y^=x; x=rotb(x,1);
  y^=x; x=rotb(x,1);
  y^=x; x=rotb(x,1);
  return x^y^0x63;
}

function aesGenTables(){
  var i,y;
  aesPows = [ 1,3 ];
  aesLogs = [ 0,0,null,1 ];
  aesSBox = new Array(256);
  aesSBoxInv = new Array(256);
  aesFtable = new Array(256);
  aesRtable = new Array(256);
  aesRco = new Array(30);

  for ( i=2; i<256; i++){
    aesPows[i]=aesPows[i-1]^aesXTime( aesPows[i-1] );
    aesLogs[aesPows[i]]=i;
  }

  aesSBox[0]=0x63;
  aesSBoxInv[0x63]=0;
  for ( i=1; i<256; i++){
    y=aesByteSub(i);
    aesSBox[i]=y; aesSBoxInv[y]=i;
  }

  for (i=0,y=1; i<30; i++){ aesRco[i]=y; y=aesXTime(y); }

  for ( i=0; i<256; i++){
    y = aesSBox[i];
    aesFtable[i] = aesXTime(y) | y<<8 | y<<16 | (y^aesXTime(y))<<24;
    y = aesSBoxInv[i];
    aesRtable[i]= aesMult(14,y) | aesMult(9,y)<<8 |
                  aesMult(13,y)<<16 | aesMult(11,y)<<24;
  }
}

function aesInit(){
  key=key.slice(0,32);
  var i,k,m;
  var j = 0;
  var l = key.length;

  while ( l!=16 && l!=24 && l!=32 ) key[l++]=key[j++];
  aesGenTables();

  aesNk = key.length >>> 2;
  aesNr = 6 + aesNk;

  var N=4*(aesNr+1);
  
  aesFi = new Array(12);
  aesRi = new Array(12);
  aesFkey = new Array(N);
  aesRkey = new Array(N);

  for (m=j=0;j<4;j++,m+=3){
    aesFi[m]=(j+1)%4;
    aesFi[m+1]=(j+2)%4;
    aesFi[m+2]=(j+3)%4;
    aesRi[m]=(4+j-1)%4;
    aesRi[m+1]=(4+j-2)%4;
    aesRi[m+2]=(4+j-3)%4;
  }

  for (i=j=0;i<aesNk;i++,j+=4) aesFkey[i]=getW(key,j);

  for (k=0,j=aesNk;j<N;j+=aesNk,k++){
    aesFkey[j]=aesFkey[j-aesNk]^aesSubByte(rotw(aesFkey[j-1], 24))^aesRco[k];
    if (aesNk<=6)
      for (i=1;i<aesNk && (i+j)<N;i++) aesFkey[i+j]=aesFkey[i+j-aesNk]^aesFkey[i+j-1];
    else{
      for (i=1;i<4 &&(i+j)<N;i++) aesFkey[i+j]=aesFkey[i+j-aesNk]^aesFkey[i+j-1];
      if ((j+4)<N) aesFkey[j+4]=aesFkey[j+4-aesNk]^aesSubByte(aesFkey[j+3]);
      for (i=5;i<aesNk && (i+j)<N;i++) aesFkey[i+j]=aesFkey[i+j-aesNk]^aesFkey[i+j-1];
    }
  }

  for (j=0;j<4;j++) aesRkey[j+N-4]=aesFkey[j];
  for (i=4;i<N-4;i+=4){
    k=N-4-i;
    for (j=0;j<4;j++) aesRkey[k+j]=aesInvMixCol(aesFkey[i+j]);
  }
  for (j=N-4;j<N;j++) aesRkey[j-N+4]=aesFkey[j];
}

function aesClose(){
  aesPows=aesLogs=aesSBox=aesSBoxInv=aesRco=null;
  aesFtable=aesRtable=aesFi=aesRi=aesFkey=aesRkey=null;
}

function aesRounds( block, key, table, inc, box ){
  var tmp = new Array( 4 );
  var i,j,m,r;

  for ( r=0; r<4; r++ ) block[r]^=key[r];
  for ( i=1; i<aesNr; i++ ){
    for (j=m=0;j<4;j++,m+=3){
      tmp[j]=key[r++]^table[block[j]&0xFF]^
			rotw(table[(block[inc[m  ]]>>> 8)&0xFF], 8)^
			rotw(table[(block[inc[m+1]]>>>16)&0xFF],16)^
			rotw(table[(block[inc[m+2]]>>>24)&0xFF],24);
    }
    var t=block; block=tmp; tmp=t;
  }

  for (j=m=0;j<4;j++,m+=3)
    tmp[j]=key[r++]^box[block[j]&0xFF]^
           rotw(box[(block[inc[m  ]]>>> 8)&0xFF], 8)^
           rotw(box[(block[inc[m+1]]>>>16)&0xFF],16)^
           rotw(box[(block[inc[m+2]]>>>24)&0xFF],24);
  return tmp;
}

function aesEncrypt(){
  aesUnpackBlock( aesRounds(aesPackBlock(), aesFkey, aesFtable, aesFi, aesSBox ) );
}

function aesDecrypt(){
  aesUnpackBlock( aesRounds(aesPackBlock(), aesRkey, aesRtable, aesRi, aesSBoxInv ) );
}

// Blockcipher

function blcEncrypt(enc){
  if (tot==0){
//    prgr = name;
    if (key.length<1) return;
    //if (cbc)
	for (aes_i=0; aes_i<16; aes_i++) bData.unshift( _rand(256) );
    while( bData.length%16!=0 ) bData.push(0);
    tot = bData.length;
    aesInit();
  }else{
    //if (cbc)
	for (aes_j=aes_i; aes_j<aes_i+16; aes_j++) bData[aes_j] ^= bData[aes_j-16];
    enc();
  }
  if (aes_i>=tot) aesClose();
}

function blcDecrypt(dec){
  if (tot==0){
//    prgr = name;
    if (key.length<1) return;
    //if (cbc)
	{ aes_i=16; }
    tot = bData.length;
    if ( (tot%16) || tot<aes_i ) throw 'AES: Incorrect length (tot='+tot+', aes_i='+aes_i+')';
    aesInit();
  }else{
    //if (cbc)
	aes_i=tot-aes_i;
    dec();
    //if (cbc) {
      for (aes_j=aes_i-16; aes_j<aes_i; aes_j++) bData[aes_j] ^= bData[aes_j-16];
      aes_i = tot+32-aes_i;
    }
  }
  if (aes_i>=tot){
    aesClose();
    //if (cbc)
	bData.splice(0,16);
	while(bData[bData.length-1]==0) bData.pop();
  }
}

// sets global key to the utf-8 encoded key
function AES_setKey(sKey) {
	key = utf8Encrypt(sKey);
//	key = split_bytes(sKey);
}

function AES_clearKey() {
	key = [];
}

// returns an array of encrypted characters
function AES_encrypt(raw_data) {
	
	bData = utf8Encrypt(raw_data);
	
	aes_i=tot=0;
	do{ blcEncrypt(aesEncrypt); } while (aes_i<tot);
	
	return bData;
}

// decrypts an array of encrypted characters
function AES_decrypt(raw_data) {
	bData = raw_data;
	
	aes_i=tot=0;
	do{ blcDecrypt(aesDecrypt); } while (aes_i<tot);
	
	sData = utf8Decrypt(bData);
	bData = [];
	return sData;
}
