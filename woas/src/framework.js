
woas["debug"] = true;			// toggle debug mode (and console)

// browser flags - not to be in WoaS object
var ie = false;
var ie6 = false;
var firefox = false, firefox2 = false;
//var ff3 = false;
var opera = false;

if((navigator.userAgent).indexOf("Opera")!=-1)
	opera = true;
else if(navigator.appName == "Netscape") {
	firefox = true;
	if (navigator.userAgent.match("Firefox/2"))
		firefox2 = true;
} else if((navigator.appName).indexOf("Microsoft")!=-1) {
	ie = true;
	ie8 = (navigator.userAgent.search(/msie 8\./i)!=-1);
	if (!ie8)
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

// returns the DOM element object given its id - enables a try/catch mode when debugging
if (woas.debug) {
	// returns the DOM element object given its id, alerting if the element is not found (but that would never happen, right?)
	function $(id){ try{return document.getElementById(id);}catch(e){alert("ERROR: $('"+id+"') invalid reference");} }
} else {
	// much faster version
	function $(id){return document.getElementById(id);}
}

$["hide"] = function(id) {
	$(id).style.display = "none";
	$(id).style.visibility = "hidden";
}

$["show"] = function(id) {
	$(id).style.display = "inline";
	$(id).style.visibility = "visible";
}

$["is_visible"] = function(id) {
	return !!($(id).style.visibility == 'visible');
}

$["toggle"] = function(id) {
	if ($.is_visible(id))
		$.hide(id);
	else
		$.show(id);
}

// logging function has not to be in WoaS object
var log;
if (woas.debug) {
	// logging function - used in development
	log = function (aMessage)
	{
	    var logbox = $("swlogger");
	    // count lines
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
    return this;
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
    var specials = ['/', '.', '*', '+', '?', '|', '$', '(', ')', '[', ']', '{', '}', '\\' ];
    arguments.callee.sRE = new RegExp(
      '(\\' + specials.join('|\\') + ')', 'g'
    );
  }
  return text.replace(arguments.callee.sRE, '\\$1');
}

// repeat string s for n times
 if (typeof String.prototype.repeat == "undefined") {
	String.prototype.repeat = function(n) {
		var r = "";
		while (--n >= 0) r += this;
		return r;
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
function _convert_bytes(bytes) {
	var U=['bytes','Kb','Mb','Gb','Pb'];
	var n=0;
	bytes=Math.ceil(bytes);
	while(bytes>=1024) {
		 ++n;
		 bytes /= 1024;
	}
	return bytes.toFixed(2).replace(/\.00$/, "") +' '+ U[n];
}

// implement an sprintf() bare function
String.prototype.sprintf = function() {
	// check that arguments are OK
	if (typeof arguments == "undefined") { return null; }
	// next argument to pick
	var i_pos = 0, max_pos = arguments.length - 1;
	var fmt_args = arguments;
	return this.replace(/(%[sd])/g, function(str, $1) {
		// replace with a strange thing in case of undefined parameter
		if (i_pos > max_pos)
			return "(?)";
/*		if ($1 == '%d')
			return Number(arguments[i_pos++]); */
		// return '%s' string
		return fmt_args[i_pos++];
	});
}

// create a centered popup given some options
woas["popup"] = function (name,fw,fh,extra,head,body) {
	var hpos=Math.ceil((screen.width-fw)/2);
	var vpos=Math.ceil((screen.height-fh)/2);
	var wnd = window.open("about:blank",name,"width="+fw+",height="+fh+		
	",left="+hpos+",top="+vpos+extra);
	wnd.focus();
	wnd.document.writeln(this.DOCTYPE+"<ht"+"ml><he"+"ad>"+head+"</h"+"ead><"+"body>"+
						body+"</bod"+"y></h"+"tml>\n");
	wnd.document.close();
	return wnd;
}
