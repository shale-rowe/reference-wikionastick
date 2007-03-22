<!--
/*** stickwiki.js ***/

var debug = true;            // won't save if it's true
var save_override = false;
var edit_override = true;
var forstack = new Array();

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
	return (is_special(page) || (page_index(page)!=-1));
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

// Parse typed code into HTML
function parse(text)
{
	if (text == null) {
		log("text = null while parsing current = "+current);
		return;
	}
	var prefmt = new Array();
	// put away stuff contained in <pre> tags
	text = text.replace(/<pre>(.*?)<\/pre>/g, function (str, $1) {
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
		tag = "<";
		if ($2=="E")
			tag += "/";
		tag += $1+">";
		return tag;
	});
	
	// headers
	text = text.replace(/(^|\n)!([^!].*)/g, "<h2>$2<\/h2>");
	text = text.replace(/(^|\n)!!([^!].*)/g, "<h3>$2<\/h3>");
	text = text.replace(/(^|\n)!!!(.*)/g, "<h4>$2<\/h4>");
	
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
				if($2.match("://"))
					return "<a class=\"world\" href=\"" + $2 + "\" target=\"_blank\">" + $1 + "<\/a>";
				if(page_exists($2))
					return "<a class=\"link\" onclick='go_to(\"" + $2 +"\")'>" + $1 + "<\/a>";
				else
					return "<a class=\"unlink\" onclick='go_to(\"" + $2 +"\")'>" + $1 + "<\/a>";
			}); //"<a class=\"wiki\" onclick='go_to(\"$2\")'>$1<\/a>");
	// without |
	text = text.replace(/\[\[([^\|]*?)\]\]/g, function(str, $1)
			{
				if($1.match("://"))
					return "<a class=\"world\" href=\"" + $1 + "\" target=\"_blank\">" + $1 + "<\/a>";
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
	text = text.replace(/\n/g, "<br />");
	//FIXME!
	if (ie)	{
		text = escape(text);
		text = text.replace("%OD%OA", "<br />");
		text = unescape(text);
	}
	
	if (prefmt.length>0) {
		text = text.replace(new RegExp("<\!-- "+parse_marker+"(\d+) -->", "g"), function (str, $1) {
			return prefmt[$1];
		});
		prefmt = new Array();
	}
	
	return text;
}

// Gets text typed by user
function get_text(title)
{
	for(i=0; i<page_titles.length; i++) {
		if(page_titles[i].toUpperCase() == title.toUpperCase())
			return pages[i];
	}
	return null;
}

// Sets text typed by user
function set_text(text)
{
	for(i=0;i<page_titles.length; i++) {
		if(page_titles[i].toUpperCase() == current.toUpperCase()) {
			pages[i] = text;
			break;
		}
	}
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
	for (var r, p, pg = [], plist= [], j= pages.length; j--;) {

	pages[j].replace(/\[\[([^\]\]]*?)(\|(.+))?\]\]/g,
        function (str, $1, $2, $3) {
          if (!(p = $3 || $1).match("://") && !page_exists(p))
            plist[pg[pg.length] = p] ?
plist[p].push(page_titles[j]) : (plist[p] = [page_titles[j]]);
        }
	);
	}

  dead_pages = '';
  for (p in pg.sort() ) {
    plist[p = pg[p]].sort ();
    dead_pages += '+ [[' + p + ']]' + ((plist[p].length > 1) ?
      '\n++ [[' + plist[p].join (']]\n++ [[') + ']]\n' : ' on [[' +
plist[p][0] + ']]\n');
  }
  if (dead_pages == '')
	return '<i>No dead pages</i>';
  return pages; 
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
			if (is_special(page_titles[i]))
				continue;
			if( (pages[i].toUpperCase().indexOf("[[" + page_titles[j].toUpperCase() + "]]") != -1)
				|| (pages[i].toUpperCase().indexOf("|" + page_titles[j].toUpperCase() + "]]") != -1)
				) {
					log("Page \""+page_titles[j]+"\" linked from page \""+page_titles[i]+"\"");
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
	if (is_special(current))
		return null;
	var pg = new Array();
	for(j=0; j<pages.length; j++)
	{
		// search for pages that link to it
		if(	(pages[j].toUpperCase().indexOf("[[" + current.toUpperCase() + "]]")!=-1) ||
				(pages[j].toUpperCase().indexOf("|" + current.toUpperCase() + "]]") != -1)
				) {
					pg.push("[["+page_titles[j]+"]]");
		}
	}
	if(pg.length == 0)
		return "/No page links here/";
	else
		return "!!Links to "+current+"\n"+pg.sort().join("\n");
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
	save_all();
	back_or(main_page);
}

