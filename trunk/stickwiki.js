<!--
/*** stickwiki.js ***/

var debug = true;			// toggle debug mode (and console)
var save_override = true;	// allow to save when debug mode is active
var end_trim = true;		// trim pages from the end
var save_on_quit = true;

var forstack = new Array();
var cached_search = "";
var tag_to_show = "";
var search_focused = false;
var prev_title = current;	// used when entering/exiting edit mode

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
	text = text.replace(/\*([^\*]+)\*/g, parse_marker+"bS#$1"+parse_marker+"bE#");
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

	// links
	// with | 
	text = text.replace(/\[\[([^\]\]]*?)\|(.*?)\]\]/g, function(str, $1, $2)
			{
				if($1.indexOf("://")!=-1)
					return "<a class=\"world\" href=\"" + $1 + "\" target=\"_blank\">" + $2 + "<\/a>";
				
				if(page_exists($1))
					return "<a class=\"link\" onclick='go_to(\"" + $1 +"\")'>" + $2 + "<\/a>";
				else
					return "<a class=\"unlink\" onclick='go_to(\"" + $1 +"\")'>" + $2 + "<\/a>";
			}); //"<a class=\"wiki\" onclick='go_to(\"$2\")'>$1<\/a>");
	// without |
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
					return "<a class=\"link\" onclick='go_to(\"" + $1 +"\")'>" + $1 + "<\/a>";
				else
					return "<a class=\"unlink\" onclick='go_to(\"" + $1 +"\")'>" + $1 + "<\/a>";
					}); //"<a class=\"wiki\" onclick='go_to(\"$1\")'>$1<\/a>");
	var max_list = 5;
	// unordered lists
	for(i=0; i<max_list; i++) {
		text = text.replace(new RegExp("(^|\\n)"+str_rep("\\+", i+1)+"\\s([^\\n]*)", "g"), "$1"+str_rep("<ul>", i+1)+"<li>$2<\/li>"+str_rep("<\/ul>",i+1));
	}
	for(i=0; i<max_list; i++)
	{
		text = text.replace(/\<\/ul\>\<ul\>/g, "");
		text = text.replace(/\<\/ul\>\n\<ul\>/g, "");
	}

	// numberered lists
	for(i=0; i<max_list; i++) {
		text = text.replace(new RegExp("(^|\\n)"+str_rep("#", i+1)+"\\s([^\\n]*)", "g"), "$1"+str_rep("<ol>", i+1)+"<li>$2<\/li>"+str_rep("<\/ol>",i+1));
	}
	for(i=0; i<max_list; i++)
	{
		text = text.replace(/\<\/ol\>\<ol\>/g, "");
		text = text.replace(/\<\/ol\>\n\<ol\>/g, "");
	}
	text = text.replace(/\n\n/g, "<\/p><p>");
	text = "<p>" + text + "<\/p>";
	text = text.replace(/(\<\/h.\>)\n/g, "$1");
	text = text.replace(/(\<\/ul\>)\n/g, "$1");
	text = text.replace(/(\<\/ol\>)\n/g, "$1");
	text = text.replace(/(\<\/li\>)\n/g, "$1");

	if (ie)
		text = text.replace("\r\n", "\n");

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
			s+="<a class=\"link tag\" onclick=\"go_to('Tagged:"+tags[i]+"')\">"+tags[i]+"</a>&nbsp;&nbsp;";
		}
		if (tags.length>0)
			s+="<a class=\"link tag\" onclick=\"go_to('Tagged:"+tags[tags.length-1]+"')\">"+tags[tags.length-1]+"</a>";
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
	
	return text;
}

function _get_namespace(ns) {
	var pg = new Array();
	for(var i=0;i<page_titles.length;i++) {
		if (page_titles[i].indexOf(ns+":")==0)
			pg.push("+ [["+page_titles[i]+"]]");
	}
	return "!Pages in "+ns+" namespace\n" + pg.sort().join("\n");
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
						pg.push("+ [[" + page_titles[i] + "]]" );
				}

				
			});
	}
	
	if (!pg.length)
		return "No pages tagged with *"+tag+"*";
	return "!" + tag + "\n" +pg.sort().join("\n");
}

// Returns a index of search pages (by miz & legolas558)
function special_search( str )
{
	var pg = new Array();
	var pg_body = new Array();

	var count = 0;
	// matches the search string and nearby text
	var reg = new RegExp( ".*" + RegExp.escape(str).replace(/^\s+/, "").
					replace(/\s+$/, "").replace(/\s+/g, ".*") + ".*", "gi" );

	for(i=0; i<pages.length; i++)
	{
//		log("Searching into "+page_titles[i]);
		
//		log("Regex is \""+reg+"\"");

		//look for str in title
		if(page_titles[i].match(reg))
			pg.push("+ [[" + page_titles[i] + "]]");

		//Look for str in body
		res_body = pages[i].match( reg );
//		log("res_body = "+res_body);
		if (res_body!=null) {
			if (typeof(res_body) == "object") {
				count = res_body.length;
				res_body = res_body.join(" ");
			} else {
				count = 1;
				alert("string result");
			}
			res_body = res_body.replace( /\n/g, "") ;
			pg_body.push("+ [[" + page_titles[i] + "]]: *found " + count + " times :* <div class=\"search_results\"><i>...</i><br />" + res_body+"<br/><i>...</i></div>" );
		}
	}
	
	if (!pg.length && !pg_body.length)
		return "No results found for *"+str+"*";
	force_inline = true;
	return "Results for *" + str + "*\n" +pg.sort().join("\n") + "\n\n---\n" + pg_body.sort().join("\n");
}

