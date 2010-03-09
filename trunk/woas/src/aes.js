// AES encryption for StickWiki
// adapted by legolas558
// license: GNU/GPL
// original code from http://home.versatel.nl/MAvanEverdingen/Code/
// this is a javascript conversion of a C implementation by Mike Scott

woas["AES"] = {
	"bData":null,
	"sData":null,
	"aes_i":null,
	"aes_j":null,
	"tot":null,
	"key": [],
	"wMax": 0xFFFFFFFF,
	"aesNk":null,
	"aesNr":null,
	"aesPows":null,
	"aesLogs":null,
	"aesSBox":null,
	"aesSBoxInv":null,
	"aesRco":null,
	"aesFtable":null,
	"aesRtable":null,
	"aesFi":null,
	"aesRi":null,
	"aesFkey":null,
	"aesRkey":null
};

woas.AES["rotb"] = function(b,n){ return ( b<<n | b>>>( 8-n) ) & 0xFF; }
woas.AES["rotw"] = function(w,n){ return ( w<<n | w>>>(32-n) ) & woas.AES.wMax; }
woas.AES["getW"] = function(a,i){ return a[i]|a[i+1]<<8|a[i+2]<<16|a[i+3]<<24; }
woas.AES["setW"] = function(a,i,w){ a.splice(i,4,w&0xFF,(w>>>8)&0xFF,(w>>>16)&0xFF,(w>>>24)&0xFF); }
woas.AES["setWInv"] = function(a,i,w){ a.splice(i,4,(w>>>24)&0xFF,(w>>>16)&0xFF,(w>>>8)&0xFF,w&0xFF); }
woas.AES["getB"] = function(x,n){ return (x>>>(n*8))&0xFF; }

/*	var utf8sets = [0x800,0x10000,0x110000];

	function unExpChar(c){
	  return "unexpected character '"+String.fromCharCode(c)+"' (code 0x"+c.toString(16)+").";
	}
*/

woas["utf8Encrypt_s"] = function(sData) {
	return unescape( encodeURIComponent( sData ) );
}

