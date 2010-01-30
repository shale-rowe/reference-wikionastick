
woas["debug"] = true;			// toggle debug mode (and console)

var _doctype = "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\" \"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">\n";

L10n={
	READONLY: "This Wiki on a Stick is read-only",
	INVALIDSPECIAL: "Invalid special page.",
	INVALIDDATA:"Invalid collected data!",
	SUREDELETE:"Are you sure you want to DELETE page",
	ALLDELETE: "Are you going to ERASE all your pages?",
	ALLLOST: "This is the last confirm needed in order to ERASE all your pages.\n\nALL YOUR PAGES WILL BE LOST\n\nAre you sure you want to continue?",
	DELETE:"Delete page:",
	DELETEIMAGE:"Delete embedded image",
	EXPORTIMAGE:"Export image",
	DELETEFILE: "Are you sure you want to delete this file?",
	INSERTNEWPAGE:"Insert new page title"
}

// DETERMINE BROWSER, OS AND SERVERMODE

// browser flags - not to be in WoaS object
var ie = false;
var ie6 = false;
var firefox = false;
// var ff3 = false;
var opera = false;

if((navigator.userAgent).indexOf("Opera")!=-1)
	opera = true;
else if(navigator.appName == "Netscape") {
	firefox = true;
//	if (navigator.userAgent.match("Firefox/3"))
//		ff3 = true;
} else if((navigator.appName).indexOf("Microsoft")!=-1) {
	ie = true;
	ie6 = (navigator.userAgent.search(/msie 6\./i)!=-1);
}

// finds out if Opera is trying to look like Mozilla
if (firefox && (navigator.product != "Gecko"))
	firefox = false;

// finds out if Opera is trying to look like IE
if (ie && opera)
	ie = false;
	
var is_windows = (navigator.appVersion.toLowerCase().indexOf("windows")!=-1);

