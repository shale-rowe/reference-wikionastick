
//TODO: all variables should stay inside this object
woas.browser = { ie: false, ie6: false, ie8: false,
					firefox: false, firefox2: false,
					firefox3: false, firefox_new: false,
					opera: false, safari: false,
					chrome: false
				};

if((navigator.userAgent).indexOf("Opera")!=-1)
	woas.browser.opera = true;
else if (navigator.userAgent.indexOf("Chrome") != -1)
	woas.browser.chrome = true;
else if(navigator.appName == "Netscape") {
	// check that it is Gecko first
	woas.browser.firefox = (new RegExp("Gecko\\/\\d+")).test(navigator.userAgent) ? true : false;
	// match also development versions of Firefox "Shiretoko" / "Namoroka"
	if (woas.browser.firefox) {
		// match the last word of userAgent
		var gecko_ver = navigator.userAgent.match(/rv:(\d+\.\d+)/);
		if (gecko_ver !== null) {
			gecko_ver = gecko_ver[1];
			switch (gecko_ver) {
				case "1.8":
					woas.browser.firefox2 = true;
				break;
				case "1.9":
					woas.browser.firefox3 = true;
				break;
				default:
					// possibly Firefox4
					woas.browser.firefox_new = true;
			}
		}
	} // not Gecko
} else if((navigator.appName).indexOf("Microsoft")!=-1) {
	woas.browser.ie = true;
	woas.browser.ie8 = (navigator.userAgent.search(/msie 8\./i)!=-1);
	if (!woas.browser.ie8)
		woas.browser.ie6 = (navigator.userAgent.search(/msie 6\./i)!=-1);
} else if (navigator.userAgent.indexOf("applewebkit") != -1) {
	woas.browser.safari = true;
}

// finds out if Opera is trying to look like Mozilla
if (woas.browser.firefox && (navigator.product != "Gecko"))
	woas.browser.firefox = woas.browser.firefox2 =
	woas.browser.firefox3 = woas.browser.firefox_new = false;

// finds out if Opera is trying to look like IE
if (woas.browser.ie && woas.browser.opera)
	woas.browser.ie = false;

var is_windows = (navigator.appVersion.toLowerCase().indexOf("windows")!=-1);

woas._server_mode = (document.location.toString().match(/^file:\/\//) ? false:true);

// set to true if we need Java-based file load/save
woas.use_java_io = woas.browser.chrome || woas.browser.opera || woas.browser.safari;

// returns the DOM element object given its id - enables a try/catch mode when debugging
if (woas.config.debug_mode) {
	// returns the DOM element object given its id, alerting if the element is not found (but that would never happen, right?)
	function $(id){ try{return document.getElementById(id);}catch(e){alert("ERROR: $('"+id+"') invalid reference");} }
} else {
	// much faster version
	function $(id){return document.getElementById(id);}
}

$.hide = function(id) {
	$(id).style.display = "none";
	$(id).style.visibility = "hidden";
}

$.show = function(id) {
	$(id).style.display = "inline";
	$(id).style.visibility = "visible";
}

$.hide_ni = function(id) {
	$(id).style.visibility = "hidden";
}

$.show_ni = function(id) {
	$(id).style.visibility = "visible";
}

$.is_visible = function(id) {
	return !!($(id).style.visibility == 'visible');
}

$.toggle = function(id) {
	if ($.is_visible(id))
		$.hide(id);
	else
		$.show(id);
}

$.clone = function(obj) {
	var nobj = {};
	for (var i in obj) {
		nobj[i] = obj[i];
	}
	return nobj;
}

// logging function has not to be in WoaS object
var log;
if (woas.config.debug_mode) {
	// logging function - used in development
	log = function (aMessage) {
	    var logbox = $("woas_log");
	    // count lines
		nls = logbox.value.match(/\n/g);
		// log maximum 1024 lines
		if (nls!=null && typeof(nls)=='object' && nls.length>1024)
			logbox.value = "";
		logbox.value += aMessage + "\n";
		if(window.opera)
			opera.postError(aMessage);
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
	return this.replace(/%[sd]/g, function(str) {
		// replace with the original unparsed token in case of undefined parameter
		if (i_pos > max_pos)
			return str;
/*		if (str == '%d')
			return Number(arguments[i_pos++]); */
		// return '%s' string
		return fmt_args[i_pos++];
	});
}

// get filename of currently open file in browser
function _get_this_filename() {
	var filename = unescape(document.location.toString().split("?")[0]);
	if (woas.browser.opera)
		filename = filename.replace(/^file:\/\/[^\/]+/, '');
	else {
		if (filename.indexOf("file://") === 0) // all browsers
			filename = filename.substr(7);
		if (filename.indexOf("///")===0) // firefox
			filename = filename.substr(1);
	}
	//TODO: check that 'g' can be removed
	filename = filename.replace(/#.*$/g, ""); // remove fragment (if any)
	if (is_windows) {
		// convert unix path to windows path
		filename = filename.replace(/\//g, "\\");
		if (filename.substr(0,2)!="\\\\") { // if this is not a network path - will be true in case of Firefox for example
			// remove leading slash before unit:
			if (filename.match(/^\\\w:\\/))
				filename = filename.substr(1);
			if (filename.charAt(1)!=':') {
				if (woas.browser.ie)
					filename = "\\\\"+filename;
			}
		}
	}
	return filename;
}
