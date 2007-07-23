/* <![CDATA[ */
/*** stickwiki.js ***/

// page attributes bits are mapped to (readonly, encrypted, ...)

var debug = true;			// toggle debug mode (and console)
var end_trim = false;		// trim pages from the end

var forstack = [];			// forward history stack, discarded when saving
var cached_search = "";
var cfg_changed = false;	// true when configuration has been changed
var search_focused = false;
var _custom_focus = false;
var _prev_title = current;	// used when entering/exiting edit mode
var _decrypt_failed = false;
var result_pages = [];
var last_AES_page;
var current_namespace = "";
var was_local = !__config.server_mode;	// to save the server_mode flag once
var floating_pages = [];				// pages which need to be saved and are waiting in the queue
var _bootscript = null;					// bootscript
var _hl_reg = null;						// search highlighting regex

var ie = false;
var ie6 = false;
var firefox = false;
var opera = false;

// Automatic-Save TimeOut object
var _asto = null;

/* HERE BEGINS FRAMEWORK CODE */

var _doctype = "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">\n";

if((navigator.userAgent).indexOf("Opera")!=-1)
	opera = true;
else if(navigator.appName == "Netscape")
	firefox = true;
else if((navigator.appName).indexOf("Microsoft")!=-1) {
	ie = true;
	ie6 = (navigator.userAgent.search(/msie 6\./i)!=-1);
}

// finds out if Opera is trying to look like Mozilla
if (firefox && (navigator.product != "Gecko"))
	firefox = false;

// finds out if Opera is trying to look like IE
if (ie && (navigator.userAgent.indexOf("Opera") != -1))
	ie = false;

var log;
if (debug) {
	// logging function - used in development
	log = function (aMessage)
	{
	    var logbox = el("swlogger");
		nls = logbox.value.match(/\n/g);
		if (nls!=null && typeof(nls)=='object' && nls.length>11)
			logbox.value = "";
		logbox.value += aMessage + "\n";
	};
} else {
	log = function(aMessage) { };
}

if (!ie)
	window.onresize = on_resize;

// Returns element by ID
function el(name)
{
	return document.getElementById(name);
}

function elHide(id) {
	el(id).style.display = "none";
	el(id).style.visibility = "hidden";
}

function elShow(id) {
	el(id).style.display = "inline";
	el(id).style.visibility = "visible";
}

// fixes the Array prototype for older browsers
if (typeof Array.prototype.push == "undefined") {
  Array.prototype.push = function(str) {
    this[this.length] = str;
  }
}

// implements a function which returns an array with unique elements
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

// thanks to S.Willison
RegExp.escape = function(text) {
  if (!arguments.callee.sRE) {
    var specials = [
      '/', '.', '*', '+', '?', '|',
      '(', ')', '[', ']', '{', '}', '\\'
    ];
    arguments.callee.sRE = new RegExp(
      '(\\' + specials.join('|\\') + ')', 'g'
    );
  }
  return text.replace(arguments.callee.sRE, '\\$1');
}

function str_rep(s, n) {
	var r = "";
	while (--n >= 0) r += s;
	return r;
}

function _rand(scale) {
	return Math.floor(Math.random() * scale);
}

function sw_trim(s) {
	return s.replace(/(^\s*)|(\s*$)/, '');
}

function _random_string(string_length) {
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
	var randomstring = '';
	for (var i=0; i<string_length; i++) {
		var rnum = _rand(chars.length);
		randomstring += chars.charAt(rnum);
	}
	return randomstring;
}

// function used to store encrypted pages into javascript strings
function js_hex_encode(s) {
	// escape double quotes
	s = s.replace(new RegExp("\"", "g"), "\\\"");
	// escape newlines (\r\n happens only on the stupid IE) and eventually split the lines accordingly
	s = s.replace(new RegExp("\r\n|\n", "g"), "\\n");
	// and fix also the >= 128 ascii chars (to prevent UTF-8 characters corruption)
	return s.replace(new RegExp("([^\u0000-\u007F])", "g"), function(str, $1) {
				var s = $1.charCodeAt(0).toString(16);
				for(var i=2-s.length;i>0;i--) {
					s = "0"+s;
				}
				return "\\x" + s;
	});
}

