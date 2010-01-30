
woas["debug"] = true;			// toggle debug mode (and console)

var _doctype = "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\" \"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">\n";

// browser flags - not to be in WoaS object
var ie = false;
var ie6 = false;
var firefox = false;
//var ff3 = false;
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

// returns the DOM element object given its id
function $(id){return document.getElementById(id);}

$["hide"] = function(id) {
	$(id).style.display = "none";
	$(id).style.visibility = "hidden";
}

$["show"] = function(id) {
	$(id).style.display = "inline";
	$(id).style.visibility = "visible";
}

// logging function has not to be in WoaS object
var log;
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
} else {
	log = function(aMessage) { };
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
// thanks to S.Willison
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

// repeat string s for n times
function str_rep(s, n) {
	var r = "";
	while (--n >= 0) r += s;
	return r;
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

// format a decimal number to specified decimal precision
function _number_format(n, prec) {
	return n.toString().replace(new RegExp("(\\."+str_rep("\\d", prec)+")\\d*$"), "$1");
}

// converts the number of bytes to a human readable form
function _convert_bytes(bytes) {
//	log("Converting "+bytes+" bytes");	// log:0
	if (bytes < 1024)
		return Math.ceil(bytes)+ " bytes";
	var k = bytes / 1024, n;
	if (k >= 1024) {
		var m = k / 1024;
		if (m >= 1024)
			n = _number_format(m/1024,2)+' GB';
		else
			n = _number_format(m,2)+' MB';
	} else
		n = _number_format(k,2)+' KB';
	return n.replace(/\.00/, "");
}
