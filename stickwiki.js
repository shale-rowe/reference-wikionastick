/* <![CDATA[ */
/*** stickwiki.js ***/

// page attributes bits are mapped to (readonly, encrypted, ...)

var debug = true;			// toggle debug mode (and console)
var save_override = true;	// allow to save when debug mode is active
var end_trim = true;		// trim pages from the end

var forstack = new Array();
var cached_search = "";
var cfg_changed = false;	// true when configuration has been changed
var search_focused = false;
var _custom_focus = false;
var prev_title = current;	// used when entering/exiting edit mode
var decrypt_failed = false;
var result_pages;
var last_AES_page;
var current_namespace = "";
var post_dom_render = "";

var ie = false;
var ie6 = false;
var firefox = false;
var opera = false;
//var unsupported_browser = true;

// Returns element by ID
function el(name)
{
	return document.getElementById(name);
}

// fixes the Array prototype for older browsers
if (typeof Array.prototype.push == "undefined") {
  Array.prototype.push = function(str) {
    this[this.length] = str;
  }
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

function page_index(page) {
	return page_titles.indexOf(page);
}

var edit_override = true;

var reserved_namespaces = [
"Special", "Lock", "Locked", "Unlocked", "Unlock", "Tag", "Tagged", "Image", "File"];

var reserved_rx = "^";
var i = (edit_override ? 1 : 0);
for(;i<reserved_namespaces.length;i++) {
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

function str_rep(s, n) {
  var r = "";
   while (--n >= 0) r += s;
   return r;
}

function _rand(scale) {
	return Math.floor(Math.random() * scale);
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

var parse_marker = "#"+_random_string(8);

function _get_tags(text) {
	var tags = new Array();
	if (text.indexOf("Tag::")==0) {
		tags.push(text.substring(5));
	} else if (text.indexOf("Tags::")==0) {
		var alltags = text.substring(6).split(",");
		for(var i=0;i<alltags.length;i++) {
			tags.push(alltags[i].replace(/^\s/g, "").replace(/\s$/g, ""));
		}
	}
	return tags;
}

function header_anchor(s) {
	return escape(s).replace(/%20/g, "_");
}

var has_toc;
var page_TOC = "";
//var last_h_level;
var reParseHeaders = /(^|\n)(\!+)\s*([^\n]+)/g;
function header_replace(str, $1, $2, $3) {
		var header = $3;
		var len = $2.length;
		if (header.indexOf($2)==header.length - len)
			header = header.substring(0, header.length - len);
//		log("h"+len+" = "+header);
		// automatically build the TOC if needed
		if (has_toc) {
			page_TOC += str_rep("#", len)+" [[#"+header+"]]\n";
		}
		return "</div><a name=\""+header_anchor(header)+"\"></a><h"+len+">"+header+"</h"+len+"><div class=\"level"+len+"\">";
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


// single quote escaping for page titles	
function _sq_esc(s) {
	return s.replace(/'/g, "\\'");
}

// used not to break layout when presenting search results
var force_inline = false;

// Parse typed code into HTML - allows overriding
var parse = function(text) {
	if (text == null) {
		log("text = null while parsing current page \""+current+"\"");
		return;
	} //else		log("typeof(text) = "+typeof(text));

	// thank you IE, really thank you
	if (ie)
		text = text.replace("\r\n", "\n");

	var prefmt = [];
	var tags = [];
	var html_tags = [];
	var script_tags = [];
	
	var p = text.indexOf("[[Special::TOC]]");
	if (p != -1) {
		has_toc = true;
		text = text.substring(0, p) + "<!-- "+parse_marker+":TOC -->" + text.substring(p+16
//		+ 	((text.charAt(p+16)=="\n") ? 1 : 0)
		);	
//		last_h_level = 0;
	} else has_toc = false;

	// gather all script tags
	text = text.replace(/<script[^>]*>((.|\n)*?)<\/script>/gi, function (str, $1) {
		script_tags.push($1);
		return "";
	});

	// put away stuff contained in <pre> tags
	text = text.replace(/(\<pre.*?>(.|\n)*?<\/pre>)/g, function (str, $1) {
		var r = "<!-- "+parse_marker+prefmt.length+" -->";
		prefmt.push($1);
		return r;
	});
	
	// put away big enough HTML tags (with attributes)
	text = text.replace(/\<\w+\s[^>]+>/g, function (tag) {
		var r = "<!-- "+parse_marker+'::'+html_tags.length+" -->";
		html_tags.push(tag);
		return r;
	});
	
	// allow non-wrapping newlines
	text = text.replace(/\\\n/g, "");
	
	// <u>
	text = text.replace(/(^|[^\w])_([^_]+)_/g, "$1"+parse_marker+"uS#$2"+parse_marker+"uE#");
	
	// italics
	text = text.replace(/(^|[^\w])\/([^\/]+)\/($|[^\w])/g, function (str, $1, $2, $3) {
		if (str.indexOf("//")!=-1) {
			return str;
		}
		return $1+"<em>"+$2+"</em>"+$3;
	});
	
	// ordered/unordered lists parsing (code by plumloco)
	text = text.replace(reReapLists, parseList);
	
	// headers (from h1 to h6, as defined by the HTML 3.2 standard)
	text = text.replace(reParseHeaders, header_replace);
	
	// cleanup \n after headers
	text = text.replace(/(<\/h[1-6]><div class="level[1-6]">)\n/g, "$1");
	
	if (has_toc) {
		text = text.replace("<!-- "+parse_marker+":TOC -->", "<div class=\"wiki_toc\"><p class=\"wiki_toc_title\">Table of Contents</p>" + page_TOC.replace(reReapLists, parseList)
		.replace("\n<", "<") + "</div>" );
		page_TOC = "";
	}
	
	// <b>
	text = text.replace(/\*([^\*\n]+)\*/g, parse_marker+"bS#$1"+parse_marker+"bE#");

	// <strike>
	//text = text.replace(/(^|\n|\s|\>|\*)\-(.*?)\-/g, "$1<strike>$2<\/strike>");
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

	// <hr>
	text = text.replace(/(^|\n)\-\-\-/g, "<hr />");
	
    text = text.replace(reReapTables, parseTables);

	// links with | 
	text = text.replace(/\[\[([^\]\]]*?)\|(.*?)\]\]/g, function(str, $1, $2)
			{
				if($1.indexOf("://")!=-1)
					return "<a class=\"world\" href=\"" + $1 + "\" target=\"_blank\">" + $2 + "<\/a>";
				
				if(page_exists($1))
					return "<a class=\"link\" onclick='go_to(\"" + _sq_esc($1) +"\")'>" + $2 + "<\/a>";
				else {
					if ($1.charAt(0)=="#")
						return "<a class=\"link\" href=\"#" + header_anchor($1.substring(1)) + "\">" + $2 + "<\/a>";
					else
						return "<a class=\"unlink\" onclick='go_to(\"" + _sq_esc($1) +"\")'>" + $2 + "<\/a>";
				}
			}); //"<a class=\"wiki\" onclick='go_to(\"$2\")'>$1<\/a>");
	// links without |
	var inline_tags = 0;
	text = text.replace(/\[\[([^\|]*?)\]\]/g, function(str, $1)
			{
				if($1.match("://"))
					return "<a class=\"world\" href=\"" + $1 + "\" target=\"_blank\">" + $1 + "<\/a>";
					
				found_tags = _get_tags($1);
				
				if (found_tags.length>0) {
					tags = tags.concat(found_tags);
					if (!force_inline)
						return "";
					inline_tags++;
					return "<!-- "+parse_marker+":"+inline_tags+" -->";
				}
				
				if(page_exists($1))
					return "<a class=\"link\" onclick=\"go_to('" + _sq_esc($1) +"')\">" + $1 + "<\/a>";
				else {
					if ($1.charAt(0)=="#")
						return "<a class=\"link\" href=\"#" + header_anchor($1.substring(1)) + "\">" + $1.substring(1) + "<\/a>";
					return "<a class=\"unlink\" onclick=\"go_to('" + _sq_esc($1) +"')\">" + $1 + "<\/a>";
				}
					}); //"<a class=\"wiki\" onclick='go_to(\"$1\")'>$1<\/a>");

	// end-trim
	if (end_trim)
		text = text.replace(/[\n\s]*$/, "");

	// compress newlines characters into paragraphs (disabled)
//	text = text.replace(/\n(\n+)/g, "<p>$1</p>");
//	text = text.replace(/\n(\n*)\n/g, "<p>$1</p>");
		
	// convert newlines to br tags
	text = text.replace(/\n/g, "<br />");

	if (prefmt.length>0) {
//		log("Replacing "+prefmt.length+" preformatted blocks");
		text = text.replace(new RegExp("<\\!-- "+parse_marker+"(\\d+) -->", "g"), function (str, $1) {
//			log("Replacing prefmt block #"+$1);
			return prefmt[$1];
		});
		// make some newlines cleanup - disabled
		text = text.replace(/(<br \/>)?(<\/?pre>)(<br \/>)?/gi, "$2");
	}
	
	if (html_tags.length>0) {
		text = text.replace(new RegExp("<\\!-- "+parse_marker+"::(\\d+) -->", "g"), function (str, $1) {
			return html_tags[$1];
		});
	}

	if (tags.length) {
		if (force_inline)
			s = "";
		else
			s = "<div class=\"taglinks\">";
		s += "Tags: ";
		for(var i=0;i<tags.length-1;i++) {
			s+="<a class=\"link tag\" onclick=\"go_to('Tagged::"+_sq_esc(tags[i])+"')\">"+tags[i]+"</a>&nbsp;&nbsp;";
		}
		if (tags.length>0)
			s+="<a class=\"link tag\" onclick=\"go_to('Tagged::"+_sq_esc(tags[tags.length-1])+"')\">"+tags[tags.length-1]+"</a>";
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
		
	if (script_tags.length)
		post_dom_render = script_tags.join("\n");
	
	if (text.substring(0,5)!="</div")
		return "<div class=\"level0\">" + text + "</div>";
	return text.substring(6)+"</div>";
}

// prepends and appends a newline character to workaround plumloco's XHTML lists parsing bug
function _join_list(arr) {
	if (!arr.length)
		return "";
	result_pages = arr.slice(0);
	return "\n* [["+arr.sort().join("]]\n* [[")+"]]\n";
}

function _simple_join_list(arr, sorted) {
	if (sorted)
		arr = arr.sort();
	return arr.join("\n")+"\n";
}

// with two trailing double colon
function _get_namespace_pages(ns) {
	var pg = new Array();
	switch (ns) {
		case "Locked::":
			return "!Pages in "+ns+" namespace\n" + special_encrypted_pages(true);
		case "Unlocked::":
			return "!Pages in "+ns+" namespace\n" + special_encrypted_pages(false);
	}

	for(var i=0;i<page_titles.length;i++) {
		if (page_titles[i].indexOf(ns)==0)
			pg.push( page_titles[i]);
	}
	return "!Pages in "+ns+" namespace\n" + _join_list(pg);
}

function _get_tagged(tag) {
	var pg = new Array();

	var tmp;
	for(var i=0; i<pages.length; i++)
	{
		tmp = get_page(i);
		if (tmp==null)
			continue;
		tmp.replace(/\[\[([^\|]*?)\]\]/g, function(str, $1)
			{
				if($1.match("://"))
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
	return "!Pages tagged with " + tag + "\n" + _join_list(pg);
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
	var pg_body = new Array();
	var title_result = "";

	var count = 0;
	// matches the search string and nearby text
	var reg = new RegExp( ".*?" + RegExp.escape(str).
					replace(/^\s+/, "").
					replace(/\s+$/, "").
					replace(/\s+/g, ".*?") + ".*", "gi" );
					
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
			
		tmp = get_page(i);
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
			count = res_body.length;
			res_body = res_body.join(" ").replace( /\n/g, " ");
			pg_body.push( "* [[" + page_titles[i] + "]]: found *" + count + "* times :<div class=\"search_results\"><i>...</i><br />" + res_body +"<br/><i>...</i></div>");
			if (!added)
				result_pages.push(page_titles[i]);
		}
	}
	
	if (!pg_body.length && !title_result.length)
		return "No results found for *"+str+"*";
	force_inline = true;
	return "Results for *" + str + "*\n" + title_result + "\n\n---\n" + _simple_join_list(pg_body, false);
}

// Returns a index of all pages
function special_all_pages()
{
	var pg = new Array();
	var text = "";
	for(var i=0; i<page_titles.length; i++)
	{
		if (!is_reserved(page_titles[i]))
			pg.push( page_titles[i] );
	}
	return _join_list(pg);
}

// Returns a index of all dead pages
function special_dead_pages () {
	var dead_pages = new Array();
	var from_pages = new Array();
	var page_done = false;
	var tmp;
	for (j=0;j<pages.length;j++) {
		tmp = get_page(j);
		if (tmp==null)
			continue;
		tmp.replace(/\[\[([^\]\]]*?)(\|([^\]\]]+))?\]\]/g,
			function (str, $1, $2, $3) {
				if (page_done)
					return false;
//				log("In "+page_titles[j]+": "+$1+" -> "+$3);
				if ($1.charAt(0)=="#")
					return;
				if ($1.indexOf("://")!=-1)
					return;
				if ($1.match(/Tag(s|ged)?:/gi))
					return;
				p = $1;
				if (!page_exists(p) && ((up = p.toUpperCase)!=page_titles[j].toUpperCase())) {
//					up = p.toUpperCase();
					for(var i=0;i<dead_pages.length;i++) {
						if (dead_pages[i].toUpperCase()==up) {
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

	var pg = new Array();
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
	return '<i>No dead pages</i>';
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
	var pg = new Array();
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
				tmp = get_page(i);
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
	var pg = new Array();
	var tmp;
	var reg = new RegExp("\\[\\["+RegExp.escape(current)+"(\\||\\]\\])", "gi");
	for(j=0; j<pages.length; j++)
	{
		// search for pages that link to it
		tmp = get_page(j);
		if (tmp==null)
			continue;
		if (tmp.match(reg)) {
			pg.push( page_titles[j] );
		}
	}
	if(pg.length == 0)
		return "/No page links here/";
	else
		return "!!Links to "+current+"\n"+_join_list(pg);
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

// return a plain page or a decrypted one if available through the latest key
function get_page(pi) {
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
	decrypt_failed = true;
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
		decrypt_failed = false;
		if (!key_cache)
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
	text = _new_syntax_patch(text);
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
	log("_create_page("+ns+",...)");
	if (is_reserved(ns)) {
		alert("You are not allowed to create a page titled \""+ns+cr+"\" because namespace \""+ns+"\" is reserved");
			return false;
		}
	if (ask && !confirm("Page not found. Do you want to create it?"))
		return false;
	// create and edit the new page
	if (ns.length)
		cr = ns+"::"+cr;
	if (cr!="Menu")
		pages.push("!"+cr+"\n");
	else
		pages.push("\n");
	page_attrs.push(0);
	page_titles.push(cr);
	current = cr;
//	log("Now pages list is: "+page_titles);
//	save_page(cr);	// do not save
	edit_page(cr);
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
		default:
			text = get_text("Special::"+cr);
			if(text == null) {
				if (edit_override) {
					_create_page("Special", cr, true);
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
					case "Tagged":
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
						if (decrypt_failed) {
							decrypt_failed = false;
							return;
						}
						pages[pi] = text;
						page_attrs[pi] -= 2;
						if (!key_cache)
							AES_clearKey();
						set_current(cr);
						save_page(cr);
						return;
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
		if (decrypt_failed) {
			decrypt_failed = false;
			return;
		}
		if (!_create_page(namespace, cr, true))
			return;
	}
	
	_add_namespace_menu(namespace);
	if (namespace.length)
		cr = namespace + "::" + cr;
	load_as_current(cr, text);
}

var swcs = null;

function _clear_swcs() {
//	setHTML(swcs, "");
	if (swcs == null) return;
	document.getElementsByTagName("head")[0].removeChild(swcs);
	swcs = null;
}

function load_as_current(title, text) {
	scrollTo(0,0);
	log("CURRENT loaded: "+title+", "+text.length+" bytes");
	el("wiki_title").innerHTML = title;
	el("wiki_text").innerHTML = parse(text);
	document.title = title;
	update_nav_icons(title);
	current = title;
	// add the custom script (if any)
	if (post_dom_render!="") {
		log("Executing "+post_dom_render.length+" bytes of custom javascript");
//		eval(post_dom_render);
		swcs = document.createElement("script");
		swcs.type="text/javascript";
		swcs.id = "sw_custom_script";
		document.getElementsByTagName("head")[0].appendChild(swcs);
		setHTML(swcs, post_dom_render);
	}
//	setHTML(swcs, post_dom_render);
	post_dom_render = "";
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
	if (!key_cache) {
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

	// from http://lxr.mozilla.org/seamonkey/source/security/manager/pki/resources/content/password.js
	// Here is how we weigh the quality of the password
	// number of characters
	// numbers
	// non-alpha-numeric chars
	// upper and lower case characters
	var pw=el('pw1').value;

	//length of the password
	var pwlength=pw.length;
	
	if (pwlength!=0) {

	//use of numbers in the password
	  var numnumeric = pw.replace (/[0-9]/g, "");
	  var numeric=numnumeric.length/pwlength;

	//use of symbols in the password
	  var symbols = pw.replace (/\W/g, "");
	  var numsymbols= symbols.length/pwlength;

	//use of uppercase in the password
	  var numupper = pw.replace (/[A-Z]/g, "");
	  var upper=numupper.length/pwlength;
	  // end of modified code from Mozilla

	//   var pwstrength=((pwlength*10)-20) + (numeric*10) + (numsymbols*15) + (upper*10);
	  
		// 80% of security defined by length (at least 16, best 22 chars), 10% by symbols, 5% by numeric presence and 5% by upper case presence
		var pwstrength = ((pwlength/18) * 80) + (numsymbols * 10 + upper*5 + numeric*5);
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
	else
		el("menu_area").innerHTML = parse(menu);
}

function _gen_display(id, visible, prefix) {
	if (visible)
		elShow(prefix+"_"+id);
	else
		elHide(prefix+"_"+id);
}

function elHide(id) {
	el(id).style.display = "none";
	el(id).style.visibility = "hidden";
}

function elShow(id) {
	el(id).style.display = "inline";
	el(id).style.visibility = "visible";
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

// save configuration on exit
function before_quit() {
	if (save_on_quit && cfg_changed)
		save_to_file(false);
	return true;
}

var setHTML;

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
		var obj = el("sw_wiki_header");
		obj.style.filter = "alpha(opacity=75);";
		if (ie6) {
			el("sw_wiki_header").style.position = "absolute";
			el("sw_menu_area").style.position = "absolute";
		}
	} else {
		setHTML = function(elem, html) {elem.innerHTML = html;};
//		setup_uri_pics(el("img_home"),el("img_back"),el("img_forward"),el("img_edit"),el("img_cancel"),el("img_save"),el("img_advanced"));
	}

	img_display("back", true);
	img_display("forward", true);
	img_display("home", true);
	img_display("edit", true);
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
}

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
			can_lock = !can_unlock && permit_edits;
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
	menu_display("save", false);
	menu_display("cancel", false);
	elShow("text_area");
	elHide("edit_area");
//	log("setting back title to "+prev_title);
	document.title = el("wiki_title").innerHTML = prev_title;
}

function menu_dblclick() {
	if (!dblclick_edit)
		return false;
	edit_menu();
	return true;
}

function ns_menu_dblclick() {
	if (!dblclick_edit)
		return false;
	edit_ns_menu();
	return true;
}

function page_dblclick() {
	if (!dblclick_edit)
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
	if (!permit_edits)
		return false;
	if (is_reserved(page))
		return false;
	return !is_readonly(page);
}

// setup the title boxes and gets ready to edit text
function current_editing(page, disabled) {
	scrollTo(0,0);
	log("CURRENT editing "+page+", title disabled: "+disabled);
	prev_title = current;
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
	menu_display("save", true);
	menu_display("cancel", true);
	update_lock_icons(page);
	elHide("text_area");

	// FIXME!
	if(!ie)	{
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
	if (prev_title == previous)
		prev_title = newpage;
	return true;
}

// when a page is deleted
function delete_page(page)
{
	for(var i=0; i<pages.length; i++)
	{
		if(page_titles[i].toUpperCase() == page.toUpperCase())
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
	//BUG: will also modify text contained in <pre> tags
	text = text.replace(/(^|\n)(\+*)([ \t])/g, function (str, $1, $2, $3) {
		return $1+str_rep("*", $2.length)+$3;
	});
	
	return text;
}

// when save is clicked
function save()
{
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
					back_to = prev_title;
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
	forstack = new Array();
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
	save_to_file(true);
}

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

function save_to_file(full) {
	document.body.style.cursor = "wait";
	
	var new_marker;
	if (!debug && full)
		new_marker = _random_string(18);
	else new_marker = __marker;
	
	// setup the page to be opened on next start
	var safe_current;
	if (open_last_page) {
		if (!page_exists(current)) {
			safe_current = main_page;
		} else safe_current = current;
	} else
		safe_current = main_page;

	var computed_js = "\n/* <![CDATA[ */\n\n/* "+new_marker+"-START */\n\nvar version = \""+version+
	"\";\n\nvar __marker = \""+new_marker+
	"\";\n\nvar permit_edits = "+permit_edits+
	";\n\nvar dblclick_edit = "+dblclick_edit+
	";\n\nvar save_on_quit = "+save_on_quit+
	";\n\nvar open_last_page = "+open_last_page+
	";\n\nvar allow_diff = "+allow_diff+
	";\n\nvar key_cache = "+key_cache+
	";\n\nvar current = '" + js_encode(safe_current)+
	"';\n\nvar main_page = '" + js_encode(main_page) + "';\n\n";
	
	computed_js += "var backstack = [\n" + printout_arr(backstack, false) + "];\n\n";

	computed_js += "var page_titles = [\n" + printout_arr(page_titles, false) + "];\n\n";
	
	computed_js += "/* " + new_marker + "-DATA */\n";
	
	if (full) {
		computed_js += "var page_attrs = [" + printout_num_arr(page_attrs) + "];\n\n";
		
		computed_js += "var pages = [\n" + printout_mixed_arr(pages, allow_diff, page_attrs) + "];\n\n";
		
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
		var p_h, p_oy;
		el("alt_back").innerHTML = "";
		el("alt_forward").innerHTML = "";
		el("alt_cancel").innerHTML = "";
	} else {
//		free_uri_pics(el("img_home"),el("img_back"),el("img_forward"),el("img_edit"),el("img_cancel"),el("img_save"),el("img_advanced"))
	}

	_clear_swcs();
	
	var data = _get_data(__marker, document.documentElement.innerHTML, full);

	if ( (!debug || save_override) )
		r = _saveThisFile(computed_js, data);
	else r = false;
	
	if (ie) {
		create_alt_buttons();
	}
//	else		setup_uri_pics(el("img_home"),el("img_back"),el("img_forward"),el("img_edit"),el("img_cancel"),el("img_save"),el("img_advanced"))

	if (r) {
		cfg_changed = false;
	}
	
	el("wiki_editor").value = bak_ed;
	el("wiki_text").innerHTML = bak_tx;
	el("menu_area").innerHTML = bak_mn;
	
	document.body.style.cursor= "auto";

	return r;
}

/*** loadsave.js ***/
function _saveThisFile(new_data, old_data)
{
/*	if(unsupported_browser)
	{
		alert("This browser is not supported and your changes won't be saved on disk.");
		return false;
	}	*/
	var filename = unescape(document.location.toString().split("?")[0]);
	filename = filename.replace("file:///", "");
	filename = filename.replace(/#.*/g, "");
	if(navigator.appVersion.indexOf("Win")!=-1)
		filename = filename.replace(/\//g, "\\");
	else
		filename = "/" + filename;
	
	r = saveFile(filename,
	"<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">\n<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\">\n<head>\n<script type=\"text/javascript\">" + new_data + "\n" + old_data + "</html>");
	if (r==true)
		log("\""+filename+"\" saved successfully");
	else
		alert("Save to file "+filename+" failed!\n\nMaybe your browser is not supported");
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
	var file = fso.OpenTextFile(filePath,2,-1,0);
	file.Write(content);
	file.Close();
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
			return(sInputStream.read(sInputStream.available()));
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
	if(confirm("This will ERASE all your pages.\n\nAre you sure you want to continue?") == false)
		return false;
	var static_pg = ["Special::About", "Special::Advanced", "Special::Options","Special::Import",
						"Special::Lock","Special::Search","Special::Security"];
	var backup_pages = [];
	page_attrs = [];
	for(var i=0;i<static_pg.length;i++) {
		var pi = page_index(static_pg[i]);
		if (pi==-1) {
			alert(static_pg[i]+" not found!");
			return false;
		}
		backup_pages.push(pages[pi]);
		page_attrs.push(0);
	}
	page_attrs.push(0); page_attrs.push(0);
	page_titles = ["Main Page", "::Menu"];
	page_titles = page_titles.concat(static_pg);
	pages = ["This is your empty main page", "[[Main Page]]\n\n[[Special::New page]]\n[[Special::Backlinks]]\n[[Special::Search]]"];
	pages = pages.concat(backup_pages);
	current = main_page = "Main Page";
	refresh_menu_area();
	backstack = new Array();
	forstack = new Array();	
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
		return;

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
		var ver_str = ct.match(/var version = "([^"]*)";\n/);
		if (ver_str && ver_str.length) {
			ver_str = ver_str[1];
			switch (ver_str) {
				case "0.9B":
				case "0.9":
					old_version = 9;
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
	var old_block_edits = !permit_edits;
	var page_names = new Array();
	var page_contents = new Array();
	var old_page_attrs = new Array();
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
	var var_names = new Array();
	var var_values = new Array();
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
}	else {

	try {
		var old_marker = ct.match(/\nvar __marker = "([A-Za-z\-\d]+)";\n/)[1];
	} catch (e) {
		alert("Marker not found!");
		document.body.style.cursor= "auto";
		return false;
	}

	// import from versions 0.9 and above
	var css = null;
	ct.replace(/<style\s.*?type="?text\/css"?[^>]*>((\n|.)*?)<\/style>/i, function (str, $1) {
		css = $1;
	});
	if (css!=null) {
		log("Imported "+css.length+" bytes of CSS");
		setHTML(document.getElementsByTagName("style")[0], css);
	}

	var data = _get_data(old_marker, ct, true, true);
	var collected = [];
	
	// rename the variables
	data = data.replace(/([^\\])\nvar (\w+) = /g, function (str, $1, $2) {
		collected.push('sw_import_'+$2);
		return $1+"\nvar sw_import_"+$2+" = ";
	});//.replace(/\\\n/g, '');
	
	log("collected = "+collected);
	
	collected = eval(data+"\n["+collected+"];");
	data = ct = null;

	if (collected.length!=13) {
		alert("Invalid collected data!");
		document.body.style.cursor= "auto";
		return false;
	}
	
	old_block_edits = !collected[2];
	
	dblclick_edit = collected[3];
	
	save_on_quit = collected[4];
	
sw_import_allow_diff,sw_import_key_cache,sw_import_current,sw_import_main_page,sw_import_backstack,sw_import_page_titles,sw_import_page_attrs,sw_import_pages

	allow_diff = collected[5];
	
	key_cache = collected[6];
	
	new_main_page = collected[8];
	
	page_names = collected[10];
	
	old_page_attrs = collected[11];
	
	page_contents = collected[12];
	
	collected = null;
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
				pages[pi] = page_contents[i];
				page_attrs[pi] = old_page_attrs[i];
			}
			pages_imported++;
		}
	}
	
	if (page_exists(new_main_page))
		main_page = new_main_page;

	permit_edits = !old_block_edits;

	// remove hourglass
	document.body.style.cursor= "auto";
	
	alert("Import completed: " + pages_imported + " pages imported.");
	
	current = main_page;
	// save everything
	save_to_file(true);
	
	refresh_menu_area();
	set_current(main_page);
}

function open_table_help()
{
	w = window.open("about:blank", "help", "height=200px, width=350px, menubar=no, toolbar=no, location=no, status=no, dialog=yes");
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

/* if((navigator.userAgent).indexOf("Opera")!=-1)
	opera = true;
else */ if(navigator.appName == "Netscape")
	firefox = true;
else if((navigator.appName).indexOf("Microsoft")!=-1) {
	ie = true;
	ie6 = (navigator.userAgent.search(/msie 6\./i)!=-1);
}

// finds out if Opera is trying to look like Mozilla
if(firefox == true && navigator.product != "Gecko")
	firefox = false;

// finds out if Opera is trying to look like IE
if(ie == true && navigator.userAgent.indexOf("Opera") != -1)
	ie = false;

var log;
if (debug) {
	// logging function - used in development

	log = function (aMessage)
	{
	    var logbox = el("swlogger");
		nls = logbox.value.match(new RegExp("\n", "g"));
		if (nls!=null && typeof(nls)=='object' && nls.length>11)
			logbox.value = "";
		logbox.value += aMessage + "\n";
	};
} else {
	log = function(aMessage) { };
}

if (!ie)
	window.onresize = on_resize;

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
var utf8mf = true;

var wMax = 0xFFFFFFFF;
function rotb(b,n){ return ( b<<n | b>>>( 8-n) ) & 0xFF; }
function rotw(w,n){ return ( w<<n | w>>>(32-n) ) & wMax; }
function getW(a,i){ return a[i]|a[i+1]<<8|a[i+2]<<16|a[i+3]<<24; }
function setW(a,i,w){ a.splice(i,4,w&0xFF,(w>>>8)&0xFF,(w>>>16)&0xFF,(w>>>24)&0xFF); }
function setWInv(a,i,w){ a.splice(i,4,(w>>>24)&0xFF,(w>>>16)&0xFF,(w>>>8)&0xFF,w&0xFF); }
function getB(x,n){ return (x>>>(n*8))&0xFF; }

if (utf8mf) {
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
} else { // no utf8
	
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
             rotw(table[(block[inc[m]]>>>8)&0xFF], 8)^
             rotw(table[(block[inc[m+1]]>>>16)&0xFF], 16)^
             rotw(table[(block[inc[m+2]]>>>24)&0xFF], 24);
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
  if (utf8mf) {
	key = utf8Encrypt(sKey);
  } else {
	key = split_bytes(sKey);
  }
}

function AES_clearKey() {
	key = [];
}

var legocheck = false;

// returns an array of encrypted characters
function AES_encrypt(raw_data) {
	if (legocheck) {
		/* legolas558's random marker pattern */
		var ew, sw;
		if (bData.length % 2) {
			ew = _rand(0xFFFFFFFF);
			sw = ew ^ bData.length;
			if (!(sw % 2))
				sw++;
			if (ew % 2)
				ew++;
		} else {
			sw = _rand(0xFFFFFFFF);
			ew = sw ^ bData.length;
			if (!(ew % 2))
				ew++;
			if (sw % 2)
				sw++;
		}
		bData = bData.concat([0,0,0,0], bData);
		setW(bData, 0, sw);
		setW(bData, bData.length, ew);
	}
	
	if (utf8mf) {
		bData = utf8Encrypt(raw_data);
	} else
		bData = split_bytes(d);
	
	aes_i=tot=0;
	do{ blcEncrypt(aesEncrypt); } while (aes_i<tot);
	
	return bData;
}

// decrypts an array of encrypted characters
function AES_decrypt(raw_data) {
	bData = raw_data;
	
	aes_i=tot=0;
	do{ blcDecrypt(aesDecrypt); } while (aes_i<tot);
	
	if (legocheck) {
		var sw = getW(bData, 0);
		var sw = getW(bData, bData.length-4);
		var len = bData.length-8;
		if (len % 2) {
			sw = ew ^ bData.length;
			if (!(sw % 2))
				return null;
			if (ew % 2)
				return null;
		} else {
			sw = _rand(0xFFFFFFFF);
			ew = sw ^ len;
			if (!(ew % 2))
				return null;
			if (sw % 2)
				return null;
		}
		bData.splice(len-4, 4);
		bData.splice(0, 4);
	}

	if (utf8mf) {
		sData = utf8Decrypt(bData);
	} else
		sData = merge_bytes(d);
	bData = [];
	return sData;
}

/* ]]> */