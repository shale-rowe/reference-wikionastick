
woas.browser = {
	// browsers - when different from 'false' it contains the version string
	ie: false, 
	firefox: false,
	opera: false,
	safari: false,
	chrome: false,
	
	// breeds - used internally, should not be used by external plugins
	ie6: false, ie8: false,
	firefox2: false,
	firefox3: false, firefox_new: false,
					
	// engines - set to true when present
	// gecko and webkit will contain the engine version
	gecko: false, webkit: false, presto: false, trident: false
};

// used to match browser version
var m;

if((navigator.userAgent).indexOf("Opera")!=-1) {
	m = navigator.userAgent.match(/Opera\/(\S*)/);
//	if (m && m[1])
		woas.browser.opera = m[1];
} else if (navigator.userAgent.indexOf("Chrome") != -1) {
	// detect version
	m = navigator.userAgent.match(/Chrome\/([^\s]+)/);
//	if (m && m[1])
		woas.browser.chrome = m[1];
} else if (navigator.userAgent.toLowerCase().indexOf("applewebkit") != -1) {
	// Safari never publicizes its version
	woas.browser.safari = true;
} else if(navigator.appName == "Netscape") {
	// check that it is Gecko first
	woas.browser.firefox = woas.browser.gecko = (new RegExp("Gecko\\/\\d")).test(navigator.userAgent) ? true : false;
	// match also development versions of Firefox "Shiretoko" / "Namoroka"
	if (woas.browser.gecko) {
		// match the last word of userAgent
		m = navigator.userAgent.match(/rv:([^\s\)]*)/);
//		if (m && m[1]) {
			woas.browser.gecko = m[1];
			switch (woas.browser.gecko.substr(3)) {
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
	} // not Gecko
} else if((navigator.appName).indexOf("Microsoft")!=-1) {
	woas.browser.ie8 = document.documentMode ? true : false;
	if (!woas.browser.ie8)
		woas.browser.ie6 = window.XMLHttpRequest ? false : true;
	// detect version
	m = navigator.userAgent.match(/MSIE\s([^;]*)/);
//	if (m && m[1])
		woas.browser.ie = m[1];
}

// finds out if Opera is trying to look like Mozilla
if (woas.browser.firefox && (navigator.product != "Gecko")) {
	woas.browser.firefox = woas.browser.firefox2
	= woas.browser.firefox3 = woas.browser.firefox_new = false;
	if (typeof window.opera != "undefined")
		woas.browser.opera = true;
}

// finds out if Opera is trying to look like IE
if (woas.browser.ie && (typeof window.opera != "undefined")) {
	woas.browser.ie = woas.browser.ie6 = woas.browser.ie8 = false;
	woas.browser.opera = true;
}

// detect engine type
if (woas.browser.ie)
	woas.browser.trident = true;
else if (woas.browser.chrome || woas.browser.safari) {
	m = navigator.userAgent.match(/AppleWebKit\/(\S*)/);
//    if (m && m[1])
		woas.browser.webkit = m[1];
} else if (woas.browser.opera)
	woas.browser.presto = true;

var is_windows = (navigator.appVersion.toLowerCase().indexOf("windows")!=-1);