function is_special(page) {
	return (page.search(/Special::/i)==0);
}

// Load a new current page
function set_current(cr)
{
	var text;
	log("Setting \""+cr+"\" as current page");
	if(is_special(cr))
	{
		switch(cr)
		{
			case "Special::Erase Wiki":
				if (erase_wiki()) {
					save_all();
					back_or(main_page);
				}
				return;
			case "Special::Main Page":
				go_to(main_page);
				return;
			case "Special::All Pages":
				text = special_all_pages();
				break;
			case "Special::All Special Pages":
				text = special_all_special_pages();
				break;
			case "Special::Orphaned Pages":
				text = special_orphaned_pages();
				break;
			case "Special::Pages not yet created":
				text = special_dead_pages();
				break;
			case "Special::Backlinks":
				text = special_links_here();
				break;
			case "Special::Block Edits":
				alert("Block edit currently disabled!");
				//block_edits(current);
				return;
			case "Special::Edit Menu":
				go_to("Special::Menu");
				edit();
				return;
			case "Special::Edit CSS":
				current_editing(cr, true);
				el("wiki_editor").value = document.getElementsByTagName("style")[0].innerHTML;
				return;
			default:
				text = get_text(cr);
				if(text == null) {
					alert("Invalid special page.");
					return;
				}
		}
	}
	else
		text = get_text(cr);
	
	if(text == null)
	{
		if(confirm("Page not found. Do you want to create it?"))
		{
			pages.push("Insert text here");
			page_titles.push(cr);
			edit_page(cr);
//			save_page(cr);
		}
		return;
	}
	
	current = cr;
	refresh_menu_area();
	el("wiki_title").innerHTML = cr;
	el("wiki_text").innerHTML = parse(text);
	document.title = cr;
	if(document.getElementById("lastDate"))
		document.getElementById("lastDate").innerHTML = document.lastModified;
	menu_editing(false);
}