// Returns a index of all pages
function special_all_pages()
{
	var pg = new Array();
	var text = "";
	for(i=0; i<page_titles.length; i++)
	{
		if (!is_special(page_titles[i]))
			pg.push("+ [[" + page_titles[i] + "]]");
	}
	return pg.sort().join("\n");
}

// Returns a index of all special pages
function special_all_special_pages()
{
	var pg = new Array();
	var text = "";
	for(i=0; i<page_titles.length; i++)
	{
		if (is_special(page_titles[i]))
			pg.push("+ [[" + page_titles[i] + "]]");
	}
	return pg.sort().join("\n");
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
				if ($1.match("Tag(s|ged)?:")==0)
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

	var s = "";
	for(i=0;i<dead_pages.length;i++) {
		s+="[["+dead_pages[i]+"]] from ";
		var from = from_pages[i];
		for(j=0;j<from.length-1;j++) {
			s+="[["+from[j]+"]], ";
		}
		if (from.length>0)
			s+="[["+from[from.length-1]+"]]";
		s += "\n";
		log(dead_pages[i]+" in "+from);
	}
	
  if (s == '')
	return '<i>No dead pages</i>';
  return s; 
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
				pg.push("+ [[" + page_titles[j] + "]]");
		} else found = false;
	}
//	alert(pages[0]);
	if(pg.length == 0)
		return "/No orphaned pages found/";
	else
		return pg.sort().join("\n"); // TODO - Delete repeated data
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
					pg.push("+ [["+page_titles[j]+"]]");
		}
	}
	if(pg.length == 0)
		return "/No page links here/";
	else
		return "!!Links to "+current+"\n"+pg.sort().join("\n");
}

// retrieve a stored page
function get_text(title)
{
	var pi = page_index(title);
	if (pi==-1)
		return null;
	return pages[pi];
}