woas._server_mode = (document.location.toString().match(/^file:\/\//) ? false:true);

// set to true if we need Java-based file load/save
woas.use_java_io = woas.browser.chrome || woas.browser.opera || woas.browser.safari;

// returns the DOM element object given its id - enables a try/catch mode when debugging
if (woas.config.debug_mode) {
	// returns the DOM element object given its id, alerting if the element is not found (but that would never happen, right?)
	function d$(id){ try{return document.getElementById(id);}catch(e){alert("ERROR: d$('"+id+"') invalid reference");} }
} else {
	// much faster version
	function d$(id){return document.getElementById(id);}
}

d$.checked = function(id) {
	cfg_changed = true;
	if (d$(id).checked)
		return true;
	return false;
};

d$.hide = function(id) {
	d$(id).style.display = "none";
	d$(id).style.visibility = "hidden";
};

d$.show = function(id) {
	d$(id).style.display = "inline";
	d$(id).style.visibility = "visible";
};

d$.hide_ni = function(id) {
	d$(id).style.visibility = "hidden";
};

d$.show_ni = function(id) {
	d$(id).style.visibility = "visible";
};

d$.is_visible = function(id) {
	return !!(d$(id).style.visibility == 'visible');
};

d$.toggle = function(id) {
	if (d$.is_visible(id))
		d$.hide(id);
	else
		d$.show(id);
};

d$.clone = function(obj) {
	var nobj = {};
	for (var i in obj) {
		nobj[i] = obj[i];
	}
	return nobj;
};

// logging function has not to be in WoaS object
if (woas.config.debug_mode) {
	// logging function - used in development
	woas.log = function (aMessage) {
	    var logbox = d$("woas_debug_log");
	    // count lines
	    if (!woas.tweak.integrity_test) {
			nls = logbox.value.match(/\n/g);
			// log maximum 1024 lines
			if (nls!=null && typeof(nls)==='object' && nls.length>1024)
				logbox.value = "";
		}
		logbox.value += aMessage + "\n";
		// keep the log scrolled down
		logbox.scrollTop = logbox.scrollHeight;
		if(window.opera)
			opera.postError(aMessage);
	};
} else {
	woas.log = function(aMessage) { };
}

//DEPRECATED but still supported
var log = woas.log;

// fixes the Array prototype for older browsers
if (typeof Array.prototype.push == "undefined") {
  Array.prototype.push = function(str) {
    this[this.length] = str;
  };
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
  };
}

if (typeof Array.prototype.indexOf == "undefined") {
	Array.prototype.indexOf = function(val, fromIndex) {
		if (typeof(fromIndex) != 'number') fromIndex = 0;
		for (var index = fromIndex,len = this.length; index < len; index++)
			if (this[index] == val) return index;
		return -1;
	};
}

// implements a custom function which returns an array with unique elements - deprecated
Array.prototype.toUnique = function() {
	var a_o = {}, new_arr = [];
	var l=this.length;
	for(var i=0; i<l;i++) {
		if (a_o[this[i]]===undefined) {
			a_o[this[i]] = true;
			new_arr.push(this[i]);
		}
	}
	if (new_arr.length!=l)
		return new_arr;
	return this;
};

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
};

// repeat string s for n times
 if (typeof String.prototype.repeat == "undefined") {
	String.prototype.repeat = function(n) {
		var r = "";
		while (--n >= 0) r += this;
		return r;
	};
}

// return a random integer given the maximum value (scale)
function _rand(scale) {
	return Math.floor(Math.random() * scale);
}