function js_encode(s, split_lines) {
	// not to counfound browsers with saved tags
	s = s.replace(/([\\<>'])/g, function (str, ch) {
//		return "\\x"+ch.charCodeAt(0).toString(16);
		switch (ch) {
			case "<":
				return	"\\x3C";
			case ">":
				return "\\x3E";
			case "'":
				return "\\'";
//			case "\\":
		}
		return "\\\\";
	});
	// escape newlines (\r\n happens only on the stupid IE) and eventually split the lines accordingly
	if (!split_lines)
		s = s.replace(new RegExp("\r\n|\n", "g"), "\\n");
	else
		s = s.replace(new RegExp("\r\n|\n", "g"), "\\n\\\n");
	// and fix also the >= 128 ascii chars (to prevent UTF-8 characters corruption)
	return s.replace(new RegExp("([^\u0000-\u007F])", "g"), function(str, $1) {
				var s = $1.charCodeAt(0).toString(16);
				for(var i=4-s.length;i>0;i--) {
					s = "0"+s;
				}
				return "\\u" + s;
	});
}

// used to escape blocks of source into HTML-valid output
function xhtml_encode(src) {
	return src.replace(/[<>&]+/g, function ($1) {
		var l=$1.length;
		var s="";
		for(var i=0;i<l;i++) {
			switch ($1.charAt(i)) {
				case '<':
					s+="&lt;";
					break;
				case '>':
					s+="&gt;";
					break;
//				case '&':
				default:
					s+="&amp;";
			}
		}
		return s;
	}).replace(/[^\u0000-\u007F]+/g, function ($1) {
		var l=$1.length;
		var s="";
		for(var i=0;i<l;i++) {
			s+="&#"+$1.charCodeAt(i)+";";
		}
		return s;
	});
}

function _create_centered_popup(name,fw,fh,extra) {
	var hpos=Math.ceil((screen.width-fw)/2);
	var vpos=Math.ceil((screen.height-fh)/2);
	var wnd = window.open("about:blank",name,"width="+fw+",height="+fh+		
	",left="+hpos+",top="+vpos+extra);
	wnd.focus();
	return wnd;
}

function _number_format(n, prec) {
	return n.toString().replace(new RegExp("(\\."+str_rep("\\d", prec)+")\\d*$"), "$1");
}

function _convert_bytes(bytes) {
	log("Converting "+bytes+" bytes");
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
/* HERE ENDS FRAMEWORK CODE */

function page_index(page) {
	return page_titles.indexOf(page);
}

var edit_override = true;

var reserved_namespaces = ["Special", "Lock", "Locked", "Unlocked", "Unlock", "Tags", "Tagged", "Include"];

var reserved_rx = "^";
for(var i = (edit_override ? 1 : 0);i<reserved_namespaces.length;i++) {
	reserved_rx += /*RegExp.Escape(*/reserved_namespaces[i] + "::";
	if (i<reserved_namespaces.length-1)
		reserved_rx += "|";
}
reserved_rx = new RegExp(reserved_rx, "i");

function is_reserved(page) {
	return (page.search(reserved_rx)==0);
}

function page_exists(page)
{
	return (is_reserved(page) || (page.substring(page.length-2)=="::") || (page_index(page)!=-1));
}

var parse_marker = "#"+_random_string(8);

function _get_tags(text) {
	var tags = [];
	if (text.indexOf("Tag::")==0)
		tags.push(sw_trim(text.substring(5)));
	else if (text.indexOf("Tags::")==0) {
		text = sw_trim(text.substring(6));
		if (!text.length)
			return tags;
		var alltags;
		if (text.indexOf("|")!=-1)
			alltags = text.split("|");
		else
			alltags = text.split(",");
		for(var i=0;i<alltags.length;i++) {
			tags.push(sw_trim(alltags[i]));
		}
	}
	return tags;
}

function header_anchor(s) {
	// apply a hard normalization - will not preserve header ids uniqueness
	return s.replace(/[^a-zA-Z0-9]/g, '_');
}

var has_toc;
var page_TOC = "";
var reParseOldHeaders = /(^|\n)(\!+)\s*([^\n]+)/g;
var reParseHeaders = /(^|\n)(=+)\s*([^\n]+)/g;
function header_replace(str, $1, $2, $3) {
		var header = $3;
		var len = $2.length;
		if (header.indexOf($2)==header.length - len)
			header = header.substring(0, header.length - len);
//		log("h"+len+" = "+header);
		// automatically build the TOC if needed
		if (has_toc) {
			page_TOC += str_rep("#", len)+" <a class=\"link\" href=\"#" + header_anchor(header) + "\">" + header + "<\/a>\n";
		}
		return "</div><h"+len+" id=\""+header_anchor(header)+"\">"+header+"</h"+len+"><div class=\"level"+len+"\">";
}

// XHTML lists and tables parsing code by plumloco
// This is a bit of a monster, if you know an easier way please tell me!
// There is no limit to the level of nesting and it produces
// valid xhtml markup.
var reReapLists = /(?:^|\n)([\*#@])[ \t].*(?:\n\1+[ \t][^\n]+)*/g;
function parseList(str, type, $2) {
        var uoro = (type!='*')?'ol':'ul';
        var suoro = '<' + uoro + ((type=='@') ? " type=\"a\"":"")+'>';
        var euoro = '</' + uoro + '>';

        function sublist(lst, ll)
        {   
            var s = '';
            var item, sub

            while (lst.length && lst[0][1].length == ll )
            {
                item = lst.shift();
                sub = sublist(lst, ll + 1);
                if (sub.length)
                {
                    s += '<li>' + item[2] + suoro + sub + euoro + '</li>' ;
                }
                else
                {
                    s += '<li>' + item[2] + '</li>';
                }
            }
            return s;  
        }
		
        var old = 0;
        var reItems = /^([\*#@]+)[ \t]([^\n]+)/mg;

		var stk = [];
	    str.replace( reItems,
                function(str, p1, p2)
                {
//					log("p1 = "+p1+", p2 = "+p2);
                    level = p1.length;
					if (debug) {
	                    if ((level - old) > 1)
	                    {
	                        alert('ListNestingError');
	                    }
					}
                    old = level;
                    stk.push([str, p1, p2]);
                }
            );

		return "\n"+suoro + sublist(stk, 1) + euoro;
	}

	var reReapTables = /(?:^|\n)\{\|.*((?:\n\|.*)*)(?:\n|$)/g;	
    function parseTables(str, p1)
    {
        var caption = false;
        var stk = [];
        p1.replace( /\n\|([+ -])(.*)/g, function(str, pp1, pp2)
            {
                if (pp1 == '-')
                {
                    return;
                }
                if (pp1 == '+')
                {
                    caption = caption || pp2;
                    return;
                }
                stk.push('<td>' + pp2.split(' ||').join('</td><td>') + '</td>');
            } 
        );
        return  '<table class="text_area">' +
                    (caption?('<caption>' + caption + '</caption>'):'') +
                    '<tr>' + stk.join('</tr><tr>') + '</tr>' +
                '</table>' 
    }


function _filter_wiki(s) {
	return s.replace(/\{\{\{((.|\n)*?)\}\}\}/g, "").
		replace(/<script[^>]*>((.|\n)*?)<\/script>/gi, "").
		replace(/\<\w+\s[^>]+>/g, "").
		replace(/\<\/\w[^>]+>/g, "");
}

// used not to break layout when presenting search results
var force_inline = false;
// external javascript files to be loaded
var script_extension = [];

// Parse typed code into HTML - allows overriding
var parse = function(text) {
	return _i_parse(text, false, 1);
}

// will be replaced by a better parse engine in future
function _i_parse(text, export_links, js_mode) {
	if (text == null) {
		log("text = null while parsing current page \""+current+"\"");
		return;
	} //else		log("typeof(text) = "+typeof(text));
	
	var html_tags = [];
	
	// put away stuff contained in inline nowiki blocks {{{ }}}
	text = text.replace(/\{\{\{(.*?)\}\}\}/g, function (str, $1) {
		var r = "<!-- "+parse_marker+"::"+html_tags.length+" -->";
		html_tags.push("<tt class=\"wiki_preformatted\">"+xhtml_encode($1)+"</tt>");
		return r;
	});
	
	// transclusion code originally provided by martinellison
	if (!force_inline) {
		var trans_level = 0;
		do {
			var trans = 0;
			text = text.replace(/\[\[Include::([^\]]+)\]\]/g, function (str, $1) {
				var parts = $1.split("|");
				var templname = parts[0];
				log("Transcluding "+templname+"("+parts.slice(0).toString()+")");
				var templtext = get_text(templname);
				if (templtext == null) {
					var templs="[["+templname+"]]";
					if (parts.length>1)
						templs += "|"+parts.slice(1).join("|");
					return "[<!-- -->[Include::"+templs+"]]";
				}
				// in case of embedded file, add the inline file or add the image
				if (is_embedded(templname)) {
					var r = "<!-- "+parse_marker+"::"+html_tags.length+" -->";
					log("Embedded file transclusion: "+templname);
					if (is_image(templname)) {
						var img, img_name = xhtml_encode(templname.substr(templname.indexOf("::")+2));
						if (export_links)
							img = "<img class=\"embedded\" src=\""+_export_get_fname(templname)+"\" alt=\""+img_name+"\" ";
						else
							img = "<img class=\"embedded\" src=\""+templtext+"\" ";
						if (parts.length>1) {
							img += parts[1];
							if (!export_links && !parts[1].match(/alt=('|").*?\1/))
								img += " alt=\""+img_name+"\"";
						}
						html_tags.push(img+" />");
					} else
						html_tags.push("<pre class=\"embedded\">"+xhtml_encode(templtext)+"</pre>");
					templtext = r;
				} else {
					templtext = templtext.replace(/%(\d+)/g, function(param, paramno) {
						if (paramno < parts.length)
							return parts[paramno];
						else
							return param;
					} );
				}
				trans = 1;
				return templtext;	
			});
			// keep transcluding when a transclusion was made and when transcluding depth is not excessive
		} while (trans && (++trans_level < 16));
	}
	
	// thank you IE, really thank you
	if (ie)
		text = text.replace("\r\n", "\n");

	var tags = [];

	// put away raw text contained in multi-line nowiki blocks {{{ }}}
	text = text.replace(/\{\{\{((.|\n)*?)\}\}\}/g, function (str, $1) {
		var r = "<!-- "+parse_marker+"::"+html_tags.length+" -->";
		html_tags.push("<pre class=\"wiki_preformatted\">"+xhtml_encode($1)+"</pre>");
		return r;
	});
	
	// reset the array of custom scripts
	script_extension = [];
	if (js_mode) {
		// gather all script tags
		text = text.replace(/<script([^>]*)>((.|\n)*?)<\/script>/gi, function (str, $1, $2) {
			if (js_mode==2) {
				var r = "<!-- "+parse_marker+"::"+html_tags.length+" -->";
				html_tags.push(str);
				return r;
			}
			var m=$1.match(/src=(?:"|')([^\s'">]+)/);
			if (m!=null)
				script_extension.push(new Array(m[1]));
			else
				script_extension.push($2);
			return "";
		});
	}
	
	// put a placeholder for the TOC
	var p = text.indexOf("[[Special::TOC]]");
	if (p != -1) {
		has_toc = true;
		text = text.substring(0, p) + "<!-- "+parse_marker+":TOC -->" + text.substring(p+16
//		+ 	((text.charAt(p+16)=="\n") ? 1 : 0)
		);	
	} else has_toc = false;

	// put away big enough HTML tags sequences (with attributes)
	text = text.replace(/(<\/?\w+[^>]+>[ \t]*)+/g, function (tag) {
		var r = "<!-- "+parse_marker+'::'+html_tags.length+" -->";
		html_tags.push(tag);
		return r;
	});
	
	// links with | 
	text = text.replace(/\[\[([^\]\]]*?)\|(.*?)\]\]/g, function(str, $1, $2) {
			if ($1.search(/^\w+:\/\//)==0) {
				var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
				html_tags.push("<a class=\"world\" href=\"" + $1.replace(/^mailto:\/\//, "mailto:") + "\" target=\"_blank\">" + $2 + "<\/a>");
				return r;
			}
				var page = $1;
				var hashloc = $1.indexOf("#");
				var gotohash = "";
				if (hashloc > 0) {
					page = $1.substr(0, hashloc);
					gotohash = "; window.location.hash= \"" + $1.substr(hashloc) + "\"";
				}
				if (page_exists(page)) {
					var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
					var wl;
					if (export_links) {
//						if (page_index(page)==-1)
//							wl = " onclick=\"alert('not yet implemented');\"";		else
						wl = " href=\""+_export_get_fname(page)+"\"";
					} else
						wl = " onclick='go_to(\"" + js_encode(page) +	"\")" + gotohash + "'";
					html_tags.push("<a class=\"link\""+ wl + " >" + $2 + "<\/a>");
					return r;
				} else {
					if ($1.charAt(0)=="#") {
						var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
						var wl;
						if (export_links)
							wl = _export_get_fname(page);
						else wl = "";
						html_tags.push("<a class=\"link\" href=\""+wl+"#" +header_anchor($1.substring(1)) + "\">" + $2 + "<\/a>");
						return r;
					} else {
						var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
						var wl;
						if (export_links)
							wl=" href=\"#\"";
						else wl = " onclick='go_to(\"" +js_encode($1)+"\")'";
						html_tags.push("<a class=\"unlink\" "+wl+">" + $2 + "<\/a>");
						return r;
					}
				}
			}); //"<a class=\"wiki\" onclick='go_to(\"$2\")'>$1<\/a>");
	// links without |
	var inline_tags = 0;
	text = text.replace(/\[\[([^\]]*?)\]\]/g, function(str, $1) {
		if ($1.search(/^\w+:\/\//)==0) {
			var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
			$1 = $1.replace(/^mailto:\/\//, "mailto:");
			html_tags.push("<a class=\"world\" href=\"" + $1 + "\" target=\"_blank\">" + $1 + "<\/a>");
			return r;
		}
		
		found_tags = _get_tags($1);
//		log("Found tags = ("+found_tags+")");
		
		if (found_tags.length>0) {
			tags = tags.concat(found_tags);
			if (!force_inline)
				return "";
			inline_tags++;
			return "<!-- "+parse_marker+":"+inline_tags+" -->";
		}
		
		if (page_exists($1)) {
			var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
			var wl;
			if (export_links)
				wl = " href=\""+_export_get_fname($1)+"\"";
			else
				wl = " onclick=\"go_to('" + js_encode($1) +"')\"";
				
			html_tags.push("<a class=\"link\""+wl+">" + $1 + "<\/a>");
			return r;
		} else {
			var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
			if ($1.charAt(0)=="#") {
				html_tags.push("<a class=\"link\" href=\"#" +header_anchor($1.substring(1)) + "\">" + $1.substring(1) + "<\/a>");
			} else {
				var r="<!-- "+parse_marker+'::'+html_tags.length+" -->";
				var wl;
				if (export_links)
					wl=" href=\#\"";
				else
					wl = " onclick=\"go_to('" +js_encode($1)+"')\"";
				html_tags.push("<a class=\"unlink\" "+wl+">" + $1 + "<\/a>");
			}
			return r;
		}
	}); //"<a class=\"wiki\" onclick='go_to(\"$1\")'>$1<\/a>");

	// allow non-wrapping newlines
	text = text.replace(/\\\n/g, "");
	
	// <u>
	text = text.replace(/(^|[^\w])_([^_]+)_/g, "$1"+parse_marker+"uS#$2"+parse_marker+"uE#");
	
	// italics
	text = text.replace(/(^|[^\w:])\/([^\n\/]+)\/($|[^\w])/g, function (str, $1, $2, $3) {
		if (str.indexOf("//")!=-1) {
			return str;
		}
		return $1+"<em>"+$2+"</em>"+$3;
	});
	
	// ordered/unordered lists parsing (code by plumloco)
	text = text.replace(reReapLists, parseList);
	
	// headers (from h1 to h6, as defined by the HTML 3.2 standard)
	text = text.replace(reParseHeaders, header_replace);
	text = text.replace(reParseOldHeaders, header_replace);
	
	if (has_toc) {
		// remove the trailing newline
//		page_TOC = page_TOC.substr(0, page_TOC.length-2);
		// replace the TOC placeholder with the real TOC
		text = text.replace("<!-- "+parse_marker+":TOC -->",
				"<div class=\"wiki_toc\"><p class=\"wiki_toc_title\">Table of Contents</p>" +
				page_TOC.replace(reReapLists, parseList)
				/*.replace("\n<", "<") */
				+ "</div>" );
		page_TOC = "";
	}
	
	// <strong> for bold text
	text = text.replace(/(^|[^\w\/\\])\*([^\*\n]+)\*/g, "$1"+parse_marker+"bS#$2"+parse_marker+"bE#");

	// <strike>
	//text = text.replace(/(^|\n|\s|\>|\*)\--(.*?)\--/g, "$1<strike>$2<\/strike>");
	// <br />
	
	text = text.replace(new RegExp(parse_marker+"([ub])([SE])#", "g"), function (str, $1, $2) {
		if ($2=='E') {
			if ($1=='u')
				return "</span>";
			return "</strong>";
		}
		if ($1=='u')
			tag = "<span style=\"text-decoration:underline;\">";
		else
			tag = "<strong>";
		return tag;
	});

	// <hr> horizontal rulers made with 3 hyphens. 4 suggested
	text = text.replace(/(^|\n)\s*\-{3,}\s*(\n|$)/g, "<hr />");
	
	// tables-parsing pass
    text = text.replace(reReapTables, parseTables);
	
	// cleanup \n after headers and lists
	text = text.replace(/((<\/h[1-6]><div class="level[1-6]">)|(<\/[uo]l>))(\n+)/g, function (str, $1, $2, $3, trailing_nl) {
		if (trailing_nl.length>2)
			return $1+trailing_nl.substr(2);
		return $1;
	});
	
	// remove \n before list start tags
	text = text.replace(/\n(<[uo]l>)/g, "$1");

	// end-trim
	if (end_trim)
		text = text.replace(/\s*$/, "");

	// compress newlines characters into paragraphs (disabled)
//	text = text.replace(/\n(\n+)/g, "<p>$1</p>");
//	text = text.replace(/\n(\n*)\n/g, "<p>$1</p>");

	// make some newlines cleanup after pre tags
	text = text.replace(/(<\/?pre>)\n/gi, "$1");

	// convert newlines to br tags
	text = text.replace(/\n/g, "<br />");

	if (html_tags.length>0) {
		text = text.replace(new RegExp("<\\!-- "+parse_marker+"::(\\d+) -->", "g"), function (str, $1) {
			return html_tags[$1];
		});
	}
	
	tags = tags.toUnique();
	if (tags.length && !export_links) {
		if (force_inline)
			s = "";
		else
			s = "<div class=\"taglinks\">";
		s += "Tags: ";
		for(var i=0;i<tags.length-1;i++) {
			s+="<a class=\"link tag\" onclick=\"go_to('Tagged::"+js_encode(tags[i])+"')\">"+tags[i]+"</a>&nbsp;&nbsp;";
		}
		if (tags.length>0)
			s+="<a class=\"link tag\" onclick=\"go_to('Tagged::"+js_encode(tags[tags.length-1])+"')\">"+tags[tags.length-1]+"</a>";
		if (!force_inline) {
			s+="</div>";
			text += s;
		} else {
			text = text.replace(new RegExp("<\\!-- "+parse_marker+":(\\d+) -->", "g"), function (str, $1) {
				if ($1==inline_tags)
					return s;
				return "";
			});
		}
	}
	if (force_inline)
		force_inline = false;
		
	if (text.substring(0,5)!="</div")
		return "<div class=\"level0\">" + text + "</div>";
	return text.substring(6)+"</div>";
}

// prepends and appends a newline character to workaround plumloco's XHTML lists parsing bug - no more needed
function _join_list(arr) {
	if (!arr.length)
		return "";
	result_pages = arr.slice(0);
	return "* [["+arr.sort().join("]]\n* [[")+"]]";
}

function _simple_join_list(arr, sorted) {
	if (sorted)
		arr = arr.sort();
	// a newline is added here
	return arr.join("\n")+"\n";
}

// with two trailing double colon
function _get_namespace_pages(ns) {
	var pg = [];
	switch (ns) {
		case "Locked::":
			return "= Pages in "+ns+" namespace\n" + special_encrypted_pages(true);
		case "Unlocked::":
			return "= Pages in "+ns+" namespace\n" + special_encrypted_pages(false);
		case "Tagged::": // to be used in wiki source
		case "Tags::":
			return "= Pages in "+ns+" namespace\n" + special_tagged_pages(false);
	}

	for(var i=0;i<page_titles.length;i++) {
		if (page_titles[i].indexOf(ns)==0)
			pg.push( page_titles[i]);
	}
	return "= Pages in "+ns+" namespace\n" + _join_list(pg);
}

function _get_tagged(tag) {
	var pg = [];

	var tmp;
	for(var i=0; i<pages.length; i++)
	{
		tmp = get_src_page(i);
		if (tmp==null)
			continue;
		tmp.replace(/\[\[([^\|]*?)\]\]/g, function(str, $1)
			{
				if ($1.search(/^\w+:\/\//)==0)
					return;
					
				found_tags = _get_tags($1);
				
//				alert(found_tags);
				
				for (var t=0;t<found_tags.length;t++) {
					if (found_tags[t] == tag)
						pg.push(page_titles[i]);
				}

				
			});
	}
	
	if (!pg.length)
		return "No pages tagged with *"+tag+"*";
	return "= Pages tagged with " + tag + "\n" + _join_list(pg);
}

function special_encrypted_pages(locked) {
	var pg = [];
	for(var i=0;i<pages.length;i++) {
		if (locked == is__encrypted(i))
			pg.push(page_titles[i]);
	}
	return _join_list(pg);
}

//var hl_reg;

// Returns a index of search pages (by miz & legolas558)
function special_search( str )
{
	document.body.style.cursor = "wait";
	var pg_body = [];
	var title_result = "";
	
	str = xhtml_encode(str);

	var count = 0;
	// matches the search string and nearby text
	var reg = new RegExp( ".{0,30}" + RegExp.escape(sw_trim(str)).
					replace(/\s+/g, ".*?") + ".{0,30}", "gi" );
	_hl_reg = new RegExp("("+RegExp.escape(str)+")", "gi");
/*	hl_reg = new RegExp( ".*?" + RegExp.escape(str).
					replace(/^\s+/, "").
					replace(/\s+$/, "").
					replace(/([^\s]+)/g, "($1)").
					replace(/\s+/g, ".*?") + ".*", "gi" );	*/
	var tmp;
	result_pages = [];
	for(var i=0; i<pages.length; i++)
	{
		if (is_reserved(page_titles[i]))
			continue;
		
		tmp = get_src_page(i);
		if (tmp==null)
			continue;
//		log("Searching into "+page_titles[i]);
		
//		log("Regex is \""+reg+"\"");

		var added = false;
		//look for str in title
		if(page_titles[i].match(reg)) {
			title_result += "* [[" + page_titles[i] + "]]\n";
			result_pages.push(page_titles[i]);
			added = true;
		}

		//Look for str in body
		res_body = tmp.match(reg);
//		log("res_body = "+res_body);
		if (res_body!=null) {
			if (!added)
				result_pages.push(page_titles[i]);
			count = res_body.length;
			res_body = "..."+res_body.join("...\n")+"..."; //.replace(/\n/g, " ");
			pg_body.push( "* [[" + page_titles[i] + "]]: found *" + count + "* times :<div class=\"search_results\">{{{" + res_body +"\n}}}\n</div>");
		}
	}
	document.body.style.cursor = "auto";
	if (!pg_body.length && !title_result.length)
		return "/No results found for *"+str+"*/";
	force_inline = true;
	return "Results for *" + str + "*\n" + title_result + "\n\n----\n" + _simple_join_list(pg_body, false);
}

function special_tagged_pages() {
	var utags = [];
	var tags_tree = [];
	var tmp = null, ipos;
	for(var i=0; i<pages.length; i++)
	{
		tmp = get_src_page(i);
		if (tmp==null)
			continue;
		tmp.replace(/\[\[Tags?::([^\]]+)\]\]/g,
			function (str, $1) {
				var tmp=$1.split(",");
				for(var j=0;j<tmp.length; j++) {
					var tag=sw_trim(tmp[j]);
					if (!tag.length) continue;
					ipos = utags.indexOf(tag);
					if (ipos==-1) {
						ipos = utags.length;
						utags.push(tag);						
						tags_tree[ipos] = [];
					}
					tags_tree[ipos].push(page_titles[i]);
				}
			});
	}
	var s="";
	var tag = null, obj = null;
	var l=utags.length;
	for(var j=0;j<l;j++) {
		obj = tags_tree[j].sort();
		s += "\n== [[Tagged::"+utags[j]+"]]\n";
		for(var i=0;i<obj.length;i++) {
			s+="* [["+obj[i]+"]]\n";
		}
	}
	return s;
}

// Returns a index of all pages
function special_all_pages()
{
	var pg = [];
	for(var i=0; i<page_titles.length; i++)
	{
		if (!is_reserved(page_titles[i]))
			pg.push( page_titles[i] );
	}
	return _join_list(pg);
}

// Returns a index of all dead pages
function special_dead_pages () {
	var dead_pages = [];
	var from_pages = [];
	var page_done = false;
	var tmp;
	for (j=0;j<pages.length;j++) {
		tmp = get_src_page(j);
		if (tmp==null)
			continue;
		tmp.replace(/\[\[([^\]\]]*?)(\|([^\]\]]+))?\]\]/g,
			function (str, $1, $2, $3) {
				if (page_done)
					return false;
//				log("In "+page_titles[j]+": "+$1+" -> "+$3);
				if ($1.charAt(0)=="#")
					return;
				if ($1.search(/^\w+:\/\//)==0)
					return;
				if ($1.match(/Tag(s|ged)?:/gi))
					return;
				p = $1;
				if (!page_exists(p) && (p!=page_titles[j])) {
					for(var i=0;i<dead_pages.length;i++) {
						if (dead_pages[i]==p) {
							from_pages[i].push(page_titles[j]);
							page_done = true;
							break;
						}
					}
					if (!page_done) {
						dead_pages.push(p);
						from_pages.push(new Array(page_titles[j]));
						page_done = true;
					}
				}
	        }
		);
		page_done = false;
	}

	var pg = [];
	for(var i=0;i<dead_pages.length;i++) {
		s = "[["+dead_pages[i]+"]] from ";
		var from = from_pages[i];
		for(j=0;j<from.length-1;j++) {
			s+="[["+from[j]+"]], ";
		}
		if (from.length>0)
			s+="[["+from[from.length-1]+"]]";
		pg.push(s);
	}

  result_pages = dead_pages;	
  if (!pg.length)
	return '/No dead pages/';
  return _simple_join_list(pg, true);
}

function is_menu(page) {
	return (page.indexOf("::Menu")==page.length-6);
}

// returns namespace with trailing ::
function _get_namespace(page) {
	var p = page.lastIndexOf("::");
	if (p==-1) return "";
	return page.substring(0,p+2);	
}

function special_orphaned_pages()
{
	var pg = [];
	var found = false;
	for(j=0; j<page_titles.length; j++)
	{
		if (is_reserved(page_titles[j]))
			continue;
		if (is_menu(page_titles[j])) {	// check if the namespace has some pages
			var ns = _get_namespace(page_titles[j]);
			if (ns == "") continue;
			for(var i=0;i<page_titles.length;i++) {
				if (page_titles[i].indexOf(ns)==0) {
					found = true;
					break;
				}
			}
		} else {
			// search for pages that link to it
//		log("Scanning references to page "+page_titles[j]);
			var tmp;
			for(var i=0; i<page_titles.length; i++) {
				if ((i==j) || is_reserved(page_titles[i]))
					continue;
				tmp = get_src_page(i);
				if (tmp==null)
					continue;
				var re = new RegExp("\\[\\[" + RegExp.escape(page_titles[j]) + "(\\]\\]|\\|)", "i");
//			log("matching "+re+" into "+page_titles[i]);
				if (tmp.search(re)!=-1) {
					found = true;
					break;
				}
			}
		}
		if(found == false) {
			pg.push( page_titles[j] );
		} else found = false;
	}
	if (!pg.length)
		return "/No orphaned pages found/";
	else
		return _join_list(pg); // TODO - Delete repeated data
}

function special_links_here()
{
	var pg = [];
	var tmp;
	var reg = new RegExp("\\[\\["+RegExp.escape(current)+"(\\||\\]\\])", "gi");
	for(j=0; j<pages.length; j++)
	{
		// search for pages that link to it
		tmp = get_src_page(j);
		if (tmp==null)
			continue;
		if (tmp.match(reg)) {
			pg.push( page_titles[j] );
		}
	}
	if(pg.length == 0)
		return "/No page links here/";
	else
		return "== Links to "+current+"\n"+_join_list(pg);
}

function is_readonly(page) {
	return is__readonly(page_index(page));
}

function is__readonly(pi) {
	if (page_attrs[pi] & 1)
		return true;
	return false;
}

function is__encrypted(pi) {
	if (debug) {
		if (pi==-1) {
			alert("Invalid page index!");
			return;
		}
	}
//	log(page_titles[pi]+" flags: "+page_attrs[pi].toString(16)+" (enc:"+(page_attrs[pi] & 2)+")");
	if (page_attrs[pi] & 2)
		return true;
	return false;
}
function is_encrypted(page) {
	return is__encrypted(page_index(page));
}

function is__embedded(pi) {
	if (debug) {
		if (pi==-1) {
			alert("Invalid page index!");
			return;
		}
	}
//	log(page_titles[pi]+" flags: "+page_attrs[pi].toString(16)+" (enc:"+(page_attrs[pi] & 2)+")");
	if (page_attrs[pi] & 4)
		return true;
	return false;
}
function is_embedded(page) {
	return is__embedded(page_index(page));
}

function is__image(pi) {
	if (debug) {
		if (pi==-1) {
			alert("Invalid page index!");
			return;
		}
	}
//	log(page_titles[pi]+" flags: "+page_attrs[pi].toString(16)+" (enc:"+(page_attrs[pi] & 2)+")");
	if (page_attrs[pi] & 8)
		return true;
	return false;
}
function is_image(page) { return is__image(page_index(page)); }

// return a plain page or a decrypted one if available through the latest key
function get_page(pi) {
	if (is__embedded(pi))
		return null;
	if (!is__encrypted(pi))
		return pages[pi];
	if (!key.length) {
		latest_AES_page = "";
		return null;
	}
	var pg = AES_decrypt(pages[pi].slice(0));	/*WARNING: may not be supported by all browsers*/
	last_AES_page = page_titles[pi];
	return pg;	
}

function get_src_page(pi) {
	var pg = get_page(pi);
	if (pg==null) return pg;
	return _filter_wiki(pg);
}

function get_text(title) {
	var pi = page_index(title);
	if (pi==-1)
		return null;
	return get__text(pi);
}

function get__text(pi) {
	// is the page encrypted or plain?
	if (!is__encrypted(pi))
		return pages[pi];
	document.body.style.cursor = "wait";
	_decrypt_failed = true;
	var retry = 0;		
	var pg = null;
	do {
		if (retry || !key.length) {
			var pw = prompt('The latest entered password (if any) was not correct for page "'+page_titles[pi]+"'\n\nPlease enter the correct password.", '');
			if ((pw==null) || !pw.length) {
				latest_AES_page = "";
				AES_clearKey();
				document.body.style.cursor = "auto";
				return null;
			}
			AES_setKey(pw);
			retry++;
		}
		// pass a copied instance to the decrypt function
		pg = AES_decrypt(pages[pi].slice(0));	/*WARNING: may not be supported by all browsers*/
		last_AES_page = page_titles[pi];
		if (pg != null)
			break;
	} while (retry<2);
	if (pg != null) {
		_decrypt_failed = false;
		if (!__config.key_cache)
			AES_clearKey();
		else
			latest_AES_page = page_titles[pi];
	} else {
		alert("Access denied");
		AES_clearKey();
		latest_AES_page = "";
	}
	document.body.style.cursor = "auto";
	return pg;
}

function set__text(pi, text) {
	log("Setting wiki text for page #"+pi+" \""+page_titles[pi]+"\"");
//	text = _new_syntax_patch(text);
	if (!is__encrypted(pi)) {
		pages[pi] = text;
		return;
	}
	pages[pi] = AES_encrypt(text);
	last_AES_page = page_titles[pi];
}

// Sets text typed by user
function set_text(text)
{
	var pi = page_index(current);
	if (pi==-1) {
		log("current page \""+current+"\" is not cached!");
		return;
	}
	set__text(pi, text);
}

// triggered by UI graphic button
function page_print() {
	var wnd = _create_centered_popup("print_popup", Math.ceil(screen.width*0.75),Math.ceil(screen.height*0.75),
	",status=yes,menubar=yes,resizable=yes,scrollbars=yes");
	var css_payload = "";
	if (ie) {
		if (ie6)
			css_payload = "div.wiki_toc { align: center;}";
		else
			css_payload = "div.wiki_toc { position: relative; left:25%; right: 25%;}";
	} else
		css_payload = "div.wiki_toc { margin: 0 auto;}\n";
	wnd.document.writeln(_doctype+"<ht"+"ml><he"+"ad><title>"+current+"</title>"+
	"<st"+"yle type=\"text/css\">"+css_payload+document.getElementsByTagName("style")[0].innerHTML+"</sty"+"le><scr"+"ipt type=\"text/javascript\">function go_to(page) { alert(\"Sorry, you cannot browse the wiki while in print mode\");}</sc"+"ript></h"+"ead><"+"body>"+
	el("wiki_text").innerHTML+"</bod"+"y></h"+"tml>\n");
	wnd.document.close();
}

function clear_search() {
	if (!cached_search.length)
		return;
	cached_search = "";
	assert_current("Special::Search");
}

function assert_current(page) {
	if( current != page )
		go_to( page ) ;
	else
		set_current( page );
}

// make the actual search and cache the results
function do_search()
{
	var search_string = el("string_to_search").value;

	if ( !search_string.length )
		return;
	
	cached_search = parse(special_search( search_string ));
	
	assert_current("Special::Search");
}

function _create_page(ns, cr, ask) {
	log("_create_page("+ns+","+cr+",...)");
	if (is_reserved(ns+"::")) {
		alert("You are not allowed to create a page titled \""+ns+"::"+cr+"\" because namespace \""+ns+"\" is reserved");
			return false;
	}
	if ((ns=="File") || (ns=="Image")) {
		go_to(cr);
		return false;
	}
	if (ask && !confirm("Page not found. Do you want to create it?"))
		return false;
	// create and edit the new page
	if (ns.length)
		cr = ns+"::"+cr;
	if (cr!="Menu")
		pages.push("= "+cr+"\n");
	else
		pages.push("\n");
	page_attrs.push(0);
	page_titles.push(cr);
	current = cr;
//	log("Now pages list is: "+page_titles);
//	save_page(cr);	// do not save
	// proceed with a normal wiki source page
	edit_page(cr);
	return true;
}

function _get_embedded(cr, etype) {
	log("Retrieving embedded source "+cr);
	var pi=page_index(cr);
	if (pi==-1) {
		return parse("[[Include::Special::Embed|"+etype+"]]");
	}
	var text=get__text(pi);
	if (text==null) return text;
	var xhtml = "";
	var slash_c = (navigator.appVersion.indexOf("Win")!=-1)?"\\":"/";
	if (etype=="file") {
		var fn = cr.substr(cr.indexOf("::")+2);
		var pview_data = merge_bytes(b64_decode(text, 1024)), pview_link = "";
		var ext_size = Math.ceil((text.length*3)/4);
		if (ext_size-pview_data.length>10)
			pview_link = "<div id='_part_display'><em>Only the first 1024 bytes are displayed</em><br /><a href='javascript:show_full_file("+pi+")'>Display full file</a></div>";
		xhtml = "<pre id='_file_ct' class=\"embedded\">"+xhtml_encode(pview_data)+"</pre>"+
		pview_link+
		"<br /><hr />File size: "+_convert_bytes(ext_size)+"<br /><br />Raw transclusion:"+
		parse("\n{{{[[Include::"+cr+"]]}}}"+
		"\n\n<a href=\"javascript:query_delete_file()\">Delete embedded file</a>\n"+
		"\n<a href=\"javascript:query_export_file()\">Export file</a>\n"+
		"<sc"+"ript>function query_delete_file() {if (confirm('Are you sure you want to delete this file?')){delete_page('"+js_encode(cr)+"');back_or(main_page);save_page('"+js_encode(cr)+"');}}\n"
		+(pview_link.length?"function show_full_file(pi) { var text = get__text(pi); if (text==null) return; elShow('loading_overlay'); setHTML(el('_part_display'), ''); setHTML(el('_file_ct'), merge_bytes(b64_decode(text))); elHide('loading_overlay'); }\n":'')+
		"function query_export_file() {\nvar exp_path = _get_this_filename().replace(/\\"+slash_c+"[^\\"+
		slash_c+"]*$/, \""+(slash_c=="\\"?"\\\\":"/")+"\")+'"+js_encode(fn)+"';if (confirm('Do you want to export this file in the below specified path?'+\"\\n\\n\"+exp_path)){export_file('"+js_encode(cr)+"', exp_path);}}"+
		"</sc"+"ript>"
		);
	} else {
		var img_name = cr.substr(cr.indexOf("::")+2);
		xhtml = parse("= "+img_name+"\n\n"+
		"<img id=\"img_tag\" class=\"embedded\" src=\""+text+"\" alt=\""+xhtml_encode(img_name)+"\" />"+
		"\n\n<div id=\"img_desc\">Loading...</div>"+
		"<sc"+"ript>function _to_img_display() { var img=el('img_tag');\nsetHTML(el('img_desc'), 'Mime type: "+text.match(/^data:\s*([^;]+);/)[1]+"<br />File size: "+_convert_bytes(((text.length-(text.match(/^data:\s*[^;]*;\s*[^,]*,\s*/)[0]).length)*3)/4)+
		" (requires "+_convert_bytes(text.length)+" due to base64 encoding)"+
		"<br />Width: '+img.width+'px<br />Height: '+img.height+'px');} setTimeout('_to_img_display()', 0); function query_delete_image() {if (confirm('Are you sure you want to delete this image?')){delete_page('"+js_encode(cr)+"');back_or(main_page);save_page('"+js_encode(cr)+"');}}\n"+
		"function query_export_image() {\nvar exp_path = _get_this_filename().replace(/\\"+slash_c+"[^\\"+
		slash_c+"]*$/, \""+(slash_c=="\\"?"\\\\":"/")+"\")+'"+js_encode(img_name)+"';if (confirm('Do you want to export this image in the below specified path?'+\"\\n\\n\"+exp_path)){export_image('"+js_encode(cr)+"', exp_path);}}"+
		"</sc"+"ript>"+
		"\nSimple transclusion:\n\n{{{[[Include::"+cr+"]]}}}\n\nTransclusion with additional attributes:\n\n{{{[[Include::"+cr+"|border=\"0\" onclick=\"go_to('"+
		js_encode(cr)+"')\" style=\"cursor:pointer\"]]}}}\n"+
		"\n<a href=\"javascript:query_delete_image()\">Delete embedded image</a>\n"+
		"\n<a href=\"javascript:query_export_image()\">Export image</a>\n");
	}
	return xhtml;
}

function export_image(page, dest_path) {
	var pi=page_index(page);
	if (pi==-1)
		return false;
	var data=get__text(pi);
	if (data==null)
		return false;
	return _b64_export(data, dest_path);
}

function _b64_export(data, dest_path) {
	// decode the base64-encoded data
	data = merge_bytes(b64_decode(data.replace(/^data:\s*[^;]*;\s*base64,\s*/, '')));
	// attempt to save the file
	_force_binary = true;
	var r = saveFile(dest_path, data);	
	_force_binary = false;
	return r;
}

function export_file(page, dest_path) {
	var pi=page_index(page);
	if (pi==-1)
		return false;
	var data=get__text(pi);
	if (data==null)
		return false;
	// attempt to save the file (text mode)
	return saveFile(dest_path, data);	
}

function _embed_process(etype) {
	var filename = el("filename_").value;
	if(filename == "")
	{
		alert("A file must be selected");
		return false;
	}

	_force_binary = true;
	var ct = loadFile(filename);
	_force_binary = false;
	if (ct == null || !ct.length) {
		alert("Could not load file "+filename);
		return false;
	}
	
	ct = b64_encode(split_bytes(ct));
	
	// calculate the flags for the embedded file
	if (etype == "image") {
		var m=filename.match(/\.(\w+)$/);
		if (m==null) m = "";
		else m=m[1].toLowerCase();
		var guess_mime = "image";
		switch (m) {
			case "png":
				guess_mime = "image/png";
			break;
			case "gif":
				guess_mime = "image/gif";
				break;
			case "jpg":
			case "jpeg":
				guess_mime = "image/jpeg";
				break;
		}
		ct = "data:"+guess_mime+";base64,"+ct;
		etype = 12;
	} else etype = 4;
	
	pages.push(ct);
	page_attrs.push(etype);
	page_titles.push(current);
	
	// save everything
	save_to_file(true);
	
	refresh_menu_area();
	set_current(current);
	
	return true;
}

function _get_special(cr) {
	var text = null;
	log("Getting special page "+cr);
	switch(cr) {
		case "New page":
			var title = prompt("Insert new page title", "");
			if ((title!=null) && title.length) {
				if (page_index(title)!=-1)
					alert("A page with title \""+title+"\" already exists!");
				else {
					cr = title;
					if (cr.substring(cr.length-2)=="::") {
						alert("You cannot create a page as a namespace");
					} else {
						var p = cr.indexOf("::");
						if (p!=-1) {
							ns = cr.substring(0,p);
							log("namespace of "+cr+" is "+ns);
							cr = cr.substring(p+2);
						} else ns="";
						if (!_create_page(ns, cr, false))
							return;
						var upd_menu = (cr=='Menu');
						if (!upd_menu && confirm("Do you want to add a link into the main menu?")) {
							var menu = get_text("::Menu");
							var p = menu.indexOf("\n\n");
							if (p==-1)
								menu += "\n[["+ns+cr+"]]";
							else
								menu = menu.substring(0,p)+"\n[["+title+"]]"+menu.substring(p);
							set__text(page_index("::Menu"), menu);
							upd_menu = true;
						}
						if (upd_menu)
							refresh_menu_area();
					}

				}
			}
			return;
		case "Search":
			text = get_text("Special::"+cr);
			break;
		case "Erase Wiki":
			if (erase_wiki()) {
				save_to_file(true);
				back_or(main_page);
			}
			return null;
		case "Main Page":
			go_to(main_page);
			return null;
		case "All Pages":
			text = special_all_pages();
			break;
		case "Orphaned Pages":
			text = special_orphaned_pages();
			break;
		case "Pages not yet created":
			text = special_dead_pages();
			break;
		case "Backlinks":
			text = special_links_here();
			break;
		case "Edit Menu":
			go_to("::Menu");
			edit();
			return null;
		case "Edit CSS":
			current_editing("Special::"+cr, true);
			el("wiki_editor").value = document.getElementsByTagName("style")[0].innerHTML;
			return null;
		case "Edit Bootscript":
			cr = "Special::Bootscript";
			var tmp = get_text(cr);
			if (tmp == null)
				return;
			current_editing(cr, true);
			// setup the wiki editor textbox
			current_editing(cr, __config.permit_edits | __config.server_mode);
			el("wiki_editor").value = tmp;
			return null;
		default:
			cr = "Special::" + cr;
			if (is_embedded(cr)) {
				text = _get_embedded(cr, is_image(cr) ? "image":"file");
				if (text == null) {
					if (_decrypt_failed)
						_decrypt_failed = false;
					return;
				}
				_add_namespace_menu("Special");
				
				load_as_current(cr, text);
				return;
			}
			text = get_text(cr);
			if(text == null) {
				if (edit_override) {
					_create_page("Special", cr.substr(9), true);
					return null;
				}
				alert("Invalid special page.");
			}
	}
	return text;
}

// Load a new current page
function set_current(cr)
{
	var text, namespace;
	result_pages = [];
	// eventually remove the previous custom script
	_clear_swcs();
//	log("Setting \""+cr+"\" as current page");
	if (cr.substring(cr.length-2)=="::") {
		text = _get_namespace_pages(cr);
		namespace = cr.substring(0,cr.length-2);
		cr = "";
	} else {
		var p = cr.indexOf("::");
		if (p!=-1) {
			namespace = cr.substring(0,p);
			log("namespace of "+cr+" is "+namespace);
			cr = cr.substring(p+2);
				switch (namespace) {
					case "Special":
						text = _get_special(cr);
						if (text == null)
							return;
						break;
					case "Tagged": // deprecated
					case "Tags":
						text = _get_tagged(cr);
						if (text == null)
							return;
						break;
					case "Lock":
						pi = page_index(cr);
						if (debug) {
							if ((pi==-1) || is__encrypted(pi)) {
								alert("Invalid lock page request");
								return;
							}
						}
						if (key.length) {
							if (confirm("Do you want to use the last password (last time used on page \""+latest_AES_page+"\") to lock this page \""+cr+"\"?")) {
								_finalize_lock(pi);
								return;
							}
						}
						text = get_text("Special::Lock");
						break;
					case "Unlock":
						pi = page_index(cr);
						if (debug) {
							if ((pi==-1) || !is__encrypted(pi)) {
								alert("Invalid lock page request");
								return;
							}
						}
						if (!confirm("Do you want to remove encryption for page \""+cr+"\"?"))
							return;
						text = get_text(cr);
						if (_decrypt_failed) {
							_decrypt_failed = false;
							return;
						}
						pages[pi] = text;
						page_attrs[pi] -= 2;
						if (!__config.key_cache)
							AES_clearKey();
						set_current(cr);
						save_page(cr);
						return;
					case "File":
					case "Image":
						text = _get_embedded(namespace+"::"+cr, namespace.toLowerCase());
						if(text == null) {
							if (_decrypt_failed)
								_decrypt_failed = false;
							return;
						}
						_add_namespace_menu(namespace);
						if (namespace.length)
							cr = namespace + "::" + cr;
						load_as_current(cr, text);
						return;
						break;
					default:
						text = get_text(namespace+"::"+cr);
				}

		} else {
			namespace = "";
			text = get_text(cr);
		}
	}
	
	if(text == null)
	{
		if (_decrypt_failed) {
			_decrypt_failed = false;
			return;
		}
		if (!_create_page(namespace, cr, true))
			return;
	}
	
	_add_namespace_menu(namespace);
	if (namespace.length)
		cr = namespace + "::" + cr;
	load_as_current(cr, parse(text));
}

var swcs = [];

function _clear_swcs() {
//	setHTML(swcs, "");
	if (!swcs.length) return;
	for(var i=0;i<swcs.length;i++) {
		document.getElementsByTagName("head")[0].removeChild(swcs[i]);
	}
	swcs = [];
}

function create_breadcrumb(title) {
	var tmp=title.split("::");
	if (tmp.length==1)
		return title;
	var s="", partial="";
	for(var i=0;i<tmp.length-1;i++) {
		partial += tmp[i]+"::";
		s += "<a href=\"#\" onclick=\"go_to('"+js_encode(partial)+"')\">"+tmp[i]+"</a> :: ";		
	}
	return s+tmp[tmp.length-1];
}

function _activate_scripts() {
	// add the custom scripts (if any)
	if (script_extension.length) {
		log(script_extension.length + " javascript files/blocks to process");
		var s_elem, is_inline;
		for (var i=0;i<script_extension.length;i++) {
			s_elem = document.createElement("script");
			s_elem.type="text/javascript";
			s_elem.id = "sw_custom_script_"+i;
			is_inline = new String(typeof(script_extension[i]));
			is_inline = (is_inline.toLowerCase()=="string");
			if (!is_inline)
				s_elem.src = script_extension[i][0];
			document.getElementsByTagName("head")[0].appendChild(s_elem);
			if (is_inline)
				setHTML(s_elem, script_extension[i]);
			swcs.push(s_elem);
		}
	}
}

function load_as_current(title, xhtml) {
	scrollTo(0,0);
	log("CURRENT loaded: "+title+", "+xhtml.length+" bytes");
	el("wiki_title").innerHTML = create_breadcrumb(title);
	el("wiki_text").innerHTML = xhtml;
	document.title = title;
	update_nav_icons(title);
	current = title;
	_activate_scripts();
}

function bool2chk(b) {
	if (b) return "checked";
	return "";
}

function el_eval(name) {
	cfg_changed = true;
	if (el(name).checked)
		return true;
	return false;
}

function _set_layout(fixed) {
	el("sw_wiki_header").style.position = (fixed ? "fixed" : "absolute");
	el("sw_menu_area").style.position = (fixed ? "fixed" : "absolute");
}

function lock_page(page) {
	var pwd = el("pw1").value;
	if (!pwd.length) {
		el("pw1").focus();
		return;
	}
	if (pwd!=el("pw2").value) {
		el("pw2").focus();
		return;
	}
	var pi = page_index(page);
	if (debug) {
		if (pi==-1) {
			alert("Cannot encrypt unexisting page!");
			return;
		}
		if (is__encrypted(pi)) {
			alert("Page already encrypted!");
			return;
		}
	}
	AES_setKey(pwd);
	_finalize_lock(pi);
}

function _finalize_lock(pi) {
	_perform_lock(pi);
	var title = page_titles[pi];
	set_current(title);
	if (!__config.key_cache) {
		AES_clearKey();
		latest_AES_page = "";
	} else
		last_AES_page = title;
	save__page(pi);
}

function _perform_lock(pi) {
	pages[pi] = AES_encrypt(pages[pi]);
	log("E: encrypted length is "+pages[pi].length);
	page_attrs[pi] += 2;
}

var _pw_q_lock = false;

function pw_quality() {

	if (_pw_q_lock)
		return;
		
	_pw_q_lock = true;

function _hex_col(tone) {
	var s=Math.floor(tone).toString(16);
	if (s.length==1)
		return "0"+s;
	return s;
}

	// original code from http://lxr.mozilla.org/seamonkey/source/security/manager/pki/resources/content/password.js
	var pw=el('pw1').value;

	//length of the password
	var pwlength=pw.length;
	
	if (pwlength!=0) {

	//use of numbers in the password
	  var numnumeric = pw.match(/[0-9]/g);
	  var numeric=(numnumeric!=null)?numnumeric.length/pwlength:0;

	//use of symbols in the password
	  var symbols = pw.match(/\W/g);
	  var numsymbols= (symbols!=null)?symbols.length/pwlength:0;

	//use of uppercase in the password
	  var numupper = pw.match(/[^A-Z]/g);
	  var upper=numupper!=null?numupper.length/pwlength:0;
	// end of modified code from Mozilla
	
	var numlower = pw.match(/[^a-z]/g);
	var lower = numlower!=null?numlower.length/pwlength:0;
	
	var u_lo = upper+lower;

	//   var pwstrength=((pwlength*10)-20) + (numeric*10) + (numsymbols*15) + (upper*10);
	  
		// 80% of security defined by length (at least 16, best 22 chars), 10% by symbols, 5% by numeric presence and 5% by upper case presence
		var pwstrength = ((pwlength/18) * 65) + (numsymbols * 10 + u_lo*20 + numeric*5);
		
		var repco = split_bytes(pw).toUnique().length/pwlength;
		if (repco<0.8)
			pwstrength *= (repco+0.2);
		log("pwstrength = "+_number_format(pwstrength/100, 2)+", repco = "+repco);
	} else
		var pwstrength = 0;
  
	if (pwstrength>100)
		color = "#00FF00";
	else
		color = "#" + _hex_col((100-pwstrength)*255/100) + _hex_col((pwstrength*255)/100) + "00";
  
	el("pw1").style.backgroundColor = color;
	el("txtBits").innerHTML = "Key size: "+(pwlength*8).toString() + " bits";
	
	_pw_q_lock = false;
}

function _add_namespace_menu(namespace) {
	if (current_namespace == namespace)
		return;
	var pi;
	if (namespace == "")
		pi = -1;
	else
		pi = page_index(namespace+"::Menu");
	if (pi==-1) {
		el("ns_menu_area").innerHTML = "";
		if (current_namespace!="") {
			elHide("ns_menu_area");
			elHide("ns_menu_edit_button");
		}
		current_namespace = namespace;
		return;
	}
	var menu = get__text(pi);
	if (menu == null)
		el("ns_menu_area").innerHTML = "";
	else
		el("ns_menu_area").innerHTML = parse(menu);
	if (current_namespace=="") {
		elShow("ns_menu_area");
		elShow("ns_menu_edit_button");
	}
	current_namespace = namespace;	
}

function refresh_menu_area() {
	var tmp = current_namespace;
	current_namespace=parse_marker;
	_add_namespace_menu(tmp);
	var menu = get_text("::Menu");
	if (menu == null)
		el("menu_area").innerHTML = "";
	else {
		el("menu_area").innerHTML = parse(menu);
		_activate_scripts();
	}
}

function _gen_display(id, visible, prefix) {
	if (visible)
		elShow(prefix+"_"+id);
	else
		elHide(prefix+"_"+id);
}

function img_display(id, visible) {
	if (!ie) {
		_gen_display(id, visible, "img");
		_gen_display(id, !visible, "alt");
	} else {
		_gen_display(id, !visible, "img");
		_gen_display(id, visible, "alt");
	}
}

function menu_display(id, visible) {
	_gen_display(id, visible, "menu");
//	log("menu_"+id+" is "+el("menu_"+id).style.display);
}

function create_alt_buttons() {
	if (ie) {
		el("alt_back").innerHTML = "&#223;";
		el("alt_forward").innerHTML = "&#222;";
		el("alt_cancel").innerHTML = "&#251;";
	}
}

function _auto_saver() {
	if (floating_pages.length && !kbd_hooking) {
		save_to_file(true);
		menu_display("save", false);
	}
	if (__config.auto_save)
		_asto = setTimeout("_auto_saver()", __config.auto_save);
}

// save configuration on exit
function before_quit() {
	if (floating_pages.length)
		save_to_file(true);
	else {
		if (__config.save_on_quit && cfg_changed)
			save_to_file(false);
	}
	return true;
}

var setHTML, getHTML;

// when the page is loaded
function on_load()
{
	log("***** StickWiki started *****");
	
	document.body.style.cursor = "auto";

	if (debug)
		elShow("debug_info");
	else
		elHide("debug_info");
		
	if (ie) {	// some hacks for IE
		setHTML = function(elem, html) {elem.text = html;};
		getHTML = function(elem) {return elem.text};
		var obj = el("sw_wiki_header");
		obj.style.filter = "alpha(opacity=75);";
		if (ie6) {
			el("sw_wiki_header").style.position = "absolute";
			el("sw_menu_area").style.position = "absolute";
		}
	} else {
		setHTML = function(elem, html) {elem.innerHTML = html;};
		getHTML = function(elem) {return elem.innerHTML;};
//		setup_uri_pics(el("img_home"),el("img_back"),el("img_forward"),el("img_edit"),el("img_cancel"),el("img_save"),el("img_advanced"));
	}

	img_display("back", true);
	img_display("forward", true);
	img_display("home", true);
	img_display("edit", true);
	img_display("print", true);
	img_display("advanced", true);
	img_display("cancel", true);
	img_display("save", true);
	img_display("lock", true);
	img_display("unlock", true);
	
	// customized keyboard hook
	document.onkeydown = kbd_hook;

	// Go straight to page requested
	var qpage=document.location.href.split("?")[1];
	if(qpage)
		current = unescape(qpage);
		
//	swcs = el("sw_custom_script");

	set_current(current);
	refresh_menu_area();
	disable_edit();
	
	if (__config.permit_edits)
		elShow("menu_edit_button");
	else
		elHide("menu_edit_button");
	
	if (__config.cumulative_save && __config.auto_save)
		_asto = setTimeout("_auto_saver()", __config.auto_save);
		
	_create_bs();
	
	elHide("loading_overlay");
}

function _create_bs() {
	var s=get_text("Special::Bootscript");
	if (s==null || !s.length) return false;
	// remove the comments
	s = s.replace(/^\s*\/\*(.|\n)*?\*\/\s*/g, '');
	if (!s.length) return false;
	_bootscript = document.createElement("script");
	_bootscript.type="text/javascript";
	_bootscript.id = "woas_bootscript";
	document.getElementsByTagName("head")[0].appendChild(_bootscript);
	setHTML(_bootscript, s);
	return true;
}

function _clear_bs() { if (_bootscript!=null) document.getElementsByTagName("head")[0].removeChild(_bootscript); }

function ff_fix_focus() {
//runtime fix for Firefox bug 374786
	if (firefox)
		el("wiki_text").blur();
}

function search_focus(focused) {
	search_focused = focused;
	if (!focused)
		ff_fix_focus();
}

function custom_focus(focused) {
	_custom_focus = focused;
	if (!focused)
		ff_fix_focus();
}

var kbd_hooking=false;

function kbd_hook(orig_e)
{
	if (!orig_e)
		e = window.event;
	else
		e = orig_e;
		
	if (!kbd_hooking) {
		if (_custom_focus)
			return orig_e;
		if (search_focused) {
			if (e.keyCode==13) {
				ff_fix_focus();
				do_search();
				return false;
			}
			return orig_e;
		}
		if ((e.keyCode==8) || (e.keyCode==27)) {
			go_back();
			ff_fix_focus();
			return false;
		}
	}

	if (e.keyCode==27) {
		cancel();
		ff_fix_focus();
		return false;
	}

	return orig_e;
}

// when the page is resized
function on_resize()
{
	if(ie == false)
	{
		el("wiki_editor").style.width = window.innerWidth - 30 + "px";
		el("wiki_editor").style.height = window.innerHeight - 150 + "px";
	}
}

function update_nav_icons(page) {
	menu_display("back", (backstack.length > 0));
	menu_display("forward", (forstack.length > 0));
	menu_display("advanced", (page != "Special::Advanced"));
	menu_display("edit", edit_allowed(page));
	update_lock_icons(page);
}

function update_lock_icons(page) {
	var cyphered, can_lock, can_unlock;
	if (result_pages.length<2) {
		var pi = page_index(page);
		if (pi==-1) {
			can_lock = can_unlock = false;
			cyphered = false;
		} else {
			can_unlock = cyphered = is__encrypted(pi);
			can_lock = !can_unlock && __config.permit_edits;
		}
	} else {
		log("result_pages is ("+result_pages+")");
		can_lock = can_unlock = (result_pages.length>0);
		cyphered = false;
	}
	
	menu_display("lock", !kbd_hooking && can_lock);
	menu_display("unlock", !kbd_hooking && can_unlock);
	var cls;
	if (cyphered || (page.indexOf("Locked::")==0))
		cls = "text_area locked";
	else
		cls = "text_area";
	el("wiki_text").className = cls;
}

// Adjusts the menu buttons
function disable_edit()
{
//	log("DISABLING edit mode");
	kbd_hooking = false;
	// check for back and forward buttons - TODO grey out icons
	update_nav_icons(current);
	menu_display("home", true);
	if (__config.cumulative_save)
		menu_display("save", floating_pages.length!=0);
	else
		menu_display("save", false);
	menu_display("cancel", false);
	menu_display("print", true);
	elShow("text_area");
	elHide("edit_area");
//	log("setting back title to "+_prev_title);
	document.title = el("wiki_title").innerHTML = _prev_title;
}

function menu_dblclick() {
	if (!__config.dblclick_edit)
		return false;
	edit_menu();
	return true;
}

function ns_menu_dblclick() {
	if (!__config.dblclick_edit)
		return false;
	edit_ns_menu();
	return true;
}

function page_dblclick() {
	if (!__config.dblclick_edit)
		return false;
	edit();
	return true;
}

function edit_menu() {
	edit_page("::Menu");
}

function edit_ns_menu() {
	edit_page(current_namespace+"::Menu");
}

function lock() {
	if (result_pages.length)
		_lock_pages(result_pages);
	else
		go_to("Lock::" + current);
}

function unlock() {
	if (result_pages.length)
		_unlock_pages(result_pages);
	else
		go_to("Unlock::" + current);
}

function _lock_pages(arr) {
	alert("Not yet implemented");
}

function _unlock_pages(arr) {
	alert("Not yet implemented");
}

// when edit is clicked
function edit()
{
	edit_page(current);
}

function edit_allowed(page) {
	if (edit_override)
		return (page_index(page) != -1);
	if (!__config.permit_edits)
		return false;
	if (is_reserved(page))
		return false;
	return !is_readonly(page);
}

// setup the title boxes and gets ready to edit text
function current_editing(page, disabled) {
	scrollTo(0,0);
	log("CURRENT editing "+page+", title disabled: "+disabled);
	_prev_title = current;
	el("wiki_page_title").disabled = (disabled ? "disabled" : "");
	el("wiki_page_title").value = page;
	document.title = el("wiki_title").innerHTML = "Editing "+page;
	// current must be set BEFORE calling enabling menu edit
//	log("ENABLING edit mode");
	kbd_hooking = true;
	menu_display("back", false);
	menu_display("forward", false);
	menu_display("advanced", false);
	menu_display("home", false);
	menu_display("edit", false);
	menu_display("print", false);
	menu_display("save", true);
	menu_display("cancel", true);
	update_lock_icons(page);
	elHide("text_area");

	// FIXME!
	if (!ie)	{
		el("wiki_editor").style.width = window.innerWidth - 30 + "px";
		el("wiki_editor").style.height = window.innerHeight - 150 + "px";
	}
	elShow("edit_area");

	el("wiki_editor").focus();
	current = page;
}

function edit_page(page) {
	if (!edit_allowed(page))
		return;
	if (__config.server_mode)
		alert("You are using Wiki on a Stick on a REMOTE server, your changes will not be saved neither remotely or locally.\n\nThe correct usage of Wiki on a Stick is LOCAL, so you should use a local copy of this page to exploit the save features. All changes made to this copy of Wiki on a Stick will be lost.");
	var tmp = get_text(page);
	if (tmp == null)
		return;
	// setup the wiki editor textbox
	current_editing(page, is_reserved(page));
	el("wiki_editor").value = tmp;
}

function rename_page(previous, newpage)
{
	log("Renaming "+previous+" to "+newpage);
	if (page_index(newpage)!=-1) {
		alert("A page with title \""+newpage+"\" already exists!");
		return false;
	}
	var pi = page_index(previous);
	page_titles[pi] = newpage;
	var re = new RegExp("\\[\\[" + RegExp.escape(previous) + "(\\]\\]|\\|)", "gi");
	var changed;
	for(var i=0; i<pages.length; i++)
	{
		//FIXME: should not replace within the nowiki blocks!
		var tmp = get_page(i);
		if (tmp==null)
			continue;
		changed = false;
		tmp = tmp.replace(re, function (str) {
			changed = true;
			return "[["+newpage+str.substring(previous.length+2);
		});
		if (changed)
			set__text(i, tmp);
	}
	if (previous == main_page)
		main_page = newpage;
	if (_prev_title == previous)
		_prev_title = newpage;
	return true;
}

// when a page is deleted
function delete_page(page)
{
	for(var i=0; i<pages.length; i++)
	{
		if (page_titles[i] == page)
		{
			log("DELETED page "+page);
			page_titles.splice(i,1);
			pages.splice(i,1);
			page_attrs.splice(i,1);
			refresh_menu_area();
			break;
		}
	}
}

// applies some on-the-fly patches for the syntax changes in v0.9
function _new_syntax_patch(text) {
	//BUG: will also modify text contained in nowiki blocks
	text = text.replace(/(^|\n)(\+*)([ \t])/g, function (str, $1, $2, $3) {
		return $1+str_rep("*", $2.length)+$3;
	});
	
	return text;
}

// when save is clicked
function save()
{
	if (__config.cumulative_save && !kbd_hooking) {
		save_to_file(true);
		menu_display("save", false);
		return;
	}
	switch(current)
	{
		case "Special::Edit CSS":
			setHTML(document.getElementsByTagName("style")[0], el("wiki_editor").value);
			back_to = null;
			current = "Special::Advanced";
			el("wiki_page_title").disabled = "";
			break;
		default:
			// check if text is empty
			if(el("wiki_editor").value == "")
			{
				if(confirm("Are you sure you want to DELETE this page?"))
				{
					var deleted = current;
					delete_page(current);
					disable_edit();
					back_or(main_page);
					save_page(deleted);
				}
				return;
			} else {
				// here the page gets actually saved
				set_text(el("wiki_editor").value);
				new_title = el("wiki_page_title").value;
				if (is_menu(new_title)) {
					refresh_menu_area();
					back_to = _prev_title;
				} else { if (!is_reserved(new_title) && (new_title != current)) {
						if (!rename_page(current, new_title))
							return false;
					}
					back_to = new_title;
				}				
			}
	}
	var saved = current;
	if (back_to != null)
		set_current(back_to);
	else // used for CSS editing
		back_or(main_page);
	refresh_menu_area();
	disable_edit();
	save_page(saved);
}

// when cancel is clicked
function cancel()
{
//	if(confirm("Are you sure you want to cancel this edit?")) 
	if (kbd_hooking)
	{
		disable_edit();
	} 
}

// when home is clicked
function home()
{
	go_to(main_page);
}

function back_or(or_page) {
	if (!go_back())
		set_current(or_page);
}

// when Advanced is clicked
function advanced()
{
	go_to("Special::Advanced");
}

function history_mem(page) {
	if (backstack.length>6)
		backstack = backstack.slice(1);
	backstack.push(page);
}

// follows a link
function go_to(cr)
{
	if(cr == current)
		return;
	history_mem(current);
	forstack = [];
	set_current(cr);
}

// when Back button is clicked
function go_back()
{
	if(backstack.length > 0)
	{
		forstack.push(current);
		set_current(backstack.pop());
		return true;
	}
	return false;
}

// when Forward button is clicked
function go_forward()
{
	if(forstack.length > 0)
	{
		history_mem(current);
		set_current(forstack.pop());
	}
}

function printout_arr(arr, split_lines) {

	function elem_print(e) {
		return "'" + js_encode(e, split_lines) + "'";
	}

	var s = "";
	for(var i=0;i<arr.length-1;i++) {
		s += elem_print(arr[i]) + ",\n";
	}
	if (arr.length>1)
		s += elem_print(arr[arr.length-1]) + "\n";
	return s;
}

function printout_mixed_arr(arr, split_lines, attrs) {

	function elem_print(e, attr) {
		if (attr & 2) {
			return "[" + printout_num_arr(e) + "]";
		}
		return "'" + js_encode(e, split_lines) + "'";
	}

	var s = "";
	for(var i=0;i<arr.length-1;i++) {
		s += elem_print(arr[i], attrs[i]) + ",\n";
	}
	if (arr.length>1)
		s += elem_print(arr[arr.length-1], attrs[arr.length-1]) + "\n";
	return s;
}

// used to print out encrypted pages bytes and attributes
function printout_num_arr(arr) {
	var s = "";
	for(var i=0;i<arr.length-1;i++) {
		if (arr[i]>=1000)
			s += "0x"+arr[i].toString(16) + ",";
		else
			s+=arr[i].toString() + ",";
	}
	if (arr.length>1) {
		if (arr[arr.length-1]>=1000)
			s += "0x"+arr[arr.length-1].toString(16) + ",";
		else
			s+=arr[arr.length-1].toString();
	}

	return s;
}

function save_page(page_to_save) {
	log("Saving modified page \""+page_to_save+"\"");
	var pi = page_index(page_to_save);
	if (pi==-1)
		log("Invalid page queued for save: "+page_to_save+" (possible page deletion)");
	save__page(pi);
}

function save__page(pi) {
	//this is the dummy function that will allow more efficient file saving in future
	if (__config.cumulative_save) {
		if (!floating_pages.length) {
			floating_pages.push(pi);
			menu_display("save", true);
		} else {
			if (floating_pages.indexOf(pi)==-1)
				floating_pages.push(pi);
		}
		log("floating_pages = ("+floating_pages+")");
		return;
	}
	save_to_file(true);
}

// UNUSED!
function save_options() {
	save_to_file(false);
	set_current("Special::Advanced");
}

function _get_data(marker, source, full, start) {
	var offset;
	if (full) {
		offset = source.indexOf("/* "+marker+ "-END */");
		if (offset == -1) {
			alert("END marker not found!");
			return false;
		}			
		offset += 6 + 4 + marker.length + 2;
		
		if (start) {
			var s_offset = source.indexOf("/* "+marker+ "-START */");
			if (s_offset == -1) {
				alert("START marker not found!");
				return false;
			}
			return source.substring(s_offset, offset);
		}
		
	} else {
		offset = source.indexOf("/* "+marker+ "-DATA */");
		if (offset == -1) {
			alert("DATA marker not found!");
			return false;
		}
		offset += 6 + 5 + marker.length + 1;
	}
	return source.substring(offset);
}

function _inc_marker(old_marker) {
	var m = old_marker.match(/([^\-]*)\-(\d{7,7})$/);
	if (m==null) {
		return _random_string(10)+"-0000001";
	}
	var n = new Number(m[2].replace(/^0+/, '')) + 1;
	n = n.toString();
	return m[1]+"-"+str_rep("0", 7-n.length)+n;
}

function save_to_file(full) {
	elShow("loading_overlay");
	
	var new_marker;
	if (full) {
		new_marker = _inc_marker(__marker);
	} else new_marker = __marker;
	
	// setup the page to be opened on next start
	var safe_current;
	if (__config.open_last_page) {
		if (!page_exists(current)) {
			safe_current = main_page;
		} else safe_current = current;
	} else
		safe_current = main_page;
	
	// output the javascript header and configuration flags
	var computed_js = "\n/* <![CDATA[ */\n\n/* "+new_marker+"-START */\n\nvar version = \""+version+
	"\";\n\nvar __marker = \""+new_marker+"\";\n\nvar __config = {";
	for (param in __config) {
		computed_js += "\n\""+param+"\":";
		if (typeof(__config[param])=="boolean")
			computed_js += (__config[param] ? "true" : "false")+",";
		else // for numbers
			computed_js += __config[param]+",";
	}
	computed_js = computed_js.substr(0,computed_js.length-1);
	computed_js += "};\n";
	
	computed_js += "\nvar current = '" + js_encode(safe_current)+
	"';\n\nvar main_page = '" + js_encode(main_page) + "';\n\n";
	
	computed_js += "var backstack = [\n" + printout_arr(backstack, false) + "];\n\n";

	computed_js += "var page_titles = [\n" + printout_arr(page_titles, false) + "];\n\n";
	
	computed_js += "/* " + new_marker + "-DATA */\n";
	
	if (full) {
		computed_js += "var page_attrs = [" + printout_num_arr(page_attrs) + "];\n\n";
		
		computed_js += "var pages = [\n" + printout_mixed_arr(pages, __config.allow_diff, page_attrs) + "];\n\n";
		
		computed_js += "/* " + new_marker + "-END */\n";
	}

	// cleanup the DOM before saving
	var bak_ed = el("wiki_editor").value;
	var bak_tx = el("wiki_text").innerHTML;
	var bak_mn = el("menu_area").innerHTML;

	el("wiki_editor").value = "";
	el("wiki_text").innerHTML = "";
	el("menu_area").innerHTML = "";

	if (ie) {	// to prevent their usual UTF-8 corruption
		el("alt_back").innerHTML = "";
		el("alt_forward").innerHTML = "";
		el("alt_cancel").innerHTML = "";
	}

	_clear_swcs();
	_clear_bs();
	
	var data = _get_data(__marker, document.documentElement.innerHTML, full);

	var r=false;
	if (!__config.server_mode || (was_local && __config.server_mode)) {
		r = _saveThisFile(computed_js, data);
		was_local = false;
	}
	
	if (ie)
		create_alt_buttons();

	if (r) {
		cfg_changed = false;
		floating_pages = [];
	}
	
	el("wiki_editor").value = bak_ed;
	el("wiki_text").innerHTML = bak_tx;
	el("menu_area").innerHTML = bak_mn;
	
	_create_bs();
	
	elHide("loading_overlay");
	
	return r;
}

/*** loadsave.js ***/

function _get_this_filename() {
	var filename = unescape(document.location.toString().split("?")[0]);
	filename = filename.replace(/^file:\/\/\//, '').replace(/#.*$/g, "");
//	if (ie && (filename.search(/^file:\/\//)===0))
//		filename = "//?/"+filename.substr(7);
	if (navigator.appVersion.indexOf("Win")!=-1)
		filename = filename.replace(/\//g, "\\");
	else
		filename = "/" + filename;
	return filename;
}

function _saveThisFile(new_data, old_data)
{
	var filename = _get_this_filename();
	r = saveFile(filename,
	_doctype+"<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\">\n<head>\n<sc"+"ript type=\"text/javascript\">" + new_data + "\n" + old_data + "</html>");
	if (r==true)
		log("\""+filename+"\" saved successfully");
	else
		alert("Save to file \""+filename+"\" failed!\n\nMaybe your browser is not supported");
	return r;
}

// Copied from TiddyWiki
function saveFile(fileUrl, content)
{
	var r = null;
	r = mozillaSaveFile(fileUrl, content);
	if((r == null) || (r == false))
		r = ieSaveFile(fileUrl, content);
	if((r == null) || (r == false))
		r = operaSaveFile(fileUrl, content);
	return(r);
}

function loadFile(filePath)
{
	var r = null;
	r = mozillaLoadFile(filePath);
	if((r == null) || (r == false))
		r = ieLoadFile(filePath);
	if((r == null) || (r == false))
		r = operaLoadFile(filePath);
	return(r);
}

// Returns null if it can't do it, false if there's an error, true if it saved OK
function ieSaveFile(filePath, content)
{
	try
	{
		var fso = new ActiveXObject("Scripting.FileSystemObject");
	}
	catch(e)
	{
		log("Exception while attempting to save\n\n" + e.toString());
		return(false);
	}
	if (!_force_binary) {
		var file = fso.OpenTextFile(filePath,2,-1,0);
		file.Write(content);
		file.Close();
	} else {
		alert("Binary write with Internet Explorer is not supported");
		return false;
	}
	return(true);
}

// Returns null if it can't do it, false if there's an error, or a string of the content if successful
function ieLoadFile(filePath)
{
	try
	{
		var fso = new ActiveXObject("Scripting.FileSystemObject");
		var file = fso.OpenTextFile(filePath,1);
		var content = file.ReadAll();
		file.Close();
	}
	catch(e)
	{
		alert("Exception while attempting to load\n\n" + e.toString());
		return(null);
	}
	return(content);
}

var _force_binary = false;

// Returns null if it can't do it, false if there's an error, or a string of the content if successful
function mozillaLoadFile(filePath)
{
	if(window.Components)
		try
		{
			netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
			var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			file.initWithPath(filePath);
			if (!file.exists())
				return(null);
			var inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
			inputStream.init(file, 0x01, 00004, null);
			var sInputStream = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
			sInputStream.init(inputStream);
			if (!_force_binary)
				return sInputStream.read(sInputStream.available());
			// this byte-by-byte read allows retrieval of binary files
			var tot=sInputStream.available(), i=tot;
			var rd=[];
			while (i-->=0) {
				var c=sInputStream.read(1);
				rd.push(c.charCodeAt(0));
			}
			return(merge_bytes(rd));
		}
		catch(e)
		{
			alert("Exception while attempting to load\n\n" + e);
			return(false);
		}
	return(null);
}

// Returns null if it can't do it, false if there's an error, true if it saved OK
function mozillaSaveFile(filePath, content)
{
	if(window.Components)
		try
		{
			netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
			var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			file.initWithPath(filePath);
			if (!file.exists())
				file.create(0, 0664);
			else
				log("File exists, overwriting");
			var out = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
			out.init(file, 0x20 | 0x02, 00004,null);
			out.write(content, content.length);
			out.flush();
			out.close();
			return(true);
		}
		catch(e)
		{
			alert("Exception while attempting to save\n\n" + e);
			return(false);
		}
	return(null);
}

function operaUrlToFilename(url)
{
	var f = "//localhost";
	if(url.indexOf(f) == 0)
		return url.substring(f.length);
	var i = url.indexOf(":");
	if(i > 0)
		return url.substring(i-1);
	return url;
}

function operaLoadFile(filePath)
{
	var content = [];
	try
	{
		var r = new java.io.BufferedReader(new java.io.FileReader(operaUrlToFilename(filePath)));
		var line;
		while ((line = r.readLine()) != null)
			content.push(new String(line));
		r.close();
	}
	catch(e)
	{
		if(window.opera)
			opera.postError(e);
		return null;
	}
	return content.join("\n");
}

function operaSaveFile(filePath, content)
{
	try
	{
		var s = new java.io.PrintStream(new java.io.FileOutputStream(operaUrlToFilename(filePath)));
		s.print(content);
		s.close();
	}
	catch(e)
	{
		if(window.opera) {
			opera.postError(e);
			return false;
		}
		return null;
	}
	return true;
}
/*** end of loadsave.js ***/

function erase_wiki() {
	if (!confirm("Are you going to ERASE all your pages?"))
		return false;
	if (!confirm("This is the last confirm needed in order to ERASE all your pages.\n\nALL YOUR PAGES WILL BE LOST\n\nAre you sure you want to continue?"))
		return false;
	var static_pg = ["Special::About", "Special::Advanced", "Special::Options","Special::Import",
						"Special::Lock","Special::Search","Special::Security", "Special::Embed"];
	var backup_pages = [];
	page_attrs = [0, 0, 4];
	for(var i=0;i<static_pg.length;i++) {
		var pi = page_index(static_pg[i]);
		if (pi==-1) {
			alert(static_pg[i]+" not found!");
			return false;
		}
		backup_pages.push(pages[pi]);
		page_attrs.push(0);
	}
	page_titles = ["Main Page", "::Menu", "Special::Bootscript"];
	page_titles = page_titles.concat(static_pg);
	pages = ["This is your empty main page", "[[Main Page]]\n\n[[Special::New page]]\n[[Special::Backlinks]]\n[[Special::Search]]", "/* insert here your boot script */"];
	pages = pages.concat(backup_pages);
	current = main_page = "Main Page";
	refresh_menu_area();
	backstack = [];
	forstack = [];	
	return true;
}

function _get_this_path() {
	var slash_c = (navigator.appVersion.indexOf("Win")!=-1)?"\\\\":"/";
	return _get_this_filename().replace(new RegExp("("+slash_c+")"+"[^"+slash_c+"]*$"), "$1");
}

var max_keywords_length = 250;
var max_description_length = 250;

// proper autokeywords generation functions begin here

function sortN(a,b)
{return b.w - a.w}

var common_words = ['a', 'the', 'is', 'for', 'of', 'to', 'in', 'an', 'be', 'that', 'all', 'or'];

function _auto_keywords(source) {
	if (!source.length) return "";
	var words = source.match(new RegExp("[^\\s\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]{2,}", "g"));
	if (!words.length) return "";
	var nu_words = new Array();
	var density = new Array();
	var wp=0;
	for(var i=0;i<words.length;i++) {
		if (words[i].length==0)
			continue;
		cond = (common_words.indexOf(words[i].toLowerCase())<0);
		if (cond) {
			wp = nu_words.indexOf(words[i]);
			if (wp < 0) {
				nu_words = nu_words.concat(new Array(words[i]));
				density[nu_words.length-1] = {"i":nu_words.length-1, "w":1};
			} else
				density[wp].w = density[wp].w + 1;
		}
	}
	if (!density.length) return "";
	words = new Array();
	var keywords = "", nw = "";
	density = density.sort(sortN);
	var ol=0;
	for(i=0;i<density.length;i++) {
		nw = nu_words[density[i].i];
		if (ol+nw.length>max_keywords_length)
			break;
		keywords = keywords+","+nw;
		ol+=nw.length;
	}
	return keywords.substr(1);
}

function _export_get_page(pi) {
	if (!is__encrypted(pi))
		return pages[pi];
	if (!key.length) {
		latest_AES_page = "";
		return null;
	}
	var pg = AES_decrypt(pages[pi].slice(0));	/*WARNING: may not be supported by all browsers*/
	last_AES_page = page_titles[pi];
	return pg;	
}

var _export_main_index = false, _export_unix_norm = false,
	_export_create_mode = false, _export_default_ext;

var _export_fnames_array = [], _export_replace_fname = {};

function _export_get_fname(title) {
	if (title.match(/::$/)) {
		return "#";
	}
	if (is_reserved(title))
		return "#";
	var pi=page_index(title);
	if (pi==-1) {
		alert(title);
		return "#";
	}
	if (_export_main_index && (title==main_page))
		return "index."+_export_default_ext;
	var ext = "";
	if (is__embedded(pi)) {
		title = title.substr(title.indexOf("::")+2);
		if (!is__image(pi))
			ext = "."+_export_default_ext;
	} else ext = "."+_export_default_ext;
	var fname;
	if (_export_unix_norm)
		fname = escape(title.toLowerCase().replace(/\s+/g, "_")).replace(/%3A%3A/g, "-");
	else
		fname = escape(title).replace(/%20/g, " ").replace(/%3A%3A/g, " - ");
	if (!_export_create_mode) {
		if (_export_replace_fname[fname+ext]!=null)
			return _export_replace_fname[fname+ext];
		return fname+ext;
	}
	var test_fname = fname+ext, i=0;
	while (_export_fnames_array.indexOf(test_fname)!=-1) {
		log(test_fname+" already exists, checking next fname");
		test_fname = fname+str_rep("_", ++i)+ext;
	}
	if (i)
		_export_replace_fname[fname+str_rep("_", i-1)+ext] = test_fname;
	_export_fnames_array.push(test_fname);
	return test_fname;
}

function xhtml_to_text(s) {
	return s.replace(/<br\s?\/?>/g, "\n").replace(/<\/?\w+[^>]*>/g, ' ').replace(/&#?([^;]+);/g, function(str, $1) { if (!isNaN($1)) return String.fromCharCode($1); else return ""; });
}

// by legolas558
function export_wiki() {
	try {
		var xhtml_path = el("woas_ep_xhtml").value;
		var img_path = el("woas_ep_img").value;
		var js_mode = 0;
		if (el("woas_cb_js_dyn").checked)
			js_mode = 1;
		else if (el("woas_cb_js_exp").checked)
			js_mode = 2;
		var sep_css = el("woas_cb_sep_css").checked,
			exp_menus = el("woas_cb_export_menu").checked;
		_export_main_index = el("woas_cb_index_main").checked;
		_export_default_ext = el("woas_ep_ext").value;
		var meta_author = el("woas_ep_author").value;
		meta_author = sw_trim(meta_author);
		if (meta_author.length)
			meta_author = '<meta name="author" content="'+xhtml_encode(meta_author)+'" />'+"\n";
		_export_unix_norm = el("woas_cb_unix_norm").checked;
	} catch (e) { alert(e); return false; }
	
	elShow("loading_overlay");
	el("loading_overlay").focus();
	var css = document.getElementsByTagName("style")[0].innerHTML;
	// reset some export globals
	_export_fnames_array = [];
	_export_replace_fname = {}
	if (sep_css) {
		var css_path = "woas.css";
		_export_fnames_array.push(css_path);
		saveFile(xhtml_path+css_path, css);
		css = '<link rel="stylesheet" type="text/css" media="all" href="'+css_path+'" />';
	} else
		css = '<style type="text/css">'+css+'</style>';
	
	var custom_bs = "";
	if (js_mode==2) {
		data = _export_get_page(page_index("Special::Bootscript"));
		if (data!=null && data.length) {
			saveFile(xhtml_path+"bootscript.js", data);
			custom_bs = '<sc'+'ript type="text/javascript" src="bootscript.js"></sc'+'ript>';
		}
	}

	var l=page_titles.length, data = null, fname = "", done=0, wt=null;
	for (var pi=0;pi<l;pi++) {
		if (page_titles[pi].match(/^Special::/)) continue;
		data = _export_get_page(pi);
		if (data == null) continue;
		if (page_titles[pi].indexOf("::Menu")==page_titles[pi].length-6) continue;
		_export_create_mode = true;
		fname = _export_get_fname(page_titles[pi]);
		_export_create_mode = false;
		if (is__embedded(pi)) {
			if (is__image(pi)) {
				if (!_b64_export(data, img_path+fname))
					break;
				else { ++done; continue; }
			} else
				data = '<pre class="wiki_preformatted">'+xhtml_encode(data)+"</pre>";
		} else {
			data = _i_parse(data, true, js_mode);
			if (js_mode) {
				wt = el("wiki_text");
				setHTML(wt, data);
				_activate_scripts();
				data = getHTML(wt);
			}			
		}
		var raw_text = sw_trim(xhtml_to_text(data));
		if (exp_menus) {
			var _exp_menu = get_text("::Menu");
			if (_exp_menu == null)
				_exp_menu = "";
			var _ns = _get_namespace(page_titles[pi]);
			if (_ns.length) {
				var mpi = page_index(_ns+"::Menu");
				if (mpi != -1) {
					var tmp=_export_get_page(mpi);
					if (tmp!=null)
						_exp_menu += tmp;
				}
			}
			if (_exp_menu.length) {
				_exp_menu = _i_parse(_exp_menu, true, js_mode);
				if (js_mode)
					_activate_scripts();
			}
			data = '<div class="menu_area" id="sw_menu_area" style="position: fixed;"><div class="wiki" id="menu_area">'+_exp_menu+'</div></div><div class="text_area" id="wiki_text">'+data+'</div>';
		}
		data = "<ht"+"ml><he"+"ad><title>"+xhtml_encode(page_titles[pi])+"</title>"+css+
		'<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />'+"\n"+
		'<meta name="generator" content="Wiki on a Stick v'+version+'" />'+"\n"+
		'<meta name="keywords" content="'+_auto_keywords(raw_text)+'" />'+"\n"+
		'<meta name="description" content="'+
		raw_text.replace(/\s+/g, " ").substr(0,max_description_length)+'" />'+"\n"+
		meta_author+
		custom_bs+
		"</h"+"ead><"+"body>"+data+"</bod"+"y></h"+"tml>\n"; raw_text = null;
		if (!saveFile(xhtml_path+fname, _doctype+data))
			break;
		++done;
	}
	if (js_mode) {
		refresh_menu_area();
		set_current(current);
	}
	elHide("loading_overlay");
	alert(done+" pages exported successfully");
	return true;
}

function import_wiki()
{
	var filename = el("filename_").value;
	if(filename == "")
	{
		alert("A file must be selected");
		return false;
	}

	if(confirm("This will OVERWRITE pages with the same title.\n\nAre you sure you want to continue?") == false)
		return false;

	// set hourglass
	document.body.style.cursor= "wait";
	
	var ct = loadFile(filename);
	
	// get version
	var old_version;
	var ver_str = ct.match(/<div .*?id=("version_"|version_).*?>([^<]+)<\/div>/i);
	if (ver_str && ver_str.length>1) {
		ver_str = ver_str[2];
		log("Importing wiki with version string \""+ver_str+"\"");
		switch(ver_str)
		{
			case "0.03":
				old_version = 3;
				break;
			case "0.04": 
			case "0.04G":
				old_version = 4;
				break;
			default:
				alert("Incompatible version: " + ver_str);
				document.body.style.cursor= "auto";
				return false;
		}
	} else {
		var ver_str = ct.match(/var version = "([^"]*)";(\r\n|\n)/);
		if (ver_str && ver_str.length) {
			ver_str = ver_str[1];
			log("Version string: "+ver_str);
			switch (ver_str) {
				case "0.9B":
				case "0.9":
					old_version = 9;
				break;
				case "0.9.2B":
					old_version = 92;
				break;
				case "0.9.3B":
					old_version = 93;
				break;
				case "0.9.4B":
					old_version = 94;
				break;
				default:
					alert("Incompatible version: " + ver_str);
					document.body.style.cursor= "auto";
					return false;
			}
		} else {
			log("Maybe version 0.02?");
			old_version = 2;
			if(ct.match("<div id=\"?"+escape("Special::Advanced")))
				old_version = 3;
		}
	}

	
	// import the variables
	var new_main_page = main_page;
	var old_block_edits = !__config.permit_edits;
	var page_names = [];
	var page_contents = [];
	var old_page_attrs = [];
	var pc = 0;

	
if (old_version	< 9) {
	
	var wiki;
	try {
		wiki = ct.match(/<div .*?id=(wiki|"wiki")[^_\\]*?>((.|\n|\t|\s)*)<\/div>/i)[0];
	} catch(e) {
		alert("Unrecognized file");
		document.body.style.cursor= "auto";
		return false;
	}
	
	// eliminate comments
	wiki = wiki.replace(/\<\!\-\-.*?\-\-\>/g, "");
	
	// separate variables from wiki
	var vars;
	var p = wiki.search(/<div .*?id=("variables"|variables)[^>]*?>/i);
	if (p!=-1) {
		vars = wiki.substring(p);
		wiki = wiki.substring(0, p);
	} else
		vars = "";
		
	if(old_version == 2)
	{
		try {
			vars = wiki.match(/\<div .*?id=("main_page"|main_page)>(.*?)\<\/div\>/i)[1];
		} catch(e) {
			log("No variables found");
		}
	}

	// get an array of variables and wikis
	var var_names = [];
	var var_values = [];
	var vc = 0;

	
	// eliminate headers
	wiki = wiki.substring(wiki.indexOf(">")+1);
	vars = vars.substring(vars.indexOf(">")+1);
	
	vars.replace(/<div id="?(version_|main_page_|permit_edits_|[\w_]+)"?>((\n|.)*?)<\/div>/gi, function(str, $1, $2)
			{
				if(old_version == 2)
					var_names[vc] = "main_page_";
				else
					var_names[vc] = $1;
				var_values[vc] = $2;
				vc++;
			});
			
	log("Variables are ("+var_names+")");

	// now extract the pages
	wiki.replace(/<div .*?id="?([^">]+)"?>((\n|.)*?)<\/div>/gi, function(str, $1, $2, $3)
			{
				log("Parsing old page "+$1);
				if (old_version != 2) {
					page_names[pc] = unescape($1);
					page_contents[pc] = unescape($2);
				} else {
					page_names[pc] = $1;
					page_contents[pc] = $2;
				}
				// dismiss special pages
				if (page_names[pc].indexOf("Special::")==0) {
					if (page_names[pc].search(/Special::Edit Menu/i)==0)
						page_names[pc] = "::Menu";
					else return;
				}
				
				old_page_attrs[pc] = 0;

				if (old_version < 9) {	// apply compatibility changes to stickwiki versions below v0.9
					page_contents[pc] = _new_syntax_patch(page_contents[pc].replace(new RegExp("(\\[\\[|\\|)Special::Import wiki\\]\\]", "ig"), "$1Special::Import]]").replace(/\[\[([^\]\]]*?)(\|([^\]\]]+))?\]\]/g,
					function (str, $1, $2, $3) {
						if ($3)
							return "[["+$3+"|"+$1+"]]";
						else
							return str;
					}));
				}
				pc++;
			}
			);

	log("page_names is ("+page_names+")");

	for(var i=0;i<var_names.length;i++) {
		if (var_names[i] == "main_page_")
			new_main_page = (version!=2) ? unescape(var_values[i]) : var_values[i];
		else if (var_names[i] == "permit_edits")
			old_block_edits = (var_values[i]=="0");
	}
	
	//note: before v0.04 permit_edits didnt exist
	//note: in version 2 pages were not escaped

}	else {	// we are importing a v0.9.x Beta

	// locate the random marker
	try {
		var old_marker = ct.match(/\nvar __marker = "([A-Za-z\-\d]+)";(\r\n|\n)/)[1];
	} catch (e) {
		alert("Marker not found!");
		document.body.style.cursor= "auto";
		return false;
	}

	// import the CSS head tag
	var css = null;
	ct.replace(/<style\s.*?type="?text\/css"?[^>]*>((\n|.)*?)<\/style>/i, function (str, $1) {
		css = $1;
	});
	if (css!=null) {
		log("Imported "+css.length+" bytes of CSS");
		setHTML(document.getElementsByTagName("style")[0], css);
	}

	var data = _get_data(old_marker, ct, true, true);

	if (old_version < 92) {
		var collected = [];
		
		// rename the variables
		data = data.replace(/([^\\])\nvar (\w+) = /g, function (str, $1, $2) {
			collected.push('sw_import_'+$2);
			return $1+"\nvar sw_import_"+$2+" = ";
		});//.replace(/\\\n/g, '');
		
		log("collected config variables = "+collected);
		
		collected = eval(data+"\n["+collected+"];");
		data = ct = null;

		var has_last_page_flag = (collected.length==14) ? 1 : 0;
		if (!has_last_page_flag && (collected.length!=13)) {
			alert("Invalid collected data!");
			document.body.style.cursor= "auto";
			return false;
		}
		
		old_block_edits = !collected[2];
		
		__config.dblclick_edit = collected[3];
		
		__config.save_on_quit = collected[4];
		
		if (has_last_page_flag)
			__config.open_last_page = collected[5];
		__config.allow_diff = collected[5+has_last_page_flag];
		
		__config.key_cache = collected[6+has_last_page_flag];
		
		new_main_page = collected[8+has_last_page_flag];
		
		page_names = collected[10+has_last_page_flag];
		
		old_page_attrs = collected[11+has_last_page_flag];
		
		page_contents = collected[12+has_last_page_flag];
		
		collected = null;
	} else {	// we are importing from v0.9.2 and above which has a __config object for all the config flags
		var collected = [];
		
		// rename the variables
		data = data.replace(/([^\\])\nvar (\w+) = /g, function (str, $1, $2) {
			collected.push('sw_import_'+$2);
			return $1+"\nvar sw_import_"+$2+" = ";
		});//.replace(/\\\n/g, '');
		
		log("collected config variables = "+collected);
		
		collected = eval(data+"\n["+collected+"];");
		data = ct = null;

		if (collected.length!=9) {
			alert("Invalid collected data!");
			document.body.style.cursor= "auto";
			return false;
		} collected = null;
		
		__config = sw_import___config;
		
		__config["server_mode"] = false;
		
		if (old_version==94) {
			__config["auto_save"] = 5 * 60 * 1000;
			__config["cumulative_save"] = false;
		}
		
		current = sw_import_current;
		
		new_main_page = sw_import_main_page;
		
		page_names = sw_import_page_titles;
		
		old_page_attrs = sw_import_page_attrs;
		
		page_contents = sw_import_pages;
		
		// replace the pre tags with the new nowiki syntax
		if (old_version==92) {
			for(var i=0;i<page_contents.length;i++) {
				// page is encrypted, leave it as is
				if (page_attrs[i] & 2)
					continue;
				page_contents[i] = page_contents[i].replace(/<pre(.*?)>((.|\n)*?)<\/pre>/g,
								function (str, $1, $2) {
									var s="{{{"+$2+"}}}";
									if ($1.length)
										s = "<span"+$1+">"+s+"</span>";
									return s;
								});
			}
		}
	}
}

	// add new data
	var pages_imported = 0;
	for(var i=0; i<page_names.length; i++)
	{
		if ( !is_reserved(page_names[i]))
		{
			pi = page_index(page_names[i]);
			if (pi == -1) {
				page_titles.push(page_names[i]);
				pages.push(page_contents[i]);
				page_attrs.push( old_page_attrs[i] );
			} else {
				page_titles[pi] = page_names[i];
				if (old_version==94) {
					// convert embedded files to base64 encoding
					if (old_page_attrs[i] & 4)
						pages[pi] = page_contents[i];
					else
						pages[pi] = b64_encode(split_bytes(page_contents[i]));
				} else
					pages[pi] = page_contents[i];
				page_attrs[pi] = old_page_attrs[i];
			}
			pages_imported++;
		} else { // special pages
			if (old_version==94) {
				if (page_names[i]=="Special::Bootscript") {
					page_titles.push("Special::Bootscript");
					pages.push(page_contents[i]);
					page_attrs.push(4);
				}
			}
		}
	}
	
	if (page_exists(new_main_page))
		main_page = new_main_page;

	__config.permit_edits = !old_block_edits;

	// remove hourglass
	document.body.style.cursor= "auto";
	
	alert("Import completed: " + pages_imported + " pages imported.");
	
	current = main_page;
	// save everything
	save_to_file(true);
	
	refresh_menu_area();
	set_current(main_page);
}

function open_table_help() {
	var w = _create_centered_popup("help", 350, 200, ",menubar=no,toolbar=no,location=no,status=no,dialog=yes");
	w.document.writeln("<html><head><title>Building tables<\/title><\/head><body>");
	w.document.writeln("<u>Building tables:<\/u><br /><br />");
	w.document.writeln("<tt>{|   <\/tt><br />");
	w.document.writeln("<tt>|+ Table Caption<\/tt><br />");
	w.document.writeln("<tt>| *colum 1* || *column 2* || *column 3*<\/tt><br />");
	w.document.writeln("<tt>|-<\/tt><br />");
	w.document.writeln("<tt>| line 2 || [[a link]] || something<\/tt><br />");
	w.document.writeln("<tt>|-<\/tt><br />");
	w.document.writeln("<tt>| line 3 || || more stuff<\/tt><br />");
	w.document.writeln("<tt>|}   <\/tt>");
	w.document.writeln("<\/body><\/html>");
	w.document.close();
}

/*** aes.js ***/

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
			log('UTF-8: invalid first byte');
			return null;
		}
	    for (var n=1;n<k;n++){
	      d = bData[i++];
	      if (d<0x80||d>0xBF) break;
	      c=(c<<6)+(d&0x3F);
	    }
	    if ( (k==2&&c<0x80) || (k>2&&c<utf8sets[k-3]) ) {
			log("UTF-8: invalid sequence");
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

// used to embed images
function b64_encode(bData) {
	var sData="", z=bData.length, i=0, tot=z;
	while (i<z){
		var x = [ bData[i]>>2, (bData[i]&3)<<4, 64, 64 ];
		if (++i<tot){x[1]+=(bData[i]&240)>>4;x[2]=(bData[i]&15)<<2;}
		if (++i<tot){x[2]+=(bData[i]&192)>>6;x[3]=bData[i]&63;}
		for (j=0;j<4;j++){
			var y=x[j];
		    sData += String.fromCharCode(y<26?65+y:y<52?71+y:y<62?y-4:y<63?43:y<64?47:61);
		}
		i++;
	}
	return sData;
}

// used to export images
function b64_decode(sData, z){
	var x = new Array(4);
	var tot=sData.length;
	if (!z) z = tot;
	var bData=[], i=0;
	while (i<z) {
		for (var k=0;k<4;k++){
		var c=0; while (c<33&&i<z){ c=sData.charCodeAt(i++); }
		if (c<33){
			if (k!=0) throw( "Base64: unexpected #chars." );
			return;
		}
		x[k] = c==43?62:c==47?63:c==61?64:c>47&&c<58?c+4:c>64&&c<91?c-65:c>96&&c<123?c-71:-1;
		if (x[k]<0||(x[k]==64&&k<2)) throw( "Base64: "+unExpChar(c)
			+"\nAllowed characters regex range is [A-Za-z0-9\\+\\-=]"  );
		}
	    bData.push( (x[0]<<2)+(x[1]>>4) );
	    if (x[2]<64) bData.push( ((x[1]&15)<<4)+(x[2]>>2) );
	    if (x[3]<64) bData.push( ((x[2]&3)<<6)+x[3] );
	}
	return bData;
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
    //if (cbc)
	{
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

/* ]]> */