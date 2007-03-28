/* <![CDATA[ */
/*** stickwiki.js ***/

// page attributes are mapped to (readonly, encrypted, ...)

var debug = true;			// toggle debug mode (and console)
var save_override = true;	// allow to save when debug mode is active
var end_trim = true;		// trim pages from the end

var forstack = new Array();
var cached_search = "";
var cfg_changed = false;	// true when configuration has been changed
var search_focused = false;
var prev_title = current;	// used when entering/exiting edit mode
var decrypt_failed = false;

// Browser
var ie = false;
var firefox = false;
var opera = false;
var unsupported_browser = true;

// Returns the element by ID
function el(name)
{
	return document.getElementById(name);
}

// fixes the array.push and array.splice methods
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

function page_index(page) {
	for(var i=0; i<page_titles.length; i++)
	{
		if(page_titles[i].toUpperCase() == page.toUpperCase())
			return i;
	}
	return -1;
}

// Returns if a page exists
function page_exists(page)
{
	return (is_special(page) || (page.indexOf("Tagged:")==0) || (page[page.length-1]==":") || (page_index(page)!=-1));
}

function str_rep(s, n) {
  var r = "";
   while (--n >= 0) r += s;
   return r;
}

function _random_string(string_length) {
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
	var randomstring = '';
	for (var i=0; i<string_length; i++) {
		var rnum = Math.floor(Math.random() * chars.length);
		randomstring += chars.charAt(rnum);
	}
	return randomstring;
}

var parse_marker = "#"+_random_string(8);

function _get_tags(text) {
	var tags = new Array();
	if (text.indexOf("Tag:")==0) {
		tags.push(text.substring(4));
	} else if (text.indexOf("Tags:")==0) {
		var alltags = text.substring(5).split(",");
		for(i=0;i<alltags.length;i++) {
			tags.push(alltags[i].replace(/^\s/g, "").replace(/\s$/g, ""));
		}
	}
	return tags;
}

function header_replace(hdr, text) {
	return text.replace( new RegExp("(^|\n)"+RegExp.escape(hdr)+"([^"+RegExp.escape(hdr.charAt(0))+"].*)", "g"), 	function (str, $1, $2) {
		var l = hdr.length;
		if ($2.indexOf(hdr)==$2.length-l)
			header = $2.substr(0, $2.length-l);
		else
			header = $2;
		log("Header is "+header);
		return "<h"+l+">"+header+"<\/h"+l+">";
	});
}