function refresh_menu_area() {
/*
	var bl_src = "\n\n[[Special::Backlinks]]";
	if (is_special(current)) {
		pre_src = "";
		post_src = bl_src;
	} else {
		post_src = "";
		pre_src = bl_src;
	}	*/
	el("menu_area").innerHTML = parse(get_text("Special::Menu")/*+pre_src)+post_src*/);
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

// when the page is loaded
function on_load()
{
	log("***** StickWiki started *****");
	
	document.body.style.cursor = "auto";
	
	if(debug == true)
		el("debug_info").style.display = "block";
		
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
}

function ff_fix_focus() {
//runtime fix for Firefox bug 374786
	if (firefox)
		el("wiki_text").blur();
}

var kbd_hooking=false;

function kbd_hook(orig_e)
{
	if (!orig_e)
		e = window.event;
	else
		e = orig_e;
		
	if (!kbd_hooking) {
		if ((e.keyCode==8) || (e.keyCode==27)) {
			go_back();
			ff_fix_focus();
			return false;
		}
		return orig_e;
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

// Adjusts the menu buttons
function menu_editing(editing)
{
	kbd_hooking = editing;
	if (!editing) {
			// check for back and forward buttons - TODO grey out icons
			menu_display("back", (backstack.length > 0));
			menu_display("forward", (forstack.length > 0));
			menu_display("advanced", (current != "Special::Advanced"));
			menu_display("home", true);
			menu_display("edit", !is_special(current) && (edit_allowed(current)));
			menu_display("save", false);
			menu_display("cancel", false);
			el("text_area").style.display = "block";
			el("edit_area").style.display = "none";
	} else {
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

	}
}

function edit_menu() {
	edit_page("Special::Menu");
}

function about() {
	go_to("Special::About");
}

// when edit is clicked
function edit()
{
	edit_page(current);
}

function edit_allowed(page) {
	if (edit_override)
		return true;
	if (!permit_edits)
		return false;
	if (is_special(page) && (page!="Special::Menu"))
		return false;
	return true;
}

// setup the title boxes and gets ready to edit text
function current_editing(page, disabled) {
	el("edit_page_title").disabled = (disabled ? "disabled" : "");
	el("edit_page_title").value = page;
	el("wiki_title").innerHTML = page;
	document.title = page;
	current = page;
	// current must be set BEFORE calling menu_editing
	menu_editing(true);
	el("wiki_editor").focus();
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
			page_titles.splice(i,1);
			pages.splice(i,1);
			save_all();
			break;
		}
	}
}

// when save is clicked
function save()
{
	switch(current)
	{
		case "Special::Edit CSS":
			document.getElementsByTagName("style")[0].innerHTML = el("wiki_editor").value;
			set_current(main_page);
			el("edit_page_title").disabled = "";
			break;
		default:
			// check if text is empty
			if(el("wiki_editor").value == "")
			{
				if(confirm("Are you sure you want to DELETE this page?"))
				{
					delete_page(current);
					back_or(main_page);
				}
				return;
			}
			else
			{
				// here the page gets actually saved
				set_text(el("wiki_editor").value);
				if(el("wiki_page_title").value != current)
					rename_page(current, el("wiki_page_title").value);
				set_current(el("wiki_page_title").value);
			}
	}
	menu_editing(false);
	save_page(current);
}

// when cancel is clicked
function cancel()
{
//	if(confirm("Are you sure you want to cancel this edit?")) 
	if (kbd_hooking)
	{
		menu_editing(false);
		return true;
	} 
	// TODO - when Editing CSS and canceling, title gets Edit CSS
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

// follows a link
function go_to(cr)
{
	if(cr == current)
		return;
	backstack.push(current);
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
		backstack.push(current);
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
	// and fix also the > 128 ascii chars
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
	return save_all();
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
	filename = filename.replace(/ /g, " ");
	filename = filename.replace(/#.*/g, "");
	if(navigator.appVersion.indexOf("Win")!=-1)
		filename = filename.replace(/\//g, "\\");
	else
		filename = "/" + filename;
	
	var offset = document.documentElement.innerHTML.search(/\/\* ]]> \*\/(\r\n|\n)<\/script>/i);
	if (offset==-1) {
		alert("Head offset not found, using "+navigator.appName);
		return;
	}
	
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
	var pg_advanced = get_text("Special::Advanced");
	var pg_import = get_text("Special::Import");
	page_titles = new Array("Main Page", "Special::Menu", "Special::Advanced", "Special::Import");
	pages = new Array("This is your empty main page", "[[Main Page]]\n\n[[Special::Advanced]]", pg_advanced, pg_import);
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
		if(ct.match("<div id=\""+escape("Special::Advanced")+"\">"))
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
				if (old_version < 9)
					page_contents[pc] = page_contents[pc].replace(new RegExp("(\\[\\[|\\|)Special::Import wiki\\]\\]", "ig"), "$1Special::Import]]");
				pc++;
			}
			);

	// add new data
	var pages_imported = 0;
	
	//TODO: import the variables and the CSS from v0.04
	if (old_version==4) {
		var css = null;
		ct.replace(/\<style.*?type=\"text\/css\".*?\>((\n|.)*?)\<\/style\>/, function (str, $1) {
			css = $1;
		});
		if (css!=null) {
			log("Imported "+css.length+" bytes of CSS");
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
		if (!is_special(page_names[i]) || (page_names[i] == "Special::Menu"))
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
	// save everything
	save_all();

	back_or("Special::Import");
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
		if (nls!=null && typeof(nls)=='object' && nls.length>6)
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