woas["utf8Encrypt"] = function(sData){
		return this.split_bytes(this.utf8Encrypt_s(sData));
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

woas["utf8Decrypt_s"] = function(sData) {
		try {
			return decodeURIComponent( escape( sData ) );
		}
		catch (e) {
			log(e);	//log:1
		}
		return null;
	}

woas["utf8Decrypt"] = function(bData){
	return this.utf8Decrypt_s(this.merge_bytes(bData));
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

woas["split_bytes"] = function(s) {
	var l=s.length;
	var arr=[];
	for(var i=0;i<l;i++)
		arr.push(s.charCodeAt(i));
	return arr;
}
	
woas["merge_bytes"] = function(arr) {
	var l=arr.length;
	var s="";
	for(var i=0;i<l;i++)
		s+=String.fromCharCode(arr[i]);
	return s;
}

woas.AES["aesMult"] = function(x, y){ return (x&&y) ? woas.AES.aesPows[(woas.AES.aesLogs[x]+woas.AES.aesLogs[y])%255]:0; }

woas.AES["aesPackBlock"] = function() {
	return [ woas.AES.getW(woas.AES.bData,woas.AES.aes_i), woas.AES.getW(woas.AES.bData,woas.AES.aes_i+4),
			woas.AES.getW(woas.AES.bData,woas.AES.aes_i+8), woas.AES.getW(woas.AES.bData,woas.AES.aes_i+12) ];
}

woas.AES["aesUnpackBlock"] = function(packed){
  for ( var mj=0; mj<4; mj++,woas.AES.aes_i+=4) woas.AES.setW( woas.AES.bData, woas.AES.aes_i, packed[mj] );
}

woas.AES["aesXTime"] = function(p){
  p <<= 1;
  return p&0x100 ? p^0x11B : p;
}

woas.AES["aesSubByte"] = function(w){
  return woas.AES.aesSBox[woas.AES.getB(w,0)] | woas.AES.aesSBox[woas.AES.getB(w,1)]<<8 | woas.AES.aesSBox[woas.AES.getB(w,2)]<<16 | woas.AES.aesSBox[woas.AES.getB(w,3)]<<24;
}

woas.AES["aesProduct"] = function(w1,w2){
  return woas.AES.aesMult(woas.AES.getB(w1,0),woas.AES.getB(w2,0)) ^ woas.AES.aesMult(woas.AES.getB(w1,1),woas.AES.getB(w2,1))
       ^ woas.AES.aesMult(woas.AES.getB(w1,2),woas.AES.getB(w2,2)) ^ woas.AES.aesMult(woas.AES.getB(w1,3),woas.AES.getB(w2,3));
}

woas.AES["aesInvMixCol"] = function(x){
  return woas.AES.aesProduct(0x090d0b0e,x)     | woas.AES.aesProduct(0x0d0b0e09,x)<<8 |
         woas.AES.aesProduct(0x0b0e090d,x)<<16 | woas.AES.aesProduct(0x0e090d0b,x)<<24;
}

woas.AES["aesByteSub"] = function(x){
  var y=woas.AES.aesPows[255-woas.AES.aesLogs[x]];
  x=y;  x=woas.AES.rotb(x,1);
  y^=x; x=woas.AES.rotb(x,1);
  y^=x; x=woas.AES.rotb(x,1);
  y^=x; x=woas.AES.rotb(x,1);
  return x^y^0x63;
}

woas.AES["aesGenTables"] = function(){
  var i,y;
  woas.AES.aesPows = [ 1,3 ];
  woas.AES.aesLogs = [ 0,0,null,1 ];
  woas.AES.aesSBox = new Array(256);
  woas.AES.aesSBoxInv = new Array(256);
  woas.AES.aesFtable = new Array(256);
  woas.AES.aesRtable = new Array(256);
  woas.AES.aesRco = new Array(30);

  for ( i=2; i<256; i++){
    woas.AES.aesPows[i]=woas.AES.aesPows[i-1]^woas.AES.aesXTime( woas.AES.aesPows[i-1] );
    woas.AES.aesLogs[woas.AES.aesPows[i]]=i;
  }

  woas.AES.aesSBox[0]=0x63;
  woas.AES.aesSBoxInv[0x63]=0;
  for ( i=1; i<256; i++){
    y=woas.AES.aesByteSub(i);
    woas.AES.aesSBox[i]=y; woas.AES.aesSBoxInv[y]=i;
  }

  for (i=0,y=1; i<30; i++){ woas.AES.aesRco[i]=y; y=woas.AES.aesXTime(y); }

  for ( i=0; i<256; i++){
    y = woas.AES.aesSBox[i];
    woas.AES.aesFtable[i] = woas.AES.aesXTime(y) | y<<8 | y<<16 | (y^woas.AES.aesXTime(y))<<24;
    y = woas.AES.aesSBoxInv[i];
    woas.AES.aesRtable[i]= woas.AES.aesMult(14,y) | woas.AES.aesMult(9,y)<<8 |
                  woas.AES.aesMult(13,y)<<16 | woas.AES.aesMult(11,y)<<24;
  }
}

woas.AES["aesInit"] = function(){
  woas.AES.key=woas.AES.key.slice(0,43);
  var i,k,m;
  var j = 0;
  var l = woas.AES.key.length;

  while ( l!=16 && l!=24 && l!=32 && l!=43) woas.AES.key[l++]=woas.AES.key[j++];
  woas.AES.aesGenTables();

  woas.AES.aesNk = woas.AES.key.length >>> 2;
  woas.AES.aesNr = 6 + woas.AES.aesNk;

  var N=4*(woas.AES.aesNr+1);
  
  woas.AES.aesFi = new Array(12);
  woas.AES.aesRi = new Array(12);
  woas.AES.aesFkey = new Array(N);
  woas.AES.aesRkey = new Array(N);

  for (m=j=0;j<4;j++,m+=3){
    woas.AES.aesFi[m]=(j+1)%4;
    woas.AES.aesFi[m+1]=(j+2)%4;
    woas.AES.aesFi[m+2]=(j+3)%4;
    woas.AES.aesRi[m]=(4+j-1)%4;
    woas.AES.aesRi[m+1]=(4+j-2)%4;
    woas.AES.aesRi[m+2]=(4+j-3)%4;
  }

  for (i=j=0;i<woas.AES.aesNk;i++,j+=4) woas.AES.aesFkey[i]=woas.AES.getW(woas.AES.key,j);

  for (k=0,j=woas.AES.aesNk;j<N;j+=woas.AES.aesNk,k++){
    woas.AES.aesFkey[j]=woas.AES.aesFkey[j-woas.AES.aesNk]^woas.AES.aesSubByte(woas.AES.rotw(woas.AES.aesFkey[j-1], 24))^woas.AES.aesRco[k];
    if (woas.AES.aesNk<=6)
      for (i=1;i<woas.AES.aesNk && (i+j)<N;i++) woas.AES.aesFkey[i+j]=woas.AES.aesFkey[i+j-woas.AES.aesNk]^woas.AES.aesFkey[i+j-1];
    else{
      for (i=1;i<4 &&(i+j)<N;i++) woas.AES.aesFkey[i+j]=woas.AES.aesFkey[i+j-woas.AES.aesNk]^woas.AES.aesFkey[i+j-1];
      if ((j+4)<N) woas.AES.aesFkey[j+4]=woas.AES.aesFkey[j+4-woas.AES.aesNk]^woas.AES.aesSubByte(woas.AES.aesFkey[j+3]);
      for (i=5;i<woas.AES.aesNk && (i+j)<N;i++) woas.AES.aesFkey[i+j]=woas.AES.aesFkey[i+j-woas.AES.aesNk]^woas.AES.aesFkey[i+j-1];
    }
  }

  for (j=0;j<4;j++) woas.AES.aesRkey[j+N-4]=woas.AES.aesFkey[j];
  for (i=4;i<N-4;i+=4){
    k=N-4-i;
    for (j=0;j<4;j++) woas.AES.aesRkey[k+j]=woas.AES.aesInvMixCol(woas.AES.aesFkey[i+j]);
  }
  for (j=N-4;j<N;j++) woas.AES.aesRkey[j-N+4]=woas.AES.aesFkey[j];
}

woas.AES["aesClose"] = function(){
  woas.AES.aesPows=woas.AES.aesLogs=woas.AES.aesSBox=woas.AES.aesSBoxInv=woas.AES.aesRco=null;
  woas.AES.aesFtable=woas.AES.aesRtable=woas.AES.aesFi=woas.AES.aesRi=woas.AES.aesFkey=woas.AES.aesRkey=null;
}

woas.AES["aesRounds"] = function( block, key, table, inc, box ){
  var tmp = new Array( 4 );
  var i,j,m,r;

  for ( r=0; r<4; r++ ) block[r]^=key[r];
  for ( i=1; i<woas.AES.aesNr; i++ ){
    for (j=m=0;j<4;j++,m+=3){
      tmp[j]=key[r++]^table[block[j]&0xFF]^
			woas.AES.rotw(table[(block[inc[m  ]]>>> 8)&0xFF], 8)^
			woas.AES.rotw(table[(block[inc[m+1]]>>>16)&0xFF],16)^
			woas.AES.rotw(table[(block[inc[m+2]]>>>24)&0xFF],24);
    }
    var t=block; block=tmp; tmp=t;
  }

  for (j=m=0;j<4;j++,m+=3)
    tmp[j]=key[r++]^box[block[j]&0xFF]^
           woas.AES.rotw(box[(block[inc[m  ]]>>> 8)&0xFF], 8)^
           woas.AES.rotw(box[(block[inc[m+1]]>>>16)&0xFF],16)^
           woas.AES.rotw(box[(block[inc[m+2]]>>>24)&0xFF],24);
  return tmp;
}

woas.AES["_encrypt"] = function(){
  woas.AES.aesUnpackBlock( woas.AES.aesRounds(woas.AES.aesPackBlock(), woas.AES.aesFkey, woas.AES.aesFtable, woas.AES.aesFi, woas.AES.aesSBox ) );
}

woas.AES["_decrypt"] = function(){
  woas.AES.aesUnpackBlock( woas.AES.aesRounds(woas.AES.aesPackBlock(), woas.AES.aesRkey, woas.AES.aesRtable, woas.AES.aesRi, woas.AES.aesSBoxInv ) );
}

// Blockcipher

woas.AES["blcEncrypt"] = function(enc){
  if (woas.AES.tot==0){
//    prgr = name;
    if (woas.AES.key.length<1) return;
    // if (cbc)
	for (woas.AES.aes_i=0; woas.AES.aes_i<16; ++woas.AES.aes_i) woas.AES.bData.unshift( _rand(256) );
    while( woas.AES.bData.length%16!=0 ) woas.AES.bData.push(0);
    woas.AES.tot = woas.AES.bData.length;
    woas.AES.aesInit();
  }else{
    // if (cbc)
	for (woas.AES.aes_j=woas.AES.aes_i; woas.AES.aes_j<woas.AES.aes_i+16; woas.AES.aes_j++) woas.AES.bData[woas.AES.aes_j] ^= woas.AES.bData[woas.AES.aes_j-16];
    enc();
  }
  if (woas.AES.aes_i>=woas.AES.tot) woas.AES.aesClose();
}

woas.AES["blcDecrypt"] = function(dec){
	// initialize length
  if (woas.AES.tot==0){
//    prgr = name;
    if (woas.AES.key.length<1) return false;
    // if (cbc)
	{ woas.AES.aes_i=16; }
    woas.AES.tot = woas.AES.bData.length;
    if ( (woas.AES.tot%16) || (woas.AES.tot<woas.AES.aes_i) ) {
		log('AES: Incorrect length (tot='+woas.AES.tot+', aes_i='+woas.AES.aes_i+')'); //log:1
		return false;
	}
    woas.AES.aesInit();
  }else{
    // if (cbc)
	woas.AES.aes_i=woas.AES.tot-woas.AES.aes_i;
    dec();
    // if (cbc)
	{
      for (woas.AES.aes_j=woas.AES.aes_i-16; woas.AES.aes_j<woas.AES.aes_i; woas.AES.aes_j++) woas.AES.bData[woas.AES.aes_j] ^= woas.AES.bData[woas.AES.aes_j-16];
      woas.AES.aes_i = woas.AES.tot+32-woas.AES.aes_i;
    }
  }
  if (woas.AES.aes_i>=woas.AES.tot){
    woas.AES.aesClose();
    // if (cbc)
	woas.AES.bData.splice(0,16);
	// remove 0s added for padding (supposedly!)
	while(woas.AES.bData[woas.AES.bData.length-1]==0) woas.AES.bData.pop();
  }
  return true;
}

// sets global key to the utf-8 encoded key (byte array)
woas.AES["setKey"] = function(sKey) {
	woas.AES.key = woas.utf8Encrypt(sKey);
}

woas.AES["clearKey"] = function() {
	woas.AES.key = [];
}

// returns an array of encrypted characters
woas.AES["encrypt"] = function(raw_data) {
	woas.AES.bData = woas.utf8Encrypt(raw_data);
	
	woas.AES.aes_i=woas.AES.tot=0;
	do{ woas.AES.blcEncrypt(woas.AES._encrypt); } while (woas.AES.aes_i<woas.AES.tot);
	
	var rv = woas.AES.bData;
	woas.AES.bData = null;
	return rv;
}

// decrypts an array of encrypted characters
woas.AES["decrypt"] = function(raw_data) {
	woas.AES.bData = raw_data;
	
	woas.AES.aes_i=woas.AES.tot=0;
	do {
		if (!woas.AES.blcDecrypt(woas.AES._decrypt))
			return null;
	} while (woas.AES.aes_i<woas.AES.tot);
	
	woas.AES.sData = woas.utf8Decrypt(woas.AES.bData);
	woas.AES.bData = [];
	var rv = woas.AES.sData;
	woas.AES.sData = null;
	return rv;
}