// XHTML lists parsing code by plumloco
// This is a bit of a monster, if you know an easier way please tell me!
// There is no limit to the level of nesting and it produces
// valid xhtml markup.
var reListItems = /([\*#]+)\s+([^\n]*)\n/g;
var reReapLists = /(?:^|\n)[\*#]\s[^\n]+\n(?:[\*#]+\s[^\n]+\n)*/g;
function parseList(str) {
        var o_or_u = (str.charAt(1)=='*'?'ul':'ol'),
		open_o_or_u = '<' + o_or_u + '>',
		close_o_or_u = '</' + o_or_u + '>',
		old = 0,
		stk = [];

        function toStr(item)
        {
            var s, i;
            if (typeof(item) === 'string')
            {
                return '<li>' + item + '</li>';
            }
            if (item instanceof Array)
            {
                s = open_o_or_u;
                for ( i=0; i<item.length; i++)
                {
                    s += toStr(item[i]);
                }
                return s + close_o_or_u;

            }
            return '<li>' + item.data + toStr(item.lst) + '</li>';
        }

        function collapse(to, from)
        {
            var nos, tos
            while (to < from)
            {
                nos = stk[from-1].pop();
                tos = stk[from];
                if (typeof(nos)==='string')
                {
                    stk[from-1].push({data: nos, lst: tos});
                }
                else
                {
                    stk[from-1].push(tos);
                }
                stk[from] = [];
                from -= 1;
             }

        }
        function collect(str, p1, data)
        {
            var nos, tos, type;
            var level = p1.length;
            while (stk.length <= level)
            {
                stk.push([])
            }
            if (level >= old)
            {
                stk[level].push(data);
                old = level;
            }
            else
            {
                collapse(level, old)
                stk[level].push(data);
            }
        }
        str.replace(reListItems, collect);
        collapse(1, old)
        return toStr(stk[1]);
    }

// single quote escaping for page titles	
function _sq_esc(s) {
	return s.replace(/'/g, "\\'");
}

// used not to break layout when presenting search results
var force_inline = false;

// Parse typed code into HTML
function parse(text)
{
	if (text == null) {
		log("text = null while parsing current page \""+current+"\"");
		return;
	} else
//		log("typeof(text) = "+typeof(text));
	var prefmt = new Array();
	var tags = new Array();
	// put away stuff contained in <pre> tags
	text = text.replace(/\<pre.*?\>(.*?)\<\/pre\>/g, function (str, $1) {
		var r = "<!-- "+parse_marker+prefmt.length+" -->";
		prefmt.push($1);
		return r;
	});
	
	// <b>
	text = text.replace(/([^\n])\*([^\*\n]+)\*/g, "$1"+parse_marker+"bS#$2"+parse_marker+"bE#");
	// <u>
	text = text.replace(/(^|[^\w])_([^_]+)_/g, "$1"+parse_marker+"uS#$2"+parse_marker+"uE#");
	
	// italics
	text = text.replace(/(^|[^\w])\/([^\/]+)\/($|[^\w\>])/g, function (str, $1, $2, $3) {
		if (str.indexOf("//")!=-1) {
			return str;
		}
		return $1+"<i>"+$2+"</i>"+$3;
	});
	
	text = text.replace(new RegExp(parse_marker+"([ub])([SE])#", "g"), function (str, $1, $2) {
		var tag = "<";
		if ($2=="E")
			tag += "/";
		tag += $1+">";
		return tag;
	});
	
	// headers
	for(i=1;i<5;i++) {
		text = header_replace(str_rep("!", i), text);
	}
	
	// <hr>
	text = text.replace(/(^|\n)\-\-\-/g, "<hr />");
	// <strike>
	//text = text.replace(/(^|\n|\s|\>|\*)\-(.*?)\-/g, "$1<strike>$2<\/strike>");
	// <br />

	// table start
	text = text.replace(/(^|\n)\{\|([^\n]*)/g, "$1<table class=\"text_area\" $2><tr>");
    
	// table end
	text = text.replace (/(^|\n)\|\}/g, "$1<\/tr><\/table>");
    
	// table caption
	text = text.replace(/(^|\n)\|\+([^\n]*)/g, "<caption>$2<\/caption>");
    
	// table new row
	text = text.replace(/(^|\n)\|\-/g, "<\/tr><tr>");
	
	// table data
	text = text.replace(/(^|\n)\|\s([^\n]*)/g, function(str, $1, $2)
		{
		$2 = $2.replace(/(\|\|)/g, "<\/td><td>");
			return "<td>" + $2 + "<\/td>";
		});

	// links with | 
	text = text.replace(/\[\[([^\]\]]*?)\|(.*?)\]\]/g, function(str, $1, $2)
			{
				if($1.indexOf("://")!=-1)
					return "<a class=\"world\" href=\"" + $1 + "\" target=\"_blank\">" + $2 + "<\/a>";
				
				if(page_exists($1))
					return "<a class=\"link\" onclick='go_to(\"" + _sq_esc($1) +"\")'>" + $2 + "<\/a>";
				else
					return "<a class=\"unlink\" onclick='go_to(\"" + _sq_esc($1) +"\")'>" + $2 + "<\/a>";
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
				else
					return "<a class=\"unlink\" onclick=\"go_to('" + _sq_esc($1) +"')\">" + $1 + "<\/a>";
					}); //"<a class=\"wiki\" onclick='go_to(\"$1\")'>$1<\/a>");

	if (ie)
		text = text.replace("\r\n", "\n");
		
	// fix double newlines
	text = text.replace(/\n\n/g, "<\/p><p>");
	// ordered/unordered lists parsing (code by plumloco)
	text = text.replace(reReapLists, parseList);
	
	// end-trim
	if (end_trim)
		text = text.replace(/[\n\s]*$/, "");
	
	text = text.replace(/\n/g, "<br />");
	
	if (prefmt.length>0) {
//		log("Replacing "+prefmt.length+" preformatted blocks");
		text = text.replace(new RegExp("<\\!-- "+parse_marker+"(\\d+) -->", "g"), function (str, $1) {
//			log("Replacing prefmt block #"+$1);
			return prefmt[$1];
		});
		prefmt = new Array();
	}
	
	if (tags.length) {
		if (force_inline)
			s = "";
		else
			s = "<div class=\"taglinks\">";
		s += "Tags: ";
		for(i=0;i<tags.length-1;i++) {
			s+="<a class=\"link tag\" onclick=\"go_to('Tagged:"+_sq_esc(tags[i])+"')\">"+tags[i]+"</a>&nbsp;&nbsp;";
		}
		if (tags.length>0)
			s+="<a class=\"link tag\" onclick=\"go_to('Tagged:"+_sq_esc(tags[tags.length-1])+"')\">"+tags[tags.length-1]+"</a>";
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
	
	return "<p>" + text + "</p>";
}

// prepends and appends a newline character to workaround plumloco's XHTML lists parsing bug
function _join_list(arr) {
	if (!arr.length)
		return "";
	return "\n* [["+arr.sort().join("]]\n* [[")+"]]\n";
}

function _simple_join_list(arr, sorted) {
	if (sorted)
		arr = arr.sort();
	return arr.join("\n")+"\n";
}

// with trailing double colon
function _get_namespace(ns) {
	var pg = new Array();
	for(var i=0;i<page_titles.length;i++) {
		if (page_titles[i].indexOf(ns)==0)
			pg.push( page_titles[i]);
	}
	return "!Pages in "+ns+" namespace\n" + _join_list(pg);
}

function _get_tagged(tag) {
	var pg = new Array();

	for(var i=0; i<pages.length; i++)
	{
		pages[i].replace(/\[\[([^\|]*?)\]\]/g, function(str, $1)
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

// Returns a index of search pages (by miz & legolas558)
function special_search( str )
{
	var pg_body = new Array();
	var title_result = "";

	var count = 0;
	// matches the search string and nearby text
	var reg = new RegExp( ".*" + RegExp.escape(str).replace(/^\s+/, "").
					replace(/\s+$/, "").replace(/\s+/g, ".*") + ".*", "gi" );

	for(i=0; i<pages.length; i++)
	{
		if (is_special(page_titles[i]) && (page_titles[i] != "Special:Menu"))
			continue;
//		log("Searching into "+page_titles[i]);
		
//		log("Regex is \""+reg+"\"");

		//look for str in title
		if(page_titles[i].match(reg))
			title_result += "* [[" + page_titles[i] + "]]\n";

		//Look for str in body
		res_body = pages[i].match( reg );
//		log("res_body = "+res_body);
		if (res_body!=null) {
			count = res_body.length;
			res_body = res_body.join(" ").replace( /\n/g, " ");
			pg_body.push( "* [[" + page_titles[i] + "]]: found *" + count + "* times :<div class=\"search_results\"><i>...</i><br />" + res_body +"<br/><i>...</i></div>");
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
	for(i=0; i<page_titles.length; i++)
	{
		if (!is_special(page_titles[i]))
			pg.push( page_titles[i] );
	}
	return _join_list(pg);
}

// Returns a index of all dead pages
function special_dead_pages () { // Returns a index of all dead pages
	var dead_pages = new Array();
	var from_pages = new Array();
	var page_done = false;
	for (j=0;j<pages.length;j++) {

		pages[j].replace(/\[\[([^\]\]]*?)(\|([^\]\]]+))?\]\]/g,
			function (str, $1, $2, $3) {
				if (page_done)
					return false;
//				log("In "+page_titles[j]+": "+$1+" -> "+$3);
				if ($1.indexOf("://")!=-1)
					return;
				if ($1.match(/Tag(s|ged)?:/gi))
					return;
				p = $1;
				if (!page_exists(p) && ((up = p.toUpperCase)!=page_titles[j].toUpperCase())) {
//					up = p.toUpperCase();
					for(i=0;i<dead_pages.length;i++) {
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
	for(i=0;i<dead_pages.length;i++) {
		s = "[["+dead_pages[i]+"]] from ";
		var from = from_pages[i];
		for(j=0;j<from.length-1;j++) {
			s+="[["+from[j]+"]], ";
		}
		if (from.length>0)
			s+="[["+from[from.length-1]+"]]";
		pg.push(s);
	}
	
  if (!pg.length)
	return '<i>No dead pages</i>';
  return _simple_join_list(pg, true);
}

// Returns a index of all orphaned pages
function special_orphaned_pages()
{
	var pg = new Array();
	var found = false;
	for(j=0; j<pages.length; j++)
	{
		if (is_special(page_titles[j]))
			continue;
		// search for pages that link to it
		for(i=0; i<pages.length; i++) {
			if ((i==j) /*|| is_special(page_titles[i])*/)
				continue;
			if( (pages[i].toUpperCase().indexOf("[[" + page_titles[j].toUpperCase() + "]]") != -1)
				|| (pages[i].toUpperCase().indexOf("|" + page_titles[j].toUpperCase() + "]]") != -1)
				) {
//					log("Page \""+page_titles[j]+"\" linked from page \""+page_titles[i]+"\"");
					found = true;
					break;
			}
		}
		if(found == false) {
			if (!is_special(page_titles[j]))
				pg.push( page_titles[j] );
		} else found = false;
	}
//	alert(pages[0]);
	if (!pg.length)
		return "/No orphaned pages found/";
	else
		return _join_list(pg); // TODO - Delete repeated data
}

function special_links_here()
{
	var pg = new Array();
	for(j=0; j<pages.length; j++)
	{
		// search for pages that link to it
		if(	(pages[j].toUpperCase().indexOf("[[" + current.toUpperCase() + "]]")!=-1) ||
				(pages[j].toUpperCase().indexOf("|" + current.toUpperCase() + "]]") != -1)
				) {
					pg.push( page_titles[j] );
		}
	}
	if(pg.length == 0)
		return "/No page links here/";
	else
		return "!!Links to "+current+"\n"+_join_list(pg);
}

// retrieve a stored page
function get_text(title)
{
	var pi = page_index(title);
	if (pi==-1)
		return null;
	// is the page encrypted or plain?
	if (!is__encrypted(pi))
		return pages[pi];
	decrypt_failed = true;
	var retry = false;
	var pg = null;
	do {
		if (!key.length) {
			var pw = prompt('The latest entered password (if any) was not correct for page "'+title+"'\n\nPlease enter the correct password.", '');
			if (pw==null)
				return null;
			if (!pw.length)
				return null;
			AES_setKey(pw);
			retry = true;
		}
		pg = AES_decrypt(pages[pi]);
	} while (retry);
	if (pg != null)
		decrypt_failed = false;
	return pg;
}

// Sets text typed by user
function set_text(text)
{
	var pi = page_index(current);
	if (pi==-1) {
		log("current page \""+current+"\" is not cached!");
		return;
	}
	text = _new_syntax_patch(text);
	if (!is__encrypted(pi)) {
		pages[pi] = text;
		return;
	}
	pages[pi] = AES_encrypt(text);
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

function clear_search() {
	if (!cached_search.length)
		return;
	cached_search = "";
	assert_current("Special:Search");
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
	
	cached_search = special_search( search_string )

	assert_current("Special:Search");
}

function is_special(page) {
	return (page.search(/Special:/i)==0);
}

function _get_special(cr) {
	var text = null;
	log("Getting special page "+cr);
	switch(cr) {
		case "Search":
			text = get_text("Special:"+cr);
			text += cached_search;
			break;
		case "Advanced":
			text = get_text("Special:"+cr);
			post_dom_render = "_setup_options";
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
			go_to("Special:Menu");
			edit();
			return null;
		case "Edit CSS":
			current_editing(cr, true);
			el("wiki_editor").value = document.getElementsByTagName("style")[0].innerHTML;
			return null;
		default:
			text = get_text("Special:"+cr);
			if(text == null)
				alert("Invalid special page.");
	}
	return text;
}

// Load a new current page
function set_current(cr)
{
	var text;
	log("Setting \""+cr+"\" as current page");
	post_dom_render = "";
	if (cr[cr.length-1]==":") {
		text = _get_namespace(cr);
		ns = "";
	} else {
		var p = cr.indexOf(":");
		if (p!=-1) {
			namespace = cr.substring(0,p);
			log("namespace of "+cr+" is "+namespace);
			cr = cr.substring(p+1);
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
					case "Locked":
					case "Unlocked":
						text = "Not yet implemented";
						break;
					case "Lock":
						pi = page_index(namespace+":"+cr);
						if (pi==-1)
							return;
						if (is__encrypted(pi)) {
//							alert("Page is already encrypted! First remove the previous password");
							return;
						}
						text = get_text("Special:Lock");
						post_dom_render = "_setup_lock_page('"+_sq_enc(cr)+"')";
						break;
					case "Unlock":
						cr = namespace+":"+cr;
						pi = page_index(cr);
							return;
						if (!is__encrypted(pi))
							return;
						text = get_text(cr);
						if (decrypt_failed) {
							decrypt_failed = false;
							return;
						}
						pages[pi] = text;
						page_attrs[pi] -= 2;
						save_to_file(true);
						return;
					default:
						text = get_text(namespace+":"+cr);
				}

			ns = namespace+":";
		} else {
			ns = "";
			text = get_text(cr);
		}
	}
	
	if(text == null)
	{
		if (decrypt_failed) {
			decrypt_failed = false;
			return;
		}
		switch (ns) {
			case "Special:":
			case "Lock:":
			case "Unlock:":
			case "Tag:":
			case "Tagged:":
				alert("You are not allowed to create a page titled \""+ns+cr+"\" because namespace \""+ns+"\" is reserved");
			return;
		}
		if(confirm("Page not found. Do you want to create it?"))
		{	// create and edit the new page
			// treat the page as a normal page
			cr = ns+cr;
			pages.push("");
			page_attrs.push(0);
			page_titles.push(cr);
			current = cr;
			log("Now pages list is: "+page_titles);
			edit_page(cr);
//			save_page(cr);
		}
		return;
	}

	load_as_current(ns+cr, text);
	if(document.getElementById("lastDate"))
		document.getElementById("lastDate").innerHTML = document.lastModified;
}

function load_as_current(title, text) {
	current = title;
	el("wiki_title").innerHTML = title;
	el("wiki_text").innerHTML = parse(text);
	document.title = title;
	update_nav_icons();
	if (post_dom_render.length!=0) {
		eval(post_dom_render+"()");
		post_dom_render = "";
	}
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

function _setup_options() {
	el("cb_allow_diff").checked = bool2chk(allow_diff);
	el("cb_dblclick_edit").checked = bool2chk(dblclick_edit);
	el("cb_permit_edits").checked = bool2chk(!permit_edits);
	el("cb_save_on_quit").checked = bool2chk(save_on_quit);
}

function refresh_menu_area() {
/*
	var bl_src = "\n\n[[Special:Backlinks]]";
	if (is_special(current)) {
		pre_src = "";
		post_src = bl_src;
	} else {
		post_src = "";
		pre_src = bl_src;
	}	*/
	el("menu_area").innerHTML = parse(get_text("Special:Menu")/*+pre_src)+post_src*/);
}

function _gen_display(id, visible, prefix) {
	el(prefix+"_"+id).style.display = (visible ? "inline" : "none");
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

// when the page is loaded
function on_load()
{
	log("***** StickWiki started *****");
	
	document.body.style.cursor = "auto";
	
	if(debug == true)
		el("debug_info").style.display = "block";
	else
		el("debug_info").style.display = "none";
		
	if (!ie) {
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
	
	unsupported_browser = (!firefox && !ie);
	document.getElementById("unsupported_browser").style.display = (unsupported_browser ? "block" : "none");

	// customized keyboard hook
	document.onkeydown = kbd_hook;

	// Go straight to page requested
	var qpage=document.location.href.split("?")[1];
	if(qpage)
	{
//		if(!page_exists(qpage)
//			current = main_page;
//		else
			current = unescape(qpage);
	}

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

var kbd_hooking=false;

function kbd_hook(orig_e)
{
	if (!orig_e)
		e = window.event;
	else
		e = orig_e;
		
	if (!kbd_hooking) {
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

function update_nav_icons() {
	menu_display("back", (backstack.length > 0));
	menu_display("forward", (forstack.length > 0));
	menu_display("advanced", (current != "Special:Advanced"));
	var can_edit = edit_allowed(current);
	menu_display("edit", can_edit);
	update_lock_icons(can_edit);
}

function update_lock_icons(can_edit) {
	var cyphered = is_encrypted(current);
	menu_display("lock", !kbd_hooking && can_edit && cyphered);
	menu_display("unlock", !kbd_hooking && can_edit && !cyphered);
}

// Adjusts the menu buttons
function disable_edit()
{
	log("DISABLING edit mode");
	kbd_hooking = false;
	// check for back and forward buttons - TODO grey out icons
	update_nav_icons();
	menu_display("home", true);
	menu_display("save", false);
	menu_display("cancel", false);
	el("text_area").style.display = "block";
	el("edit_area").style.display = "none";
	log("setting back title to "+prev_title);
	document.title = el("wiki_title").innerHTML = prev_title;
}

function menu_dblclick() {
	if (!dblclick_edit)
		return false;
	edit_menu();
	return true;
}

function page_dblclick() {
	if (!dblclick_edit)
		return false;
	edit();
	return true;
}

function edit_menu() {
	edit_page("Special:Menu");
}

function lock() {
	go_to("Lock:" + current);
}

function unlock() {
	go_to("Unlock:" + current);
}

// when edit is clicked
function edit()
{
	edit_page(current);
}

var edit_override = true;

function edit_allowed(page) {
	if (edit_override)
		return true;
	if (!permit_edits)
		return false;
	if (is_special(page) && (page!="Special:Menu"))
		return false;
	return !is_readonly(page);
}

function is_readonly(page) {
	return (page_attrs[page_index(page)] & 1 != 0);
}

function is__encrypted(pi) {
	return (page_attrs[pi] & 2 != 0);
}
function is_encrypted(page) {
	return is__encrypted(page_index(page));
}

// setup the title boxes and gets ready to edit text
function current_editing(page, disabled) {
	log("Currently editing "+page+", title disabled: "+disabled);
	prev_title = current;
	el("wiki_page_title").disabled = (disabled ? "disabled" : "");
	el("wiki_page_title").value = page;
	document.title = el("wiki_title").innerHTML = "Editing "+page;
	// current must be set BEFORE calling enabling menu edit
	log("ENABLING edit mode");
	kbd_hooking = true;
	menu_display("back", false);
	menu_display("forward", false);
	menu_display("advanced", false);
	menu_display("home", false);
	menu_display("edit", false);
	menu_display("save", true);
	menu_display("cancel", true);
	update_lock_icons(true);
	el("text_area").style.display = "none";

	// FIXME!
	if(!ie)	{
		el("wiki_editor").style.width = window.innerWidth - 30 + "px";
		el("wiki_editor").style.height = window.innerHeight - 150 + "px";
	}
	el("edit_area").style.display = "block";

	el("wiki_editor").focus();
	current = page;
}

function edit_page(page) {
	if (!edit_allowed(page))
		return;
	// setup the wiki editor textbox
	current_editing(page, is_special(page));
	el("wiki_editor").value = get_text(page);
}

// renames a page
function rename_page(previous, newpage)
{
	log("Renaming "+previous+" to "+newpage);
	for(i=0; i<pages.length; i++)
	{
		if(page_titles[i] == previous)
		{
			page_titles[i] = newpage;
			// TODO - change all references
			break;
		}
	}
	if (previous == main_page)
		main_page = newpage;
}

// when a page is deleted
function delete_page(page)
{
	for(i=0; i<pages.length; i++)
	{
		if(page_titles[i].toUpperCase() == page.toUpperCase())
		{
			log("DELETED page "+page);
			page_titles.splice(i,1);
			pages.splice(i,1);
			page_attrs.splice(i,1);
			break;
		}
	}
}

function _new_syntax_patch(text) {
	// links with |
	text = text.replace(/\[\[([^\]\]]*?)\|(.*?)\]\]/g, function(str, $1, $2)
			{
				if($1.indexOf("://")!=-1)
					return str;
				
				// replace the first occurence of the two double colons
				return str.replace(/::/g, ":");
			});
	// links without |
	text = text.replace(/\[\[([^\|]*?)\]\]/g, function(str, $1)
			{
				if($1.match("://"))
					return str;
				
				// replace the first occurence of the two double colons
				return str.replace(/::/g, ":");
			});

	//BUG: will also edit <pre> tags stuff
	text = text.replace(/(^|\n)(\+*)/g, function (str, $1, $2) {
		return $1+str_rep("*", $2.length);
	});
	
	return text;
}

// when save is clicked
function save()
{
	switch(current)
	{
		case "Special:Edit CSS":
			document.getElementsByTagName("style")[0].innerHTML = el("wiki_editor").value;
			back_to = null;
			current = "Special:Advanced";
			el("wiki_page_title").disabled = "";
			break;
		default:
			// check if text is empty
			if(el("wiki_editor").value == "")
			{
				if(confirm("Are you sure you want to DELETE this page?"))
				{
					delete_page(current);
					disable_edit();
					back_or(main_page);
					save_to_file(true);
				}
				return;
			}
			else
			{
				// here the page gets actually saved
				set_text(el("wiki_editor").value);
				new_title = el("wiki_page_title").value;
				if (new_title=="Special:Menu") {
					refresh_menu_area();
					back_to = prev_title;
//					alert(prev_title);
				} else { if (!is_special(new_title) && (new_title != current))
							rename_page(current, new_title);
					back_to = new_title;
				}				
			}
	}
	save_page(current);
	if (back_to != null)
		set_current(back_to);
	else // used for CSS editing
		back_or(main_page);
	disable_edit();
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
	go_to("Special:Advanced");
}

function history_mem(page) {
	if (backstack.length>6)
		backstack = new Array(page);
	else
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
	// escape double quotes
	s = s.replace(new RegExp("\"", "g"), "\\\"");
	// escape newlines (\r\n happens only on the stupid IE) and eventually split the lines accordingly
	if (!split_lines)
		s = s.replace(new RegExp("\r\n|\n", "g"), "\\n");
	else
		s = s.replace(new RegExp("\r\n|\n", "g"), "\\n\" +\n\"");
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
	var s = "";
	for(var i=0;i<arr.length-1;i++) {
		s += "\"" + js_encode(arr[i], split_lines) + "\",\n";
	}
	if (arr.length>1)
		s += "\"" + js_encode(arr[arr.length-1], split_lines) + "\"\n";
	return s;
}

function printout_num_arr(arr) {
	var s = "";
	for(var i=0;i<arr.length-1;i++) {
		s += "0x"+arr[i].toString(16) + ",\n";
	}
	if (arr.length>1)
		s += "0x"+arr[i].toString(16) + "\n";
	return s;
}

function save_page(page_to_save) {
	log("Saving page \""+page_to_save+"\"");
	save_to_file(true);
}

function save_options() {
	save_to_file(false);
	set_current("Special:Advanced");
}

function save_to_file(full) {
	document.body.style.cursor = "wait";

	var new_marker;
	if (full)
		new_marker = _random_string(18);
	else new_marker = __marker;

	var computed_js = "\n/* <![CDATA[ */\n\nvar version = \""+version+
	"\";\n\nvar __marker = \""+new_marker+
	"\";\n\nvar permit_edits = "+permit_edits+
	";\n\nvar dblclick_edit = "+dblclick_edit+
	";\n\nvar save_on_quit = "+save_on_quit+
	";\n\nvar allow_diff = "+allow_diff+
	";\n\nvar current = \"" + js_encode(current)+
	"\";\n\nvar main_page = \"" + main_page + "\";\n\n";
	
	computed_js += "var backstack = new Array(\n" + printout_arr(backstack, false) + ");\n\n";

	computed_js += "var page_titles = new Array(\n" + printout_arr(page_titles, false) + ");\n\n";
	
	computed_js += "/* " + new_marker + " */\n";
	
	if (full) {
	
		computed_js += "var page_attrs = new Array(\n" + printout_num_arr(page_attrs) + ");\n\n";
		
		computed_js += "var pages = new Array(\n" + printout_arr(pages, allow_diff) + ");\n\n";
		
		computed_js += "/* " + new_marker + " */\n";
	}

	// not needed: the end tag must not be removed by the offset
//	computed_js += "/* ]]> */";
	
	// attempt to clear the first <script> tag found in the DOM
	try {
		var obj = document.documentElement.childNodes[0];
		var subobj = null;
		for (var i=0;i<obj.childNodes.length;i++) {
			subobj = obj.childNodes[i];
			if (subobj.tagName && subobj.tagName.toUpperCase() == "SCRIPT") {
				if (ie)
					subobj.text = "/* ]]> */ ";
				else
					subobj.innerHTML = "/* ]]> */ ";
				break;
			}
		}
	} catch (e) { log(e);}
	
	// cleanup the DOM before saving
	el("wiki_editor").value = "";
	el("wiki_text").innerHTML = "";
	el("menu_area").innerHTML = "";
	if (ie) {	// to prevent their usual UTF-8 corruption
		el("alt_back").innerHTML = "";
		el("alt_forward").innerHTML = "";
		el("alt_cancel").innerHTML = "";
	} else {
//		free_uri_pics(el("img_home"),el("img_back"),el("img_forward"),el("img_edit"),el("img_cancel"),el("img_save"),el("img_advanced"))
	}
	
	// fully remove the first <script> tag
	var offset;
	if (full)
		offset = document.documentElement.innerHTML.indexOf("/* ]]> */ </script>");
	else
		offset = document.documentElement.innerHTML.indexOf("/* "+__marker+ " */") + 6 + __marker.length;
	
	if (!debug || save_override)
		r = saveThisFile(computed_js, offset);
	else r = false;
	document.body.style.cursor= "auto";
	
	refresh_menu_area();
	
	if (ie)
		create_alt_buttons();
//	else		setup_uri_pics(el("img_home"),el("img_back"),el("img_forward"),el("img_edit"),el("img_cancel"),el("img_save"),el("img_advanced"))

	cfg_changed = false;

	return r;
}

// save this file
function saveThisFile(data, offset)
{
	if(unsupported_browser)
	{
		alert("This browser is not supported and your changes won't be saved on disk.");
		return false;
	}
	var filename = document.location.toString().split("?")[0];
	filename = filename.replace("file:///", "");
	filename = filename.replace(/\s/g, "_");
	filename = filename.replace(/#.*/g, "");
	if(navigator.appVersion.indexOf("Win")!=-1)
		filename = filename.replace(/\//g, "\\");
	else
		filename = "/" + filename;
	
	r = saveFile(filename,
	"<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">\n<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\">\n<head>\n<script type=\"text/javascript\">" + data + "\n" + document.documentElement.innerHTML.substring(offset) + "</html>");
	if (r)
		log("\""+filename+"\" saved successfully");
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

function erase_wiki() {
	if(confirm("This will ERASE all your pages.\n\nAre you sure you want to continue?") == false)
		return false;
	var pg_advanced = get_text("Special:Advanced");
	var pg_import = get_text("Special:Import");
	var pg_search = get_text("Special:Search");
	var pg_about = get_text("Special:About");
	page_titles = new Array("Main Page", "Special:Menu", "Special:Advanced", "Special:Import", "Special:Search", "Special:About");
	pages = new Array("This is your empty main page", "[[Main Page]]\n\n[[Special:Advanced]]\n[[Special:Backlinks]]\n[[Special:Search]]", pg_advanced, pg_import, pg_search, pg_about);
	current = main_page = "Main Page";
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
	var old_version, ver_str;
	try {
		ver_str = ct.match(/\<div id=\"version_\"\>(.*)\<\/div\>/i)[1];
		log("Old wiki contains version string \""+ver_str+"\"");
		switch(ver_str)
		{
			case "0.03":
				old_version = 3;
				break;
			case "0.04": 
			case "0.04G":
				old_version = 4;
				break;
			case "0.9B":
				old_version = 9;
			default:
				alert("Incompatible version: " + ver_str);
				return false;
		}
	} catch(e) {
		old_version = 2;
		if(ct.match("<div id=\""+escape("Special:Advanced")+"\">"))
			old_version = 3;
	}

	// get only the needed part
	var wiki;
	try {
		wiki = ct.match(/\<div .*id=\"wiki\"\>((.|\n|\t|\s)*)\<\/div\>/)[0];
	} catch(e) {
		alert("Unrecognized file");
		document.body.style.cursor= "auto";
		return false;
	}
	
	// eliminate comments
	wiki = wiki.replace(/\<\!\-\-.*\-\-\>/g, "");

	// separate variables from wiki
	var vars;
	try {
		vars = wiki.match(/\<div .*id=\"variables\"\>((.|\n|\t|\s)*)\<\/div\>/)[0];
	} catch(e) {
		vars = "";
	}
	if(old_version == 2)
	{
		try {
			vars = wiki.match(/\<div.*id=\"main_page\".*\>(.*)\<\/div\>/)[0];
		} catch(e) {
		}
	}
	wiki = wiki.replace(vars, "");

	// get an array of variables and wikis
	var var_names = new Array();
	var var_values = new Array();
	var vc = 0;
	var page_names = new Array();
	var page_contents = new Array();
	var pc = 0;

	// eliminate headers
	wiki = wiki.replace(/\<div.*?id=\"wiki\".*?\>/, "");
	vars = vars.replace(/\<div.*?id=\"variables\".*?\>/, "");

	vars.replace(/\<div.*?id=\"(.*?)\".*?\>((\n|.)*?)\<\/div\>/g, function(str, $1, $2)
			{
				if(old_version == 2)
					var_names[vc] = "main_page_";
				else
					var_names[vc] = $1;
				var_values[vc] = $2;
				vc++;
			});
			
	wiki.replace(/\<div.*?id=\"(.*?)\".*?\>((\n|.)*?)\<\/div\>/g, function(str, $1, $2, $3)
			{
				if (old_version != 2) {
					page_names[pc] = unescape($1);
					page_contents[pc] = unescape($2);
				} else {
					page_names[pc] = $1;
					page_contents[pc] = $2;
				}
				if (old_version < 9) {	// apply compatibility changes to stickwiki versions below v0.9
					page_contents[pc] = _new_syntax_patch(page_contents[pc].replace(new RegExp("(\\[\\[|\\|)Special::Import wiki\\]\\]", "ig"), "$1Special::Import]]").replace(/\[\[([^\]\]]*?)(\|([^\]\]]+))?\]\]/g,
					function (str, $1, $2, $3) {
						if ($3.length)
							return "[["+$3+"|"+$1+"]]";
						else
							return str;
					}));
					if (page_names[pc] == "Special::Edit Menu")
						page_names[pc] = "Special:Menu";
				}
				pc++;
			}
			);

	// add new data
	var pages_imported = 0;
	
	//TODO: import the variables and the CSS from v0.04
	if (old_version>=4) {
		var css = null;
		ct.replace(/\<style.*?type=\"text\/css\".*?\>((\n|.)*?)\<\/style\>/, function (str, $1) {
			css = $1;
		});
		if (css!=null) {
			log("Imported "+css.length+" bytes of CSS");
			if (old_version<9)
				css += "/* since v0.9 */\nh1 { font-size: 23px; }\nh2 { font-size: 20px; }\nh3 { font-size: 17px; }\nh4 { font-size: 14px; }\ndiv.taglinks {\n	border: 1px solid #aaa;\n	padding: 5px;\n	margin-top: 1em;\n	clear: both;\n}\n\ndiv.search_results {\n	border: 1px solid #aaa;\n	background-color: #f9f9f9;\n	padding: 5px;\n	margin-top: 1em;\n	clear: both;\n}\n\na.link.tag {\n  color: navy;\n}";
			document.getElementsByTagName("style")[0].innerHTML = css;
		}
	}
	
	// import the variables
	var new_main_page = main_page;
	var old_block_edits = !permit_edits;
	for(i=0;i<var_names.length;i++) {
		if (var_names[i] == "main_page_")
			new_main_page = (version!=2) ? unescape(var_values[i]) : var_values[i];
		else if (var_names[i] == "permit_edits")
			old_block_edits = (var_values[i]=="0");
	}
	if (page_exists(new_main_page))
		main_page = new_main_page;
		
	permit_edits = !old_block_edits;
	
	//note: before v0.04 permit_edits didnt exist
	//note: in version 2 pages were not escaped
	
	for(i=0; i<page_names.length; i++)
	{
		if (!is_special(page_names[i]) || (page_names[i] == "Special:Menu") || (page_names[i] == "Special:Search"))
		{
			pi = page_index(page_names[i]);
			if (pi == -1) {
				page_titles.push(page_names[i]);
				pages.push(page_contents[i]);
				page_attrs.push(0);
			} else {
				page_titles[pi] = page_names[i];
				pages[pi] = page_contents[i];
				page_attrs[pi] = 0;
			}
			pages_imported++;
		}
	}

	// remove hourglass
	document.body.style.cursor= "auto";
	
	alert("Import completed: " + pages_imported + " pages imported.");
	
	current = main_page;
	// save everything
	save_to_file(true);

	back_or("Special:Import");
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
		alert("Exception while attempting to save\n\n" + e.toString());
		return(null);
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
		if(window.opera)
			opera.postError(e);
		return null;
	}
	return true;
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
else if((navigator.appName).indexOf("Microsoft")!=-1)
	ie = true;

// finds out if Opera is trying to look like Mozilla
if(firefox == true && navigator.product != "Gecko")
	firefox = false;

// finds out if Opera is trying to look like IE
if(ie == true && navigator.userAgent.indexOf("Opera") != -1)
	ie = false;

if (debug) {
	// logging function - used in development

	function log(aMessage)
	{
	    var logbox = document.getElementById("swlogger");
		nls = logbox.value.match(new RegExp("\n", "g"));
		if (nls!=null && typeof(nls)=='object' && nls.length>11)
			logbox.value = "";
		logbox.value += aMessage + "\n";
	}
} else {
	function log(aMessage) { }
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
var i;
var j;
var tot;
var key = [];
var lenInd = true;	// length indicator (to remove padding bytes)

var wMax = 0xFFFFFFFF;
function rotb(b,n){ return ( b<<n | b>>>( 8-n) ) & 0xFF; }
function rotw(w,n){ return ( w<<n | w>>>(32-n) ) & wMax; }
function getW(a,i){ return a[i]|a[i+1]<<8|a[i+2]<<16|a[i+3]<<24; }
function setW(a,i,w){ a.splice(i,4,w&0xFF,(w>>>8)&0xFF,(w>>>16)&0xFF,(w>>>24)&0xFF); }
function setWInv(a,i,w){ a.splice(i,4,(w>>>24)&0xFF,(w>>>16)&0xFF,(w>>>8)&0xFF,w&0xFF); }
function getB(x,n){ return (x>>>(n*8))&0xFF; }

function getNrBits(i){ var n=0; while (i>0){ n++; i>>>=1; } return n; }
function getMask(n){ return (1<<n)-1; }

function getLen(bits){
  var n = (bits+7)>>>3;
  var r=0;
  for (var i=0; i<n; i++) r += bData.shift()<<(i*8);
  return r&getMask(bits);
}

var bMax=0xFFFF;
var bMaxBits=getNrBits(bMax);

function bGetNrBits(a){ return (a.length-1)*bMaxBits+getNrBits(a[a.length-1]); }

function insLen(len, bits){
  var n=(bits+7)>>>3;
  while (bits<n*8){ len=((len&0xFF)<<bits)|len; bits*=2; }
  while (n-->0) bData.unshift( (len>>>(n*8))&0xFF );
}

var utf8sets = [0x800,0x10000,0x110000];

function unExpChar(c){
  return "unexpected character '"+String.fromCharCode(c)+"' (code 0x"+c.toString(16)+").";
}

function utf8Encrypt(){
  if (i==0) { /* prgr='UTF-8'; */ bData=[]; tot=sData.length; j=0; }
  var z = Math.min(i+100,tot);
  var c = 0;
  var k = 0;
  while (i<z) {
    c = sData.charCodeAt(i++);
    if (c<0x80){ bData[j++]=c; continue; }
    k=0; while(k<utf8sets.length && c>=utf8sets[k]) k++;
    if (k>=utf8sets.length) throw( "UTF-8: "+unExpChar(c) );
    for (var n=j+k+1;n>j;n--){ bData[n]=0x80|(c&0x3F); c>>>=6; }
    bData[j]=c+((0xFF<<(6-k))&0xFF);
    j += k+2;
  }
}

function utf8Decrypt(){
  if (i==0){ /* prgr='UTF-8'; */ sData=""; tot=bData.length; }
  var z=Math.min(i+100,tot);
  var c = 0;
  var e = "";
  var k = 0;
  var d = 0;
  while (i<z){
    c = bData[i++];
    e = '0x'+c.toString(16);
    k=0; while(c&0x80){ c=(c<<1)&0xFF; k++; }
    c >>= k;
    if (k==1||k>4) {
		throw('UTF-8: invalid first byte '+e+'.');
	}
    for (var n=1;n<k;n++){
      d = bData[i++];
      e+=',0x'+d.toString(16);
      if (d<0x80||d>0xBF) break;
      c=(c<<6)+(d&0x3F);
    }
    if ( (k==2&&c<0x80) || (k>2&&c<utf8sets[k-3]) ) {
		throw("UTF-8: invalid sequence "+e+'.');
	}
    sData+=String.fromCharCode(c);
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
  return [ getW(bData,i), getW(bData,i+4), getW(bData,i+8), getW(bData,i+12) ];
}

function aesUnpackBlock(packed){
  for ( var mj=0; mj<4; mj++,i+=4) setW( bData, i, packed[mj] );
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
    if (lenInd) insLen( bData.length%16, 4 );
    //if (cbc)
	for (i=0; i<16; i++) bData.unshift( Math.floor(Math.random()*256) );
    while( bData.length%16!=0 ) bData.push(0);
    tot = bData.length;
    aesInit();
  }else{
    //if (cbc)
	for (j=i; j<i+16; j++) bData[j] ^= bData[j-16];
    enc();
  }
  if (i>=tot) aesClose();
}

function blcDecrypt(dec){
  if (tot==0){
//    prgr = name;
    if (key.length<1) return;
    //if (cbc)
	{ i=16; }
    tot = bData.length;
    if ( (tot%16) || tot<i ) throw 'AES: Incorrect length.';
    aesInit();
  }else{
    //if (cbc)
	i=tot-i;
    dec();
    //if (cbc)
	{
      for (j=i-16; j<i; j++) bData[j] ^= bData[j-16];
      i = tot+32-i;
    }
  }
  if (i>=tot){
    aesClose();
    //if (cbc)
	bData.splice(0,16);
    if (lenInd){
      var ol = bData.length;
      var k = getLen(getNrBits(15));
      while((k+ol-bData.length)%16!=0) bData.pop();
    }
    else{
      while(bData[bData.length-1]==0) bData.pop();
    }
  }
}

// sets global key to the utf-8 encoded key
function AES_setKey(sKey) {
  sData=p;
  i=tot=0;
  do{ utf8Encrypt(); } while (i<tot);
  sData = null;
  key = bData;
  bData = null;
}

function AES_clearKey() {
	key = [];
}

// sets global bData to the utf-8 encoded binary data extracted from d
function setData(d) {
	sData = d;
	i=tot=0;
	do{ utf8Encrypt(); } while (i<tot);
	sData = null;
}

// returns an array of encrypted characters
function AES_encrypt(raw_data) {
	setData(raw_data);

	// save 2 random characters for decryption control
	var magic_pos = Math.floor(Math.random() * Math.max(0, bData.length-2));
	var magic_len = 2;
	bData.push(0);
	for(a=0;a<magic_len;a++)
		bData.push(bData[magic_pos+a]);

	setW(bData, bData.length, magic_pos);
	setW(bData, bData.length, magic_len);
	
	i=tot=0;
	do{ blcEncrypt(aesEncrypt); } while (i<tot);

	return bData;
}

// decrypts an array of encrypted characters
// returns null if magic check fails
function AES_decrypt(raw_data) {
	bData = raw_data;
	
	i=tot=0;
	do{ blcDecrypt(aesDecrypt); } while (i<tot);

	// check if the magic characters were saved
	if (bData.length < 10)
		return null;
	var magic_pos = getW(bData.length-8);
	var magic_len = getW(bData.length-4);
	if ((magic_pos >= bData.length - 9) ||
		(magic_pos + magic_len >= bData.length - 9))
		return null;
	for(a=0;a<magic_len;a++)
		if (bData[magic_pos+a] != bData[bData.length-8-magic_len+a])
			return null;
	
	i=tot=0;
	do{ utf8Decrypt(); } while (i<tot);
	
	return sData;
}

var test_key = "a very good password";

//alert(AES_decrypt(test_key, AES_encrypt(test_key, "Hello World!")));

/* ]]> */