// Sets text typed by user
function set_text(text)
{
	var pi = page_index(current);
	if (pi==-1) {
		log("current page \""+current+"\" is not cached!");
		return;
	}
	pages[pi] = text;
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

function block_edits(page) {
	if (edit_allowed(page))
	{
		permit_edits = false;
		menu_display("edit", false);
		menu_display("edit_button", false);
//		if(unsupported_browser)			document.getElementById("unsupported_browser").style.display = "none";
		alert("Edits blocked.");
	} else {
		permit_edits = true;
		menu_display("edit", true);
		menu_display("edit_button", true);
		if(unsupported_browser)
			document.getElementById("unsupported_browser").style.display = "block";
		alert("Edits unblocked.");
	}
	if (!save_on_quit)
		_save_config_only();
	back_or(main_page);
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
		case "Erase Wiki":
			if (erase_wiki()) {
				save_all();
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
		case "Block Edits":
			alert("Block edits currently disabled!");
			//block_edits(current);
			return null;
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
	var p = cr.indexOf(":");
	if (p!=-1) {
		namespace = cr.substring(0,p);
		log("namespace of "+cr+" is "+namespace);
		cr = cr.substring(p+1);
		if (!cr.length)
			text = _get_namespace(namespace);
		else {
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
				default:
					text = get_text(namespace+":"+cr);
			}
		}
		ns = namespace+":";
	} else {
		ns = "";
		text = get_text(cr);
	}
	
	if(text == null)
	{
		if(confirm("Page not found. Do you want to create it?"))
		{	// create and edit the new page
			// treat the page as a normal page
			cr = ns+cr;
			pages.push("");
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
	if (save_on_quit)
		_save_config_only();
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
	menu_display("edit", !is_special(current) && (edit_allowed(current)));
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

function edit_menu() {
	edit_page("Special:Menu");
}

// when edit is clicked
function edit()
{
	edit_page(current);
}

var edit_override = false;

function edit_allowed(page) {
	if (edit_override)
		return true;
	if (!permit_edits)
		return false;
	if (is_special(page) && (page!="Special:Menu"))
		return false;
	return true;
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
			save_all();
			break;
		}
	}
}

function _new_syntax_patch(text) {
	//TODO: convert '+' to '*' for bullet lists, convert '::' to ':' into wiki links
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
	// first replace all slashes
//	s = s.replace(new RegExp("\x5C", "g"), "\\\\");
	// then replace the double quotes
	s = s.replace(new RegExp("\"", "g"), "\\\"");
	// finally replace the newlines (\r\n happens only on the stupid IE
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

function save_page(page_to_save) {
	log("Saving page \""+page_to_save+"\"");
	save_all();
}

function _save_config_only() {
	// not yet written
}

function save_all() {
	document.body.style.cursor = "wait";

	var computed_js = "\n/* <![CDATA[ */\n\nvar version = \""+version+
	"\";\n\nvar permit_edits = "+permit_edits+
	";\n\nvar allow_diff = "+allow_diff+
	";\n\nvar current = \"" + js_encode(current)+
	"\";\n\nvar main_page = \"" + main_page + "\";\n\n";
	
	computed_js += "var backstack = new Array(\n" + printout_arr(backstack, false) + ");\n\n";

	computed_js += "var page_titles = new Array(\n" + printout_arr(page_titles, false) + ");\n\n";
	
	computed_js += "var pages = new Array(\n" + printout_arr(pages, allow_diff) + ");\n\n";

	// not needed: the end tag is provviden by the matching function
//	computed_js += "/* ]]> */";
	
	// attempt to clear the first <script> tag found in the DOM
	try {
		var obj = document.documentElement.childNodes[0];
		var subobj = null;
		for (var i=0;i<obj.childNodes.length;i++) {
			subobj = obj.childNodes[i];
			if (subobj.tagName && subobj.tagName.toUpperCase() == "SCRIPT") {
				if (ie)
					subobj.text = "/* ]]> */\n";
				else
					subobj.innerHTML = "/* ]]> */\n";
				break;
			}
		}
	} catch (e) { log(e);}
	
	// cleanup the DOM before saving
	el("wiki_editor").value = "";
	el("wiki_text").innerHTML = "";
	el("menu_area").innerHTML = "";
	if (ie) {	// to prevent utf-8 corruption
		el("alt_back").innerHTML = "";
		el("alt_forward").innerHTML = "";
		el("alt_cancel").innerHTML = "";
	} else {
//		free_uri_pics(el("img_home"),el("img_back"),el("img_forward"),el("img_edit"),el("img_cancel"),el("img_save"),el("img_advanced"))
	}
	
	if (!debug || save_override)
		r = saveThisFile(computed_js);
	else r = false;
	document.body.style.cursor= "auto";
	
	refresh_menu_area();
	
	if (ie)
		create_alt_buttons();
//	else		setup_uri_pics(el("img_home"),el("img_back"),el("img_forward"),el("img_edit"),el("img_cancel"),el("img_save"),el("img_advanced"))
	return r;
}

// save this file
function saveThisFile(data)
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
	
	var offset = document.documentElement.innerHTML.search(/\/\* ]]> \*\/(\r\n|\n)<\/script>/i);
	
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
				if (old_version < 9) {	// apply compatibility changes to v0.9
					page_contents[pc] = page_contents[pc].replace(new RegExp("(\\[\\[|\\|)Special::Import wiki\\]\\]", "ig"), "$1Special:Import]]").replace(/\[\[([^\]\]]*?)(\|([^\]\]]+))?\]\]/g,
					function (str, $1, $2, $3) {
						if ($3.length)
							return "[["+$3+"|"+$1+"]]";
						else
							return str;
					});
					if (page_names[pc] == "Special::Edit Menu")
						page_names[pc] = "Special:Menu";
				}
				if (old_version >= 9)
					page_contents[pc] = _new_syntax_patch(page_contents[pc]);
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
			if (v<9)
				css += "/* since v0.9 */\nh1 { font-size: 23px; }\nh2 { font-size: 20px; }\nh3 { font-size: 17px; }\nh4 { font-size: 14px; }\ndiv.taglinks {\n	border: 1px solid #aaa;\n/*	background-color: #f9f9f9; */\n	padding: 5px;\n	margin-top: 1em;\n	clear: both;\n}\n\na.tag {\n color: navy;\n}\n";
			document.getElementsByTagName("style")[0].innerHTML = css;
		}
	}
	
	// import the variables
	var new_main_page = main_page;
	var block_edits = false;
	for(i=0;i<var_names.length;i++) {
		if (var_names[i] == "main_page_")
			new_main_page = (version!=2) ? unescape(var_values[i]) : var_values[i];
		else if (var_names[i] == "permit_edits")
			block_edits = (var_values[i]=="0");
	}
	if (page_exists(new_main_page))
		main_page = new_main_page;
	
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
			} else {
				page_titles[pi] = page_names[i];
				pages[pi] = page_contents[i];
			}
			pages_imported++;
		}
	}

	// remove hourglass
	document.body.style.cursor= "auto";
	
	alert("Import completed: " + pages_imported + " pages imported.");
	
	current = main_page;
	// save everything
	save_all();

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
		if (nls!=null && typeof(nls)=='object' && nls.length>20)
			logbox.value = "";
		logbox.value += aMessage + "\n";
	}
} else {
	function log(aMessage) { }
}

if (!ie)
	window.onresize = on_resize;

/*
if(ie)
	attachEvent("onload",on_load);
else
	addEventListener("load",on_load,false);
*/
// -->