// returns a random string of given string_length
function _random_string(string_length) {
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
	var randomstring = '';
	for (var i=0; i < string_length; i++) {
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
};

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

function ff_fix_focus() {
	//runtime fix for Firefox bug 374786
	if (woas.browser.firefox)
		d$("woas_wiki_area").blur();
}

if (is_windows) {
	var reFwdSlash = new RegExp("/", "g");
	woas.fix_path_separators = function(path) {
		return path.replace(reFwdSlash, woas.DIRECTORY_SEPARATOR);
	};
} else { // UNIX or similar, no path change
	woas.fix_path_separators = function(path) {
		return path;
	};
}

woas.strcmp = function ( str1, str2 ) {
    // http://kevin.vanzonneveld.net
    // +   original by: Waldo Malqui Silva
    // +      input by: Steve Hilder
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +    revised by: gorthaur

    return ( ( str1 == str2 ) ? 0 : ( ( str1 > str2 ) ? 1 : -1 ) );
}

woas.__strnatcmp_split = function ( f_string ) {
        var result = [];
        var buffer = '';
        var chr = '';
        var i = 0, f_stringl = 0;

        var text = true;

        f_stringl = f_string.length;
        for (i = 0; i < f_stringl; i++) {
            chr = f_string.substring(i, i + 1);
            if (chr.match(/\d/)) {
                if (text) {
                    if (buffer.length > 0){
                        result[result.length] = buffer;
                        buffer = '';
                    }

                    text = false;
                }
                buffer += chr;
            } else if ((text == false) && (chr == '.') && (i < (f_string.length - 1)) && (f_string.substring(i + 1, i + 2).match(/\d/))) {
                result[result.length] = buffer;
                buffer = '';
            } else {
                if (text == false) {
                    if (buffer.length > 0) {
                        result[result.length] = parseInt(buffer, 10);
                        buffer = '';
                    }
                    text = true;
                }
                buffer += chr;
            }
        }

        if (buffer.length > 0) {
            if (text) {
                result[result.length] = buffer;
            } else {
                result[result.length] = parseInt(buffer, 10);
            }
        }

        return result;
};

woas.strnatcmp = function( f_string1, f_string2 ) {
    // http://kevin.vanzonneveld.net
    // +   original by: Martijn Wieringa
    // + namespaced by: Michael White (http://getsprink.com)
    // +    tweaked by: Jack
    // +   bugfixed by: Onno Marsman

    var i = 0;

    var array1 = this.__strnatcmp_split(f_string1+'');
    var array2 = this.__strnatcmp_split(f_string2+'');

    var len = array1.length;
    var text = true;

    var result = -1;
    var r = 0;

    if (len > array2.length) {
        len = array2.length;
        result = 1;
    }

    for (i = 0; i < len; i++) {
        if (isNaN(array1[i])) {
            if (isNaN(array2[i])) {
                text = true;

                if ((r = this.strcmp(array1[i], array2[i])) != 0) {
                    return r;
                }
            } else if (text){
                return 1;
            } else {
                return -1;
            }
        } else if (isNaN(array2[i])) {
            if (text) {
                return -1;
            } else{
                return 1;
            }
        } else {
            if (text){
                if ((r = (array1[i] - array2[i])) != 0) {
                    return r;
                }
            } else {
                if ((r = this.strcmp(array1[i].toString(), array2[i].toString())) != 0) {
                    return r;
                }
            }

            text = false;
        }
    }

    return result;
}

woas.base64 = {
	_b64arr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
	reValid: /^[A-Za-z0-9+\/=]+$/,
	
	_core_encode: function(c1, c2, c3) {
		var enc1, enc2, enc3, enc4;
		
		enc1 = c1 >> 2;
		enc2 = ((c1 & 3) << 4) | (c2 >> 4);
		enc3 = ((c2 & 15) << 2) | (c3 >> 6);
		enc4 = c3 & 63;

		if (isNaN(c2))	enc3 = enc4 = 64;
		else if (isNaN(c3))
			enc4 = 64;

		return this._b64arr.charAt(enc1) + this._b64arr.charAt(enc2) +
				this._b64arr.charAt(enc3) +	this._b64arr.charAt(enc4);
	},

	encode_array: function(input_arr) {
		var c1, c2, c3, i = 0, z = input_arr.length,output = "";
		
		do {
			c1 = input_arr[i++];
			if (i == z)
				c3 = c2 = null;
			else {
				c2 = input_arr[i++];
				if (i == z)
					c3 = null;
				else
					c3 = input_arr[i++];
			}
			output += this._core_encode(c1, c2, c3);
		} while (i < z);
		return output;
	},

	encode: function(input) {
		var c1, c2, c3, i = 0, z = input.length, output = "";
		
		do {
			c1 = input.charCodeAt(i++);
			c2 = input.charCodeAt(i++);
			c3 = input.charCodeAt(i++);
			
			output += this._core_encode(c1, c2, c3);
		} while (i < z);
		return output;
	},

	decode: function(input, z) {
		var c1, c2, c3, enc1, enc2, enc3, enc4, i = 0,
			output = "";
		
		var l=input.length;
		if (typeof z=='undefined') z = l;
		else if (z>l) z=l;

		do {
			enc1 = this._b64arr.indexOf(input.charAt(i++));
			enc2 = this._b64arr.indexOf(input.charAt(i++));
			enc3 = this._b64arr.indexOf(input.charAt(i++));
			enc4 = this._b64arr.indexOf(input.charAt(i++));

			c1 = (enc1 << 2) | (enc2 >> 4);
			c2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			c3 = ((enc3 & 3) << 6) | enc4;

			output += String.fromCharCode(c1);
			if (enc3 != 64)
				output += String.fromCharCode(c2);
			if (enc4 != 64)
				output += String.fromCharCode(c3);

		} while (i < z);

		return output;
	},

	decode_array: function(input, z) {
		var c1, c2, c3, enc1, enc2, enc3, enc4, i = 0;
		var output = [];
		
		var l=input.length;
		if (typeof z=='undefined') z = l;
		else if (z>l) z=l;

		do {
			enc1 = this._b64arr.indexOf(input.charAt(i++));
			enc2 = this._b64arr.indexOf(input.charAt(i++));
			enc3 = this._b64arr.indexOf(input.charAt(i++));
			enc4 = this._b64arr.indexOf(input.charAt(i++));

			c1 = (enc1 << 2) | (enc2 >> 4);
			c2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			c3 = ((enc3 & 3) << 6) | enc4;

			output.push(c1);
			if (enc3 != 64)
				output.push(c2);
			if (enc4 != 64)
				output.push(c3);
		} while (i < z);
		return output;
	}

};

woas.utf8 = {
	// encode from string to string
	encode: function(s) {
		return unescape( encodeURIComponent( s ) );
	},
	
	encode_to_array: function(s) {
		return woas.split_bytes( this.encode(s) );
	},
	decode: function(s) {
		return decodeURIComponent(escape(s));
	},
	decode_from_array: function(byte_arr) {
		try {
			return this.decode( woas.merge_bytes( byte_arr ) );
		}
		catch (e) {
			woas.log(e);	//log:1
		}
		return null;
	},
	
	reUTF8Space: /[^\u0000-\u007F]+/g,
	
	// convert UTF8 sequences of the XHTML source into &#dddd; sequences
	do_escape: function(src) {
		return src.replace(this.reUTF8Space, function ($1) {
			var l=$1.length;
			var s="";
			for(var i=0;i < l;i++) {
				s+="&#"+$1.charCodeAt(i)+";";
			}
			return s;
		});
	}

};

woas._last_filename = null;

woas._get_path = function(id) {
	if (this.browser.firefox3 || this.browser.firefox_new)
		return this.dirname(ff3_getPath(d$(id)));
	// use the last used path
	if (this.browser.opera)
		return this.dirname(this._last_filename);
	// on older browsers this was allowed
	return this.dirname(d$(id).value);
};

// tool to read/store flags in an integer
woas.binaryflag = {
	// 32bit full mask
	_field_mask: [0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80, 0x100, 0x200, 0x400, 0x800, 0x1000, 0x2000, 0x4000, 0x8000, 0x10000,
				0x20000, 0x40000, 0x80000, 0x100000, 0x200000, 0x400000, 0x800000, 0x1000000, 0x2000000, 0x4000000, 0x8000000, 0x10000000, 0x20000000, 0x40000000, 0x80000000, 0x100000000],
	
	get: function(bm, pos) {
		return (bm & this._field_mask[pos]) ? true : false;
	},
	
	set: function(bm, pos, value) {
		if (value)
			return bm | this._field_mask[pos];
		return bm & ~this._field_mask[pos];
	},
	
	// return an integer after having parsed given object with given order
	get_object: function(obj, order) {
		var rv=0;
		for(var i=0;i<order.length;++i) {
			if (obj[order[i]])
				rv |= this._field_mask[i];
		}
		return rv;
	},

	// set object properties to true/false after parsing the bits by given order
	set_object: function(obj, order, bm) {
		for(var i=0;i<order.length;++i) {
			obj[order[i]] = (bm & this._field_mask[i]) ? true : false;
		}
	}

	
};
