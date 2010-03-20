// AES encryption for StickWiki
// adapted by legolas558
// license: GNU/GPL
// original code from http://home.versatel.nl/MAvanEverdingen/Code/
// this is a javascript conversion of a C implementation by Mike Scott

/*
There are 287 matches for woas.AES in the current 0.11.0 code; 9 are outside aes.js
With the wrapper there are just the API assignments at the end and external API calls.
Code is therefore much easier to read and understand, I find.
*/

// namespace wrapper
(function() {
	
var bData = null,
	sData = null,
	aes_i = null,
	aes_j = null,
	tot = null,
	key =  [],
	wMax =  0xFFFFFFFF,
	aesNk = null,
	aesNr = null,
	aesPows = null,
	aesLogs = null,
	aesSBox = null,
	aesSBoxInv = null,
	aesRco = null,
	aesFtable = null,
	aesRtable = null,
	aesFi = null,
	aesRi = null,
	aesFkey = null,
	aesRkey = null;

rotb = function(b,n){ return ( b<<n | b>>>( 8-n) ) & 0xFF; }
rotw = function(w,n){ return ( w<<n | w>>>(32-n) ) & wMax; }
getW = function(a,i){ return a[i]|a[i+1]<<8|a[i+2]<<16|a[i+3]<<24; }
setW = function(a,i,w){ a.splice(i,4,w&0xFF,(w>>>8)&0xFF,(w>>>16)&0xFF,(w>>>24)&0xFF); }
setWInv = function(a,i,w){ a.splice(i,4,(w>>>24)&0xFF,(w>>>16)&0xFF,(w>>>8)&0xFF,w&0xFF); }
getB = function(x,n){ return (x>>>(n*8))&0xFF; }

/*	var utf8sets = [0x800,0x10000,0x110000];

	function unExpChar(c){
	  return "unexpected character '"+String.fromCharCode(c)+"' (code 0x"+c.toString(16)+").";
	}
*/

utf8Encrypt_s = function(sData) {
	return unescape( encodeURIComponent( sData ) );
}

utf8Encrypt = function(sData){
		return split_bytes(utf8Encrypt_s(sData));
/*	  var k, i=0, z=sData.length;
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
	  return bData; */
	}

utf8Decrypt_s = function(sData) {
		try {
			return decodeURIComponent( escape( sData ) );
		}
		catch (e) {
			log(e);	//log:1
		}
		return null;
	}

utf8Decrypt = function(bData){
	return utf8Decrypt_s(merge_bytes(bData));
}
/*	  var z=bData.length;
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
	  return sData; */

split_bytes = function(s) {
	var l=s.length;
	var arr=[];
	for(var i=0;i<l;i++)
		arr.push(s.charCodeAt(i));
	return arr;
}
	
merge_bytes = function(arr) {
	var l=arr.length;
	var s="";
	for(var i=0;i<l;i++)
		s+=String.fromCharCode(arr[i]);
	return s;
}

aesMult = function(x, y){ return (x&&y) ? aesPows[(aesLogs[x]+aesLogs[y])%255]:0; }

aesPackBlock = function() {
	return [ getW(bData,aes_i), getW(bData,aes_i+4),
			getW(bData,aes_i+8), getW(bData,aes_i+12) ];
}

aesUnpackBlock = function(packed){
  for ( var mj=0; mj<4; mj++,aes_i+=4) setW( bData, aes_i, packed[mj] );
}

aesXTime = function(p){
  p <<= 1;
  return p&0x100 ? p^0x11B : p;
}

aesSubByte = function(w){
  return aesSBox[getB(w,0)] | aesSBox[getB(w,1)]<<8 | aesSBox[getB(w,2)]<<16 | aesSBox[getB(w,3)]<<24;
}

aesProduct = function(w1,w2){
  return aesMult(getB(w1,0),getB(w2,0)) ^ aesMult(getB(w1,1),getB(w2,1))
       ^ aesMult(getB(w1,2),getB(w2,2)) ^ aesMult(getB(w1,3),getB(w2,3));
}

aesInvMixCol = function(x){
  return aesProduct(0x090d0b0e,x)     | aesProduct(0x0d0b0e09,x)<<8 |
         aesProduct(0x0b0e090d,x)<<16 | aesProduct(0x0e090d0b,x)<<24;
}

aesByteSub = function(x){
  var y=aesPows[255-aesLogs[x]];
  x=y;  x=rotb(x,1);
  y^=x; x=rotb(x,1);
  y^=x; x=rotb(x,1);
  y^=x; x=rotb(x,1);
  return x^y^0x63;
}

aesGenTables = function(){
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

  aesFi = new Array(12);
  aesRi = new Array(12);

  for (m=j=0;j<4;j++,m+=3){
    aesFi[m]=(j+1)%4;
    aesFi[m+1]=(j+2)%4;
    aesFi[m+2]=(j+3)%4;
    aesRi[m]=(4+j-1)%4;
    aesRi[m+1]=(4+j-2)%4;
    aesRi[m+2]=(4+j-3)%4;
  }

}

// these tables can be static
aesGenTables();

aesInit = function(){
  key=key.slice(0,43);
  var i,k,m;
  var j = 0;
  var l = key.length;

  while ( l!=16 && l!=24 && l!=32 && l!=43) key[l++]=key[j++];

  aesNk = key.length >>> 2;
  aesNr = 6 + aesNk;

  var N=4*(aesNr+1);
  aesFkey = new Array(N);
  aesRkey = new Array(N);

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

aesClose = function(){
//  aesFi=aesRi=aesPows=aesLogs=aesSBox=aesSBoxInv=aesRco=aesFtable=aesRtable=null;
  aesFkey=aesRkey=null;
}

aesRounds = function( block, key, table, inc, box ){
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

_encrypt = function(){
  aesUnpackBlock( aesRounds(aesPackBlock(), aesFkey, aesFtable, aesFi, aesSBox ) );
}

_decrypt = function(){
  aesUnpackBlock( aesRounds(aesPackBlock(), aesRkey, aesRtable, aesRi, aesSBoxInv ) );
}

// Blockcipher

blcEncrypt = function(enc){
  if (tot==0){
//    prgr = name;
    if (key.length<1) return;
    // if (cbc)
    // pre-pend random data to pad length? really?
	for (aes_i=0; aes_i<16; ++aes_i) bData.unshift( _rand(256) );
    while( bData.length%16!=0 ) bData.push(0);
    tot = bData.length;
    aesInit();
  }else{
    // if (cbc)
	for (aes_j=aes_i; aes_j<aes_i+16; aes_j++)
		bData[aes_j] ^= bData[aes_j-16];
    enc();
  }
  if (aes_i>=tot) aesClose();
}

blcDecrypt = function(dec){
	// initialize length
  if (tot==0){
//    prgr = name;
    if (key.length<1) return false;
    // if (cbc)
	{ aes_i=16; }
    tot = bData.length;
    if ( (tot%16) || (tot<aes_i) ) {
		log('AES: Incorrect length (tot='+tot+', aes_i='+aes_i+')'); //log:1
		return false;
	}
    aesInit();
  }else{
    // if (cbc)
	aes_i=tot-aes_i;
    dec();
    // if (cbc)
	{
      for (aes_j=aes_i-16; aes_j<aes_i; aes_j++) bData[aes_j] ^= bData[aes_j-16];
      aes_i = tot+32-aes_i;
    }
  }
  if (aes_i>=tot){
    aesClose();
    // if (cbc)
	bData.splice(0,16);
	// remove 0s added for padding (supposedly!)
	while(bData[bData.length-1]==0) bData.pop();
  }
  return true;
}

// sets global key to the utf-8 encoded key (byte array)
setKey = function(sKey) {
	key = woas.utf8Encrypt(sKey);
}

clearKey = function() {
	key = [];
}

// returns an array of encrypted characters
encrypt = function(raw_data) {
	bData = woas.utf8Encrypt(raw_data);
	
	aes_i=tot=0;
	do{ blcEncrypt(_encrypt); } while (aes_i<tot);
	
	var rv = bData;
	bData = null;
	return rv;
}

// decrypts an array of encrypted characters
decrypt = function(raw_data) {
	bData = raw_data;
	
	aes_i=tot=0;
	do {
		if (!blcDecrypt(_decrypt))
			return null;
	} while (aes_i<tot);
	
	sData = woas.utf8Decrypt(bData);
	bData = [];
	var rv = sData;
	sData = null;
	return rv;
}

function isKeySet(){
	return key.length > 0 ? true : false;
}

/*
Expose namespace; this allows:
* simple calls in above code, so much more readable;
* obvious definition of API;
* for API to be overridden in a manner that allows simple chaining.
This is all that is exposed.

(Also, if namespace was "woas.crypto" would allow replacement plugins for different
crypto methods to be called; a sort of Inversion Of Control injection. Pages could
define their encryption method ("woas.page.encryption: aes256" ?) if desired, and
the code just hooks into the defined api as here.

Could work for other namespace APIs also.)
*/
if (woas.AES === undefined) woas.AES = {};

woas.AES.clearKey = clearKey;
woas.AES.setKey = setKey;
woas.AES.encrypt = encrypt;
woas.AES.decrypt = decrypt;

/*
I added this to stickwiki.js (replaced "key.length" with "isKeySet()"; 
changes are trivial, but keep the key private, as it should be.
(Also, just doing something like "woas.AES.key = key" doesn't work; would
have to use woas.key above, I think. Haven't researched alternatives yet,
but it is better to keep access to private data closed.)
*/
woas.AES.isKeySet = isKeySet;

/*
As the functions below are outside of this namespace they are probably in
the wrong file or need to be renamed.

They could also be kept in this file but moved outside of the wrapper (with
"woas." added to the calls inside the wrapper, of course). When learning new
code it can be quite frustrating to find utility functions scattered around
the files though (or is it just me?).
*/
woas.merge_bytes = merge_bytes;
woas.split_bytes = split_bytes;
woas.utf8Encrypt = utf8Encrypt;
woas.utf8Decrypt = utf8Decrypt;

// end namespace wrapper
})();

/*
AFAIK, this wrapper behaviour is standard javascript functionality and always
has been. I don't believe any browsers have issues with this from what I've read.

Another way to do this is to define the public API functions within the code
according to the namespace; e.g.:
  woas.AES.clearKey = function(){key = [];}
Now you don't have to manually expose the API, but the other wrapper advantages
disappear somewhat.

The wrapper can also have information passed in:
  (function(info, obj){ ... })(my.info, {some:"data"});
Such parameter data is part of the function closure and remains available to
the code. jQuery uses this technique, among others. I used this in experiments
to pass in the namespace, making it dynamic:
  woas.myNs = {};
  (function(ns){
    ns.func1 = function() {}; //  and/or
	ns.func2 = funct2; // for defining API as before.
  })(woas.myNs);
Useful in terms of module reuse perhaps but I haven't experimented much with
this so don't know strengths/weaknesses. Also can't remember the rules for
how live the passed in data remains, but there is lots of info around on this.

All these comments about modules/closures should be removed. Just FYI.
*/