woas["_server_mode"] = (document.location.toString().match(/^file:\/\//) ? false:true);

// BASIC ELEMENT FUNCTIONS using their id

/*
* All HTML elements are naturally displayed in one of the following ways:
* 
* Block
*	Takes up the full width available, with a new line before and after (display:block;)
* 
* Inline
*	Takes up only as much width as it needs, and does not force new lines (display:inline;)
* 
* Not displayed, see $["hide"](id)
 *	Not visible (display:none;)
 */

 // returns the DOM element object given its id, alerting if the element is not found (but that would never happen, right?)
// function $(id){ try{return document.getElementById(id);}catch(e){alert("element id '"+id+"' not found.");} }
// proposal to: return document.all ? document.all[id] : document.getElementById(id);
function $(id){ return document.getElementById(id);} // This version is much faster than the one with try/catch

// Hide an element. use like this:
// 1)  $.hide('id-string');
// 2)  $['hide']('id-string');
$["hide"] = function(id) {
	$(id).style.display = "none";
	$(id).style.visibility = "hidden";
}

// Show the element, the parameter asBlock must be trueish to be 'block'. Default is 'inline'.
 $["show"] = function(id, asBlock) {
	$(id).style.display = asBlock? "block" : "inline";
	$(id).style.visibility = "visible";
}

// Toggle the element
$["toggle"] = function (id, asBlock) {
	$[ $.hidden(id)? 'show':'hide'](id, asBlock); 
}

// is the element hidden?
$["hidden"] = function (id) {
	return ($(id).style.display=='none');
}

// This will keep the element used space in the layout, but make it visible/invisible
$["visibility"] = function (id,set) {
	if(set!==undefined)
		$(id).style.visibility=set?'visible':'hidden';
	else
		return ($(id).style.visibility=='visible');
}

// logging function has not to be in WoaS object
var log = function(aMessage) { };
if (woas.debug) {
	// logging function - used in development
	log = function (aMessage)
	{
	    var logbox = $("swlogger");
		nls = logbox.value.match(/\n/g);
		if (nls!=null && typeof(nls)=='object' && nls.length>11)
			logbox.value = "";
		logbox.value += aMessage + "\n";
	};
}

// fixes the Array prototype for older browsers
if (typeof Array.prototype.push == "undefined") {
  Array.prototype.push = function(str) {
    this[this.length] = str;
  }
}

// the following methods complete the Array object for non-compliant browsers
if (typeof Array.prototype.splice == "undefined") {
  Array.prototype.splice = function(offset, length) {
    var temp = [];
    for (var i = this.length - 1; i >= 0; i--) {
      if (i < offset || i > (offset + length - 1)) {
        temp[temp.length] = this[i];
      }
      this.length--;
    }
    for (i = temp.length - 1; i >= 0; i--) {
      this[this.length] = temp[i];
    }
  }
}

if (typeof Array.prototype.indexOf == "undefined") {
	Array.prototype.indexOf = function(val, fromIndex) {
		if (typeof(fromIndex) != 'number') fromIndex = 0;
		for (var index = fromIndex,len = this.length; index < len; index++)
			if (this[index] == val) return index;
		return -1;
	}
}

// implements a custom function which returns an array with unique elements - deprecated
Array.prototype.toUnique = function() {
	var a_o = {}, new_arr = [];
	var l=this.length;
	for(var i=0; i<l;i++) {
		if (a_o[this[i]]==null) {
			a_o[this[i]] = true;
			new_arr.push(this[i]);
		}
	}
	if (new_arr.length!=l)
		return new_arr;
	return this;
}

// provide regex escaping
// thanks to S.Willison // Note Nilton: ^ could be missing? => nevermind, I'm using it!
RegExp.escape = function(text) {
  if (!arguments.callee.sRE) {
    var specials = [
      '/', '.', '*', '+', '?', '|', '$',
      '(', ')', '[', ']', '{', '}', '\\'
    ];
    arguments.callee.sRE = new RegExp(
      '(\\' + specials.join('|\\') + ')', 'g'
    );
  }
  return text.replace(arguments.callee.sRE, '\\$1');
}

// repeat string s for n times (replaces str_rep from http://www.webreference.com/javascript/reference/core_ref/function.html)
if (typeof String.prototype.repeat == "undefined") {
	String.prototype.repeat = function( num ){
		if(num<=0)return "";
		return new Array( num + 1 ).join( this );
	}
}

// return a random integer given the maximum value (scale)
function _rand(scale) {
	return Math.floor(Math.random() * scale);
}

// returns a random string of given string_length
function _random_string(string_length) {
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
	var randomstring = '';
	for (var i=0; i<string_length; i++) {
		var rnum = _rand(chars.length);
		randomstring += chars.charAt(rnum);
	}
	return randomstring;
}

// converts the number of bytes to a human readable form
function _convert_bytes(bytes){
	var U=['bytes','Kb','Mb','Gb','Pb'];
	var n = 0;
	bytes=Math.ceil(bytes);
	while(bytes>=1024){
		++n;
		bytes/=1024;
	}
	return bytes.toFixed(2).replace(/\.00$/, "") +' '+ U[n];
}


// Sort Case insensitive (put inside the sort:  .sort($["i_sort"])
$["i_sort"] =  function(x,y){var a=String(x).toUpperCase();var b = String(y).toUpperCase();if (a>b)return 1;if (a<b)return -1;return 0;}

// read or set the vertical scrollbar. Should work for IE6 in quircks and nonquircks mode.  sigh!
function scrollTop(v) {
	var x=0;
	function f_filterResults(w, d, b) {
		var r = w || 0;
		if (d && (!r || (r > d))){
			r = d;
			x=1;
		}
		if(b && (!r || (r > b))){
			x=2;
			return b;
		}
		return r;
	}
	var F = f_filterResults(
		window.pageYOffset ? window.pageYOffset : 0,
		document.documentElement ? document.documentElement.scrollTop : 0,
		document.body ? document.body.scrollTop : 0
	);
	if(v===undefined)
		return F;
	if(firefox) return window.scrollBy(0,v);
	switch(x){
		case(0): return window.pageYOffset+=v; break;
		case(1): return document.documentElement.scrollTop+=v; break;
		case(2): return document.body.scrollTop+=v; break;
	}
}
