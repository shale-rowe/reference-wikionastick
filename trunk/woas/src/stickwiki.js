
// page attributes bits are mapped to (readonly, encrypted, ...)

var end_trim = false;		// trim pages from the end

var forstack = [];			// forward history stack, discarded when saving
var cached_search = "";		// cached XHTML content of last search
var cfg_changed = false;	// true when configuration has been changed
var search_focused = false;	// true when a search box is currently focused
var _custom_focus = false;	// true when an user control is currently focused
var _prev_title = current;	// used when entering/exiting edit mode
var _decrypt_failed = false;	// the last decryption failed due to wrong password attempts (pretty unused)
var result_pages = [];			// the pages indexed by the last result page
var last_AES_page;				// the last page on which the cached AES key was used on
var current_namespace = "";		// the namespace(+subnamespaces) of the current page
var floating_pages = [];				// pages which need to be saved and are waiting in the queue
var _bootscript = null;					// bootscript
var _hl_reg = null;						// search highlighting regex

// Automatic-Save TimeOut object
woas["_asto"] = null;

// left and right trim
woas["trim"] = function(s) {
	return s.replace(/(^\s*)|(\s*$)/, '');
}

// general javascript-safe string quoting
// NOTE: not completely binary safe!
// should be used only for titles (which ought not to contain binary bytes)
woas["js_encode"] = function (s, split_lines) {
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
woas["xhtml_encode"] = function(src) {
	return this.utf8_encode(src.replace(/[<>&]+/g, function ($1) {
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
	}));
}

woas["utf8_encode"] = function(src) {
	return src.replace(/[^\u0000-\u007F]+/g, function ($1) {
		var l=$1.length;
		var s="";
		for(var i=0;i<l;i++) {
			s+="&#"+$1.charCodeAt(i)+";";
		}
		return s;
	});
}

// create a centered popup given some options
woas["popup"] = function (name,fw,fh,extra) {
	var hpos=Math.ceil((screen.width-fw)/2);
	var vpos=Math.ceil((screen.height-fh)/2);
	var wnd = window.open("about:blank",name,"width="+fw+",height="+fh+		
	",left="+hpos+",top="+vpos+extra);
	wnd.focus();
	return wnd;
}

//DANGER: will corrupt your WoaS!
var edit_override = false;

var reserved_namespaces = ["Special", "Lock", "Locked", "Unlocked", "Unlock", "Tags", "Tagged", "Include"];

// create the regex for reserved namespaces
var reserved_rx = "^";
for(var i = (edit_override ? 1 : 0);i<reserved_namespaces.length;i++) {
	reserved_rx += /*RegExp.Escape(*/reserved_namespaces[i] + "::";
	if (i<reserved_namespaces.length-1)
		reserved_rx += "|";
}
woas["_reserved_rx"] = new RegExp(reserved_rx, "i"); reserved_namespaces = reserved_rx = null;

woas["is_reserved"] = function(page) {
	return (page.search(this._reserved_rx)==0);
}

woas["is_menu"] = function(page) {
	return (page.indexOf("::Menu")==page.length-6);
}

// returns namespace with trailing ::
woas["get_namespace"] = function(page) {
	var p = page.lastIndexOf("::");
	if (p==-1) return "";
	return page.substring(0,p+2);	
}

woas["is_readonly"] = function(page) {
	return this.is_readonly_id(page_titles.indexOf(page));
}

woas["is_readonly_id"] = function(pi) {
	if (page_attrs[pi] & 1)
		return true;
	return false;
}

woas["is__encrypted"] = function (pi) {
	if (page_attrs[pi] & 2)
		return true;
	return false;
}

woas["is_encrypted"] = function(page) {
	return this.is__encrypted(page_titles.indexOf(page));
}

woas["is__embedded"] = function(pi) {
	if (page_attrs[pi] & 4)
		return true;
	return false;
}
woas["is_embedded"] = function(page) {return this.is__embedded(page_titles.indexOf(page));}

woas["is__image"] = function(pi) {
	if (page_attrs[pi] & 8)
		return true;
	return false;
}
woas["is_image"] = function(page) { return this.is__image(page_titles.indexOf(page)); }

// a page physically exists if it is not part of a reserved namespace, if it is not a (sub)namespace and if it actually exists
woas["page_exists"] = function(page) {
	return (this.is_reserved(page) || (page.substring(page.length-2)=="::") || (page_titles.indexOf(page)!=-1));
}

var	parse_marker = "#"+_random_string(8);

woas["_get_tags"] = function(text) {
	var tags = [];
	if (text.indexOf("Tag::")==0)
		tags.push(this.trim(text.substring(5)));
	else if (text.indexOf("Tags::")==0) {
		text = this.trim(text.substring(6));
		if (!text.length)
			return tags;
		var alltags;
		if (text.indexOf("|")!=-1)
			alltags = text.split("|");
		else
			alltags = text.split(",");
		for(var i=0;i<alltags.length;i++) {
			tags.push(this.trim(alltags[i]));
		}
	}
	return tags;
}

// joins a list of pages
woas["_join_list"] = function(arr) {
	if (!arr.length)
		return "";
	result_pages = arr.slice(0);
	return "* [["+arr.sort().join("]]\n* [[")+"]]";
}

woas["_simple_join_list"] = function(arr, sorted) {
	if (sorted)
		arr = arr.sort();
	// a newline is added here
	return arr.join("\n")+"\n";
}

// with two trailing double colon
woas["_get_namespace_pages"] = function (ns) {
	var pg = [];
	switch (ns) {
		case "Locked::":
			return "= Pages in "+ns+" namespace\n" + this.special_encrypted_pages(true);
		case "Unlocked::":
			return "= Pages in "+ns+" namespace\n" + this.special_encrypted_pages(false);
		case "Tagged::": // to be used in wiki source
		case "Tags::":
			return "= Pages in "+ns+" namespace\n" + this.special_tagged_pages(false);
	}

	for(var i=0;i<page_titles.length;i++) {
		if (page_titles[i].indexOf(ns)===0)
			pg.push(page_titles[i]);
	}
	return "= Pages in "+ns+" namespace\n" + this._join_list(pg);
}

woas["_get_tagged"] = function(tag) {
	var pg = [];

	var tmp;
	for(var i=0; i<pages.length; i++)
	{
		tmp = this.get_src_page(i);
		if (tmp==null)
			continue;
		tmp.replace(/\[\[([^\|]*?)\]\]/g, function(str, $1)
			{
				if ($1.search(/^\w+:\/\//)==0)
					return;
					
				found_tags = woas._get_tags($1);
				
//				alert(found_tags);
				
				for (var t=0;t<found_tags.length;t++) {
					if (found_tags[t] == tag)
						pg.push(page_titles[i]);
				}

				
			});
	}
	
	if (!pg.length)
		return "No pages tagged with *"+tag+"*";
	return "= Pages tagged with " + tag + "\n" + this._join_list(pg);
}

// return a plain page or a decrypted one if available through the latest key
woas["get_page"] = function(pi) {
	if (this.is__embedded(pi))
		return null;
	if (!this.is__encrypted(pi))
		return pages[pi];
	if (!key.length) {
		latest_AES_page = "";
		return null;
	}
	var pg = AES_decrypt(pages[pi].slice(0));	/*WARNING: may not be supported by all browsers*/
	last_AES_page = page_titles[pi];
	return pg;	
}

woas["get_src_page"] = function(pi) {
	var pg = this.get_page(pi);
	if (pg===null) return null;
	return _filter_wiki(pg);
}

woas["get_text"] = function (title) {
	var pi = page_titles.indexOf(title);
	if (pi==-1)
		return null;
	return this.get__text(pi);
}

//TODO: check consistency of special pages inclusion
woas["get_text_special"] = function(title) {
	var p = title.indexOf("::");
	var text = null;
	if (p!=-1) {
		var namespace = title.substring(0,p);
//		log("namespace of "+title+" is "+namespace);	// log:0
		title = title.substring(p+2);
		if (!title.length) return this._get_namespace_pages(namespace+"::");
		switch (namespace) {
			case "Special":
				text = this._get_special(title);
			break;
			case "Tagged": // deprecated
			case "Tags":
				text = this._get_tagged(title);
			break;
			default:
				text = this.get_text(namespace+"::"+title);
		}
	} else
		text = this.get_text(title);
	return text;
}

woas["get__text"] = function(pi) {
	// is the page encrypted or plain?
	if (!this.is__encrypted(pi))
		return pages[pi];
	document.body.style.cursor = "wait";
	_decrypt_failed = true;
	var retry = 0;		
	var pg = null;
	do {
		if (retry || !key.length) {
			//TODO: use form-based password input
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
		if (!this.config.key_cache)
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

woas["set__text"] = function(pi, text) {
	log("Setting wiki text for page #"+pi+" \""+page_titles[pi]+"\"");	// log:1
	if (this.is__embedded(pi) && !this.is__image(pi))
		text = encode64(text);
//	text = _new_syntax_patch(text);
	if (!this.is__encrypted(pi)) {
		pages[pi] = text;
		return;
	}
	pages[pi] = AES_encrypt(text);
	last_AES_page = page_titles[pi];
}

// Sets text typed by user
woas["set_text"] = function(text)
{
	var pi = page_titles.indexOf(current);
	if (pi==-1) {
		log("current page \""+current+"\" is not cached!");	// log:1
		return;
	}
	this.set__text(pi, text);
}

// triggered by UI graphic button
function page_print() {
	var wnd = woas.popup("print_popup", Math.ceil(screen.width*0.75),Math.ceil(screen.height*0.75),
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
	"<st"+"yle type=\"text/css\">"+css_payload+_css_obj().innerHTML+"</sty"+"le><scr"+"ipt type=\"text/javascript\">function go_to(page) { alert(\"Sorry, you cannot browse the wiki while in print mode\");}</sc"+"ript></h"+"ead><"+"body>"+
	$("wiki_text").innerHTML+"</bod"+"y></h"+"tml>\n");
	wnd.document.close();
}

woas["clear_search"] = function() {
	if (!cached_search.length)
		return;
	cached_search = "";
	this.assert_current("Special::Search");
}

woas["assert_current"] = function(page) {
	if( current != page )
		go_to( page ) ;
	else
		this.set_current( page );
}

woas["_create_page"] = function (ns, cr, ask) {
	if (this.is_reserved(ns+"::")) {
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
	log("Page "+cr+" added to internal array");	// log:1
	current = cr;
//	this.save_page(cr);	// do not save
	// proceed with a normal wiki source page
	this.edit_page(cr);
	return true;
}

woas["_get_embedded"] = function(cr, etype) {
	log("Retrieving embedded source "+cr);	// log:1
	var pi=page_titles.indexOf(cr);
	if (pi==-1) {
		return this.parser.parse("[[Include::Special::Embed|"+etype+"]]");
	}
	var text=this.get__text(pi);
	if (text==null) return text;
	var xhtml = "";
	var slash_c = (navigator.appVersion.indexOf("Win")!=-1)?"\\":"/";
	if (etype=="file") {
		var fn = cr.substr(cr.indexOf("::")+2);
		var pview_data = decode64(text, 1024), pview_link = "";
		var ext_size = Math.ceil((text.length*3)/4);
		if (ext_size-pview_data.length>10)
			pview_link = "<div id='_part_display'><em>Only the first 1024 bytes are displayed</em><br /><a href='javascript:show_full_file("+pi+")'>Display full file</a></div>";
		var _del_cmd;
		if (cr.indexOf("Special::")!=0) {
			_del_cmd = "function query_delete_file() {if (confirm('Are you sure you want to delete this file?')){delete_page('"+this.js_encode(cr)+"');back_or(main_page);woas.save_page('"+this.js_encode(cr)+"');}}\n";
			_del_lbl = "\n\n<a href=\"javascript:query_delete_file()\">Delete embedded file</a>\n";
		} else
			_del_lbl = _del_cmd = ""
		xhtml = "<pre id='_file_ct' class=\"embedded\">"+this.xhtml_encode(pview_data)+"</pre>"+
		pview_link+
		"<br /><hr />File size: "+_convert_bytes(ext_size)+"<br /><br />XHTML transclusion:"+
		this.parser.parse("\n{{{[[Include::"+cr+"]]}}}"+"\n\nRaw transclusion:\n\n{{{[[Include::"+cr+"|raw]]}}}"+
		_del_lbl+
		"\n<a href=\"javascript:query_export_file()\">Export file</a>\n"+
		"<sc"+"ript>"+_del_cmd
		+(pview_link.length?"function show_full_file(pi) { var text = this.get__text(pi); if (text==null) return; $.show('loading_overlay'); woas.setHTML($('_part_display'), ''); woas.setHTML($('_file_ct'), this.xhtml_encode(decode64(text))); $.hide('loading_overlay'); }\n":'')+
		"function query_export_file() {\nvar exp_path = _get_this_filename().replace(/\\"+slash_c+"[^\\"+
		slash_c+"]*$/, \""+(slash_c=="\\"?"\\\\":"/")+"\")+'"+this.js_encode(fn)+"';if (confirm('Do you want to export this file in the below specified path?'+\"\\n\\n\"+exp_path)){woas.export_file('"+this.js_encode(cr)+"', exp_path);}}"+
		"</sc"+"ript>"
		);
	} else {
		var img_name = cr.substr(cr.indexOf("::")+2);
		xhtml = this.parser.parse("= "+img_name+"\n\n"+
		"<img id=\"img_tag\" class=\"embedded\" src=\""+text+"\" alt=\""+this.xhtml_encode(img_name)+"\" />"+
		"\n\n<div id=\"img_desc\">Loading...</div>"+
		"<sc"+"ript>function _to_img_display() { var img=$('img_tag');\nwoas.setHTML($('img_desc'), 'Mime type: "+text.match(/^data:\s*([^;]+);/)[1]+"<br />File size: "+_convert_bytes(((text.length-(text.match(/^data:\s*[^;]*;\s*[^,]*,\s*/)[0]).length)*3)/4)+
		" (requires "+_convert_bytes(text.length)+" due to base64 encoding)"+
		"<br />Width: '+img.width+'px<br />Height: '+img.height+'px');} setTimeout('_to_img_display()', 0); function query_delete_image() {if (confirm('Are you sure you want to delete this image?')){delete_page('"+this.js_encode(cr)+"');back_or(main_page);woas.save_page('"+this.js_encode(cr)+"');}}\n"+
		"function query_export_image() {\nvar exp_path = _get_this_filename().replace(/\\"+slash_c+"[^\\"+
		slash_c+"]*$/, \""+(slash_c=="\\"?"\\\\":"/")+"\")+'"+this.js_encode(img_name)+"';if (confirm('Do you want to export this image in the below specified path?'+\"\\n\\n\"+exp_path)){woas.export_image('"+this.js_encode(cr)+"', exp_path);}}"+
		"</sc"+"ript>"+
		"\nSimple transclusion:\n\n{{{[[Include::"+cr+"]]}}}\n\nTransclusion with additional attributes:\n\n{{{[[Include::"+cr+"|border=\"0\" onclick=\"go_to('"+
		this.js_encode(cr)+"')\" style=\"cursor:pointer\"]]}}}\n"+
		"\n<a href=\"javascript:query_delete_image()\">Delete embedded image</a>\n"+
		"\n<a href=\"javascript:query_export_image()\">Export image</a>\n");
	}
	return xhtml;
}

woas["export_image"] = function(page, dest_path) {
	var pi=page_titles.indexOf(page);
	if (pi==-1)
		return false;
	var data=this.get__text(pi);
	if (data==null)
		return false;
	return this._b64_export(data, dest_path);
}

// save a base64 data: stream into an external file
woas["_b64_export"] = function(data, dest_path) {
	// decode the base64-encoded data
	data = decode64(data.replace(/^data:\s*[^;]*;\s*base64,\s*/, ''));
	// attempt to save the file
	_force_binary = true;
	var r = saveFile(dest_path, data);	
	_force_binary = false;
	return r;
}

woas["export_file"] = function(page, dest_path) {
	var pi=page_titles.indexOf(page);
	if (pi==-1)
		return false;
	var data=this.get__text(pi);
	if (data==null)
		return false;
	// attempt to save the file (binary mode)
	data = decode64(data);
	_force_binary = true;
	var r = saveFile(dest_path, data);	
	_force_binary = false;
	if (r)
		alert("Written "+data.length+" bytes");
	return r;
}

woas["_embed_process"] = function(etype) {
	var filename = $("filename_").value;
	if(filename == "") {
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
	
	ct = encode64(ct);
	
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
	this.save_to_file(true);
	
	this.refresh_menu_area();
	this.set_current(current);
	
	return true;
}

woas["_get_special"] = function(cr) {
	var text = null;
//	log("Getting special page "+cr);	// log:0
	switch(cr) {
		case "New page":
			var title = "";
			do {
				title = prompt("Insert new page title", title);
				if (title == null) break;
				if (!title.match(/\[\[/) && !title.match(/\]\]/))
					break;
				alert("Cannot use \"[[\" or \"]]\" in a page title");
			} while (1);
			if ((title!=null) && title.length) {
				if (page_titles.indexOf(title)!=-1)
					alert("A page with title \""+title+"\" already exists!");
				else {
					cr = title;
					if (cr.substring(cr.length-2)=="::") {
						alert("You cannot create a page as a namespace");
					} else {
						var p = cr.indexOf("::");
						if (p!=-1) {
							ns = cr.substring(0,p);
//							log("namespace of "+cr+" is "+ns);	// log:0
							cr = cr.substring(p+2);
						} else ns="";
						if (!this._create_page(ns, cr, false))
							return;
						var upd_menu = (cr=='Menu');
						if (!upd_menu && confirm("Do you want to add a link into the main menu?")) {
							var menu = this.get_text("::Menu");
							var p = menu.indexOf("\n\n");
							if (p==-1)
								menu += "\n[["+ns+cr+"]]";
							else
								menu = menu.substring(0,p)+"\n[["+title+"]]"+menu.substring(p);
							this.set__text(page_titles.indexOf("::Menu"), menu);
							upd_menu = true;
						}
						if (upd_menu)
							this.refresh_menu_area();
					}

				}
			}
			return;
		case "Search":
			text = this.get_text("Special::"+cr);
			break;
		case "Erase Wiki":
			if (erase_wiki()) {
				this.save_to_file(true);
				back_or(main_page);
			}
			return null;
		case "Main Page":
			go_to(main_page);
			return null;
		case "All Pages":
			text = this.special_all_pages();
			break;
		case "Orphaned Pages":
			text = this.special_orphaned_pages();
			break;
		case "Pages not yet created":
			text = this.special_dead_pages();
			break;
		case "Backlinks":
			text = this.special_links_here();
			break;
		case "Edit Menu":
			go_to("::Menu");
			this.edit_page(current);
			return null;
		case "Edit CSS":
			if (!this.config.permit_edits && !edit_override) {
				alert("This Wiki on a Stick is read-only");
				return null;
			}
			_servm_alert();
			this.current_editing("Special::"+cr, true);
			this.edit_ready(_css_obj().innerHTML);
			return null;
		case "Edit Bootscript":
			if (!this.config.permit_edits && !edit_override) {
				alert("This Wiki on a Stick is read-only");
				return null;
			}
			_servm_alert();
			cr = "Special::Bootscript";
			var tmp = this.get_text(cr);
			if (tmp == null)
				return;
			this.current_editing(cr, true);
			// setup the wiki editor textbox
			this.current_editing(cr, this.config.permit_edits | this._server_mode);
			this.edit_ready(decode64(tmp));
			return null;
		default:
			cr = "Special::" + cr;
			if (this.is_embedded(cr)) {
				text = this._get_embedded(cr, this.is_image(cr) ? "image":"file");
				if (text == null) {
					if (_decrypt_failed)
						_decrypt_failed = false;
					return;
				}
				this._add_namespace_menu("Special");
				
				this.load_as_current(cr, text);
				return;
			}
			text = this.get_text(cr);
			if(text == null) {
				if (edit_override) {
					this._create_page("Special", cr.substr(9), true);
					return null;
				}
				alert("Invalid special page.");
			}
	}
	return text;
}

// Load a new current page
woas["set_current"] = function (cr)
{
	var text, namespace;
	result_pages = [];
	// eventually remove the previous custom script
	this._clear_swcs();
	if (cr.substring(cr.length-2)=="::") {
		text = this._get_namespace_pages(cr);
		namespace = cr.substring(0,cr.length-2);
		cr = "";
	} else {
		var p = cr.indexOf("::");
		if (p!=-1) {
			namespace = cr.substring(0,p);
//			log("namespace of "+cr+" is "+namespace);	// log:0
			cr = cr.substring(p+2);
				switch (namespace) {
					case "Special":
						text = this._get_special(cr);
						if (text == null)
							return;
						break;
					case "Tagged": // deprecated
					case "Tags":
						text = this._get_tagged(cr);
						if (text == null)
							return;
						break;
					case "Lock":
						pi = page_titles.indexOf(cr);
						if (key.length) {
							if (confirm("Do you want to use the last password (last time used on page \""+latest_AES_page+"\") to lock this page \""+cr+"\"?")) {
								this._finalize_lock(pi);
								return;
							}
						}
						text = this.get_text("Special::Lock");
						break;
					case "Unlock":
						pi = page_titles.indexOf(cr);
						if (!confirm("Do you want to remove encryption for page \""+cr+"\"?"))
							return;
						text = this.get_text(cr);
						if (_decrypt_failed) {
							_decrypt_failed = false;
							return;
						}
						pages[pi] = text;
						page_attrs[pi] -= 2;
						if (!this.config.key_cache)
							AES_clearKey();
						this.set_current(cr);
						this.save_page(cr);
						return;
					case "File":
					case "Image":
						text = this._get_embedded(namespace+"::"+cr, namespace.toLowerCase());
						if(text == null) {
							if (_decrypt_failed)
								_decrypt_failed = false;
							return;
						}
						this._add_namespace_menu(namespace);
						if (namespace.length)
							cr = namespace + "::" + cr;
						this.load_as_current(cr, text);
						return;
						break;
					default:
						text = this.get_text(namespace+"::"+cr);
				}

		} else {
			namespace = "";
			text = this.get_text(cr);
		}
	}
	
	if(text == null)
	{
		if (_decrypt_failed) {
			_decrypt_failed = false;
			return;
		}
		if (!this._create_page(namespace, cr, true))
			return;
//		log("Editing new page "+namespace+cr);	// log:0
		return;
	}
	
	this._add_namespace_menu(namespace);
	if (namespace.length)
		cr = namespace + "::" + cr;
	this.load_as_current(cr, this.parser.parse(text));
}

woas["swcs"] = [];

woas["_clear_swcs"] = function () {
//	setHTML(swcs, "");
	if (!this.swcs.length) return;
	for(var i=0;i<this.swcs.length;i++) {
		document.getElementsByTagName("head")[0].removeChild(this.swcs[i]);
	}
	this.swcs = [];
}

woas["create_breadcrumb"] = function(title) {
	var tmp=title.split("::");
	if (tmp.length==1)
		return title;
	var s="", partial="";
	for(var i=0;i<tmp.length-1;i++) {
		partial += tmp[i]+"::";
		s += "<a href=\"#\" onclick=\"go_to('"+this.js_encode(partial)+"')\">"+tmp[i]+"</a> :: ";		
	}
	return s+tmp[tmp.length-1];
}

woas["_activate_scripts"] = function() {
	// add the custom scripts (if any)
	if (this.parser.script_extension.length) {
//		log(this.parser.script_extension.length + " javascript files/blocks to process");	// log:0
		var s_elem, is_inline;
		for (var i=0;i<this.parser.script_extension.length;i++) {
			s_elem = document.createElement("script");
			s_elem.type="text/javascript";
			s_elem.id = "sw_custom_script_"+i;
			is_inline = new String(typeof(this.parser.script_extension[i]));
			is_inline = (is_inline.toLowerCase()=="string");
			if (!is_inline)
				s_elem.src = this.parser.script_extension[i][0];
			document.getElementsByTagName("head")[0].appendChild(s_elem);
			if (is_inline)
				woas.setHTML(s_elem, this.parser.script_extension[i]);
			this.swcs.push(s_elem);
		}
	}
}

woas["_set_title"] = function (new_title) {
	var wt=$("wiki_title");
	// works with IE6, FF, etc.
	wt.innerHTML = this.create_breadcrumb(new_title);
	document.title = new_title;
}

// actually load a page given the title and the proper XHTML
woas["load_as_current"] = function(title, xhtml) {
	scrollTo(0,0);
	log("load_as_current(\""+title+"\") - "+xhtml.length+" bytes");	// log:1
	$("wiki_text").innerHTML = xhtml;
	this._set_title(title);
	this.update_nav_icons(title);
	current = title;
	this._activate_scripts();
}

woas["_finalize_lock"] = function(pi) {
	this._perform_lock(pi);
	var title = page_titles[pi];
	this.set_current(title);
	if (!this.config.key_cache) {
		AES_clearKey();
		latest_AES_page = "";
	} else
		last_AES_page = title;
	this.save__page(pi);
}

woas["_perform_lock"] = function(pi) {
	pages[pi] = AES_encrypt(pages[pi]);
//	log("E: encrypted length is "+pages[pi].length);	// log:0
	page_attrs[pi] += 2;
}

var _pw_q_lock = false;

// Used by Special::Lock
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
	var pw=$('pw1').value;

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
		log("pwstrength = "+_number_format(pwstrength/100, 2)+", repco = "+repco);	// log:1
	} else
		var pwstrength = 0;
  
	if (pwstrength>100)
		color = "#00FF00";
	else
		color = "#" + _hex_col((100-pwstrength)*255/100) + _hex_col((pwstrength*255)/100) + "00";
  
	$("pw1").style.backgroundColor = color;
	$("txtBits").innerHTML = "Key size: "+(pwlength*8).toString() + " bits";
	
	_pw_q_lock = false;
}

woas["_add_namespace_menu"] = function(namespace) {
//	log("adding namespace menu for \""+namespace+"\"");	// log:0
//	log("current namespace is \""+current_namespace+"\"");	// log:0
	if (current_namespace == namespace)
		return;
	var pi;
	if (namespace == "")
		pi = -1;
	else
		pi = page_titles.indexOf(namespace+"::Menu");
	if (pi==-1) {
//		log("no namespace menu found");	// log:0
		$("ns_menu_area").innerHTML = "";
		if (current_namespace!="") {
			$.hide("ns_menu_area");
			$.hide("ns_menu_edit_button");
		}
		current_namespace = namespace;
		return;
	}
	var menu = this.get__text(pi);
	if (menu == null) {
//		log("Could not retrieve namespace menu");	// log:0
		$("ns_menu_area").innerHTML = "";
	} else {
//		log("Parsing "+menu.length+" bytes for namespace menu");	// log:0
		$("ns_menu_area").innerHTML = this.parser.parse(menu);
	}
	// if the previous namespace was empty, then show the submenu areas
//	if (current_namespace=="") {
		$.show("ns_menu_area");
		$.show("ns_menu_edit_button");
//	}
	current_namespace = namespace;	
}

woas["refresh_menu_area"] = function() {
	var tmp = current_namespace;
	current_namespace=parse_marker;
	this._add_namespace_menu(tmp);
	var menu = this.get_text("::Menu");
	if (menu == null)
		$("menu_area").innerHTML = "";
	else {
		$("menu_area").innerHTML = this.parser.parse(menu);
		this._activate_scripts();
	}
}

woas["_gen_display"] = function(id, visible, prefix) {
	if (visible)
		$.show(prefix+"_"+id);
	else
		$.hide(prefix+"_"+id);
}

woas["img_display"] = function(id, visible) {
	if (!ie) {
		this._gen_display(id, visible, "img");
		this._gen_display(id, !visible, "alt");
	} else {
		this._gen_display(id, !visible, "img");
		this._gen_display(id, visible, "alt");
	}
}

woas["menu_display"] = function(id, visible) {
	this._gen_display(id, visible, "menu");
//	log("menu_"+id+" is "+$("menu_"+id).style.display);
}

function _auto_saver() {
	if (floating_pages.length && !kbd_hooking) {
		this.save_to_file(true);
		this.menu_display("save", false);
	}
	if (_this.config.auto_save)
		woas._asto = setTimeout("_auto_saver()", woas.config.auto_save);
}

// save configuration on exit
woas["before_quit"] = function () {
	if (floating_pages.length)
		this.save_to_file(true);
	else {
		if (this.config.save_on_quit && cfg_changed)
			this.save_to_file(false);
	}
	return true;
}

woas["setHTML"] = woas["getHTML"] = null;

// when the page is loaded - onload, on_load
woas["after_load"] = function() {
	log("***** Woas v"+this.version+" started *****");	// log:1
	
	document.body.style.cursor = "auto";
	
	if (ie) {	// some hacks for IE
		this.setHTML = function(elem, html) {elem.text = html;};
		this.getHTML = function(elem) {return elem.text};
		var obj = $("sw_wiki_header");
		obj.style.filter = "alpha(opacity=75);";
		if (ie6) {
			$("sw_wiki_header").style.position = "absolute";
			$("sw_menu_area").style.position = "absolute";
		}
	} else {
		this.setHTML = function(elem, html) {elem.innerHTML = html;};
		this.getHTML = function(elem) {return elem.innerHTML;};
//		setup_uri_pics($("img_home"),$("img_back"),$("img_forward"),$("img_edit"),$("img_cancel"),$("img_save"),$("img_advanced"));
//		_css_obj().innerHTML+="\na {  cursor: pointer;}";
	}
	
	$('a_home').title = main_page;
	$('img_home').alt = main_page;
	
	if (this.debug)
		$.show("debug_info");
	else
		$.hide("debug_info");

	this.img_display("back", true);
	this.img_display("forward", true);
	this.img_display("home", true);
	this.img_display("edit", true);
	this.img_display("print", true);
	this.img_display("advanced", true);
	this.img_display("cancel", true);
	this.img_display("save", true);
	this.img_display("lock", true);
	this.img_display("unlock", true);
	
	// customized keyboard hook
	document.onkeydown = kbd_hook;

	// Go straight to page requested
	var qpage=document.location.href.split("?")[1];
	if(qpage)
		current = unescape(qpage);
		
//	this.swcs = $("sw_custom_script");

	this.set_current(current);
	this.refresh_menu_area();
	this.disable_edit();
	
	if (this.config.permit_edits)
		$.show("menu_edit_button");
	else
		$.hide("menu_edit_button");
	
	if (this.config.cumulative_save && this.config.auto_save)
		this._asto = setTimeout("_auto_saver(woas)", this.config.auto_save);
	
	this._create_bs();
	
	this["_editor"] = new TextAreaSelectionHelper($("wiki_editor"));
	
	$.hide("loading_overlay");
}

woas["_create_bs"] = function() {
	var s=this.get_text("Special::Bootscript");
	if (s==null || !s.length) return false;
	// remove the comments
	s = decode64(s).replace(/^\s*\/\*(.|\n)*?\*\/\s*/g, '');
	if (!s.length) return false;
	_bootscript = document.createElement("script");
	_bootscript.type="text/javascript";
	_bootscript.id = "woas_bootscript";
	document.getElementsByTagName("head")[0].appendChild(_bootscript);
	this.setHTML(_bootscript, s);
	return true;
}

woas["_clear_bs"] = function() { if (_bootscript!=null) document.getElementsByTagName("head")[0].removeChild(_bootscript); }

function ff_fix_focus() {
//runtime fix for Firefox bug 374786
	if (firefox)
		$("wiki_text").blur();
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
woas["_onresize"] = function() {
	$("wiki_editor").style.width = window.innerWidth - 30 + "px";
	$("wiki_editor").style.height = window.innerHeight - 150 + "px";
}

if (!ie)
	window.onresize = woas._onresize;

woas["update_nav_icons"] = function(page) {
	this.menu_display("back", (backstack.length > 0));
	this.menu_display("forward", (forstack.length > 0));
	this.menu_display("advanced", (page != "Special::Advanced"));
	this.menu_display("edit", this.edit_allowed(page));
	this.update_lock_icons(page);
}

woas["update_lock_icons"] = function(page) {
	var cyphered, can_lock, can_unlock;
	if (result_pages.length<2) {
		var pi = page_titles.indexOf(page);
		if (pi==-1) {
			can_lock = can_unlock = false;
			cyphered = false;
		} else {
			can_unlock = cyphered = this.is__encrypted(pi);
			can_lock = !can_unlock && this.config.permit_edits;
		}
	} else {
		log("result_pages is ("+result_pages+")");	// log:1
		can_lock = can_unlock = (result_pages.length>0);
		cyphered = false;
	}
	
	this.menu_display("lock", !kbd_hooking && can_lock);
	this.menu_display("unlock", !kbd_hooking && can_unlock);
	var cls;
	if (cyphered || (page.indexOf("Locked::")==0))
		cls = "text_area locked";
	else
		cls = "text_area";
	$("wiki_text").className = cls;
}

// Adjusts the menu buttons
woas["disable_edit"] = function() {
//	log("DISABLING edit mode");	// log:0
	kbd_hooking = false;
	// check for back and forward buttons - TODO grey out icons
	this.update_nav_icons(current);
	this.menu_display("home", true);
	if (this.config.cumulative_save)
		this.menu_display("save", floating_pages.length!=0);
	else
		this.menu_display("save", false);
	this.menu_display("cancel", false);
	this.menu_display("print", true);
	$.show("text_area");
	$.hide("edit_area");
//	log("setting back title to "+_prev_title);	// log:0
	this._set_title(_prev_title);
}

function _lock_pages(arr) {
	alert("Not yet implemented");
}

function _unlock_pages(arr) {
	alert("Not yet implemented");
}

woas["edit_allowed"] = function(page) {
	if (edit_override)
		return (page_titles.indexOf(page) != -1);
	if (!this.config.permit_edits)
		return false;
	if (this.is_reserved(page))
		return false;
	return !this.is_readonly(page);
}

// setup the title boxes and gets ready to edit text
woas["current_editing"] = function(page, disabled) {
	log("current_editing(\""+page+"\", disabled: "+disabled+")");	// log:1
	_prev_title = current;
	$("wiki_page_title").disabled = (disabled ? "disabled" : "");
	$("wiki_page_title").value = page;
	this._set_title("Editing "+page);
	// current must be set BEFORE calling enabling menu edit
//	log("ENABLING edit mode");	// log:0
	kbd_hooking = true;
	this.menu_display("back", false);
	this.menu_display("forward", false);
	this.menu_display("advanced", false);
	this.menu_display("home", false);
	this.menu_display("edit", false);
	this.menu_display("print", false);
	this.menu_display("save", true);
	this.menu_display("cancel", true);
	this.update_lock_icons(page);
	$.hide("text_area");

	// FIXME!
	if (!ie)	{
		$("wiki_editor").style.width = window.innerWidth - 30 + "px";
		$("wiki_editor").style.height = window.innerHeight - 150 + "px";
	}
	
	$.show("edit_area");

	$("wiki_editor").focus();
	current = page;
	scrollTo(0,0);
}

// sets the text and allows changes monitoring
woas["edit_ready"] = function (txt) {
	$("wiki_editor").value = txt;
	this._editor_changed = false;
}

function _servm_alert() {
	if (woas._server_mode)
		alert("You are using Wiki on a Stick on a REMOTE server, your changes will not be saved neither remotely or locally.\n\nThe correct usage of Wiki on a Stick is LOCAL, so you should use a local copy of this page to exploit the save features. All changes made to this copy of Wiki on a Stick will be lost.");
}

woas["edit_page"] = function(page) {
	if (!this.edit_allowed(page)) {
		log("Not allowed to edit page "+page);	// log:1
		return;
	}
	_servm_alert();
	var tmp = this.get_text(page);
	if (tmp===null) return;
	if (this.is_embedded(page) && !this.is_image(page))
		tmp = decode64(tmp);
	// setup the wiki editor textbox
	this.current_editing(page, this.is_reserved(page));
	this.edit_ready(tmp);
}

woas["rename_page"] = function(previous, newpage) {
	log("Renaming "+previous+" to "+newpage);	// log:1
	if (newpage.match(/\[\[/) || newpage.match(/\]\]/)) {
		alert("Cannot use \"[[\" or \"]]\" in a page title");
		return false;
	}
	if (page_titles.indexOf(newpage)!=-1) {
		alert("A page with title \""+newpage+"\" already exists!");
		return false;
	}
	var pi = page_titles.indexOf(previous);
	page_titles[pi] = newpage;
	var re = new RegExp("\\[\\[" + RegExp.escape(previous) + "(\\]\\]|\\|)", "gi");
	var changed;
	for(var i=0; i<pages.length; i++)
	{
		//FIXME: should not replace within the nowiki blocks!
		var tmp = this.get_page(i);
		if (tmp==null)
			continue;
		changed = false;
		tmp = tmp.replace(re, function (str) {
			changed = true;
			return "[["+newpage+str.substring(previous.length+2);
		});
		if (changed)
			this.set__text(i, tmp);
	}
	if (previous == main_page)
		main_page = newpage;
	if (_prev_title == previous)
		_prev_title = newpage;
	return true;
}

// when a page is deleted
function delete_page(page) {
	for(var i=0; i<pages.length; i++) {
		if (page_titles[i] == page) {
			log("DELETED page "+page);	// log:1
			page_titles.splice(i,1);
			pages.splice(i,1);
			page_attrs.splice(i,1);
			woas.refresh_menu_area();
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

function _css_obj() {
	return document.getElementsByTagName("style")[0];
}

// when save is clicked
woas["save"] = function() {
	if (this.config.cumulative_save && !kbd_hooking) {
		this.save_to_file(true);
		this.menu_display("save", false);
		return;
	}
	switch(current) {
		case "Special::Edit CSS":
			this.setHTML(_css_obj(), $("wiki_editor").value);
			back_to = null;
			current = "Special::Advanced";
			$("wiki_page_title").disabled = "";
			break;
		default:
			// check if text is empty
			if($("wiki_editor").value == "") {
				if(confirm("Are you sure you want to DELETE this page?"))
				{
					var deleted = current;
					delete_page(current);
					this.disable_edit();
					back_or(main_page);
					this.save_page(deleted);
				}
				return;
			} else {
				// here the page gets actually saved
				this.set_text($("wiki_editor").value);
				new_title = woas.trim($("wiki_page_title").value);
				if (this.is_menu(new_title)) {
					this.refresh_menu_area();
					back_to = _prev_title;
				} else { if (!this.is_reserved(new_title) && (new_title != current)) {
						if (!this.rename_page(current, new_title))
							return false;
					}
					back_to = new_title;
				}				
			}
	}
	var saved = current;
	if (back_to != null)
		this.set_current(back_to);
	else // used for CSS editing
		back_or(main_page);
	this.refresh_menu_area();
	this.disable_edit();
	if (this._editor_changed)
		this.save_page(saved);
}

// push a page into history
function history_mem(page) {
	if (backstack.length>6)
		backstack = backstack.slice(1);
	backstack.push(page);
}

function printout_arr(arr, split_lines) {

	function elem_print(e) {
		return "'" + woas.js_encode(e, split_lines) + "'";
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
		return "'" + woas.js_encode(e, split_lines) + "'";
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

woas["save_page"] = function(page_to_save) {
	log("Saving modified page \""+page_to_save+"\"");	// log:1
	this.save__page(page_titles.indexOf(page_to_save));
}

woas["save__page"] = function(pi) {
	//this is the dummy function that will allow more efficient file saving in future
	if (this.config.cumulative_save) {
		if (!floating_pages.length) {
			floating_pages.push(pi);
			this.menu_display("save", true);
		} else {
			if (floating_pages.indexOf(pi)==-1)
				floating_pages.push(pi);
		}
		log("floating_pages = ("+floating_pages+")");	// log:1
		return;
	}
	this.save_to_file(true);
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

woas["save_to_file"] = function(full) {
	$.show("loading_overlay");
	
	var new_marker;
	if (full) {
		new_marker = _inc_marker(__marker);
	} else new_marker = __marker;
	
	// setup the page to be opened on next start
	var safe_current;
	if (this.config.open_last_page) {
		if (!this.page_exists(current)) {
			safe_current = main_page;
		} else safe_current = current;
	} else
		safe_current = main_page;
	
	// output the javascript header and configuration flags
	var computed_js = "\n/* <![CDATA[ */\n\n/* "+new_marker+"-START */\n\nvar woas = {\"version\": \""+this.version+
	"\"};\n\nvar __marker = \""+new_marker+"\";\n\nwoas[\"config\"] = {";
	for (param in this.config) {
		computed_js += "\n\""+param+"\":";
		if (typeof(this.config[param])=="boolean")
			computed_js += (this.config[param] ? "true" : "false")+",";
		else // for numbers
			computed_js += this.config[param]+",";
	}
	computed_js = computed_js.substr(0,computed_js.length-1);
	computed_js += "};\n";
	
	computed_js += "\nvar current = '" + this.js_encode(safe_current)+
	"';\n\nvar main_page = '" + this.js_encode(main_page) + "';\n\n";
	
	computed_js += "var backstack = [\n" + printout_arr(backstack, false) + "];\n\n";

	computed_js += "var page_titles = [\n" + printout_arr(page_titles, false) + "];\n\n";
	
	computed_js += "/* " + new_marker + "-DATA */\n";
	
	if (full) {
		computed_js += "var page_attrs = [" + printout_num_arr(page_attrs) + "];\n\n";
		
		computed_js += "var pages = [\n" + printout_mixed_arr(pages, this.config.allow_diff, page_attrs) + "];\n\n";
		
		computed_js += "/* " + new_marker + "-END */\n";
	}

	// cleanup the DOM before saving
	var bak_ed = $("wiki_editor").value;
	var bak_tx = $("wiki_text").innerHTML;
	var bak_mn = $("menu_area").innerHTML;

	$("wiki_editor").value = "";
	$("wiki_text").innerHTML = "";
	$("menu_area").innerHTML = "";

	this._clear_swcs();
	this._clear_bs();
	
	var data = _get_data(__marker, document.documentElement.innerHTML, full);

	var r=false;
//	if (!this.config.server_mode || (was_local && this.config.server_mode)) {
	if (!this._server_mode)
		r = _saveThisFile(computed_js, data);
//		was_local = false;
//	}
	
	if (r) {
		cfg_changed = false;
		floating_pages = [];
	}
	
	$("wiki_editor").value = bak_ed;
	$("wiki_text").innerHTML = bak_tx;
	$("menu_area").innerHTML = bak_mn;
	
	this._create_bs();
	
	$.hide("loading_overlay");
	
	return r;
}

function erase_wiki() {
	if (!woas.config.permit_edits) {
		alert("This Wiki on a Stick is read-only");
		return false;
	}
	if (!confirm("Are you going to ERASE all your pages?"))
		return false;
	if (!confirm("This is the last confirm needed in order to ERASE all your pages.\n\nALL YOUR PAGES WILL BE LOST\n\nAre you sure you want to continue?"))
		return false;
	var static_pg = ["Special::About", "Special::Advanced", "Special::Options","Special::Import",
						"Special::Lock","Special::Search","Special::Security", "Special::Embed",
						"Special::Export", "Special::License" ];
	var backup_pages = [];
	page_attrs = [0, 0, 4];
	for(var i=0;i<static_pg.length;i++) {
		var pi = page_titles.indexOf(static_pg[i]);
		if (pi==-1) {
			alert(static_pg[i]+" not found!");
			return false;
		}
		backup_pages.push(pages[pi]);
		page_attrs.push(0);
	}
	page_titles = ["Main Page", "::Menu", "Special::Bootscript"];
	page_titles = page_titles.concat(static_pg);
	pages = ["This is your empty main page", "[[Main Page]]\n\n[[Special::New page]]\n[[Special::Backlinks]]\n[[Special::Search]]", encode64("/* insert here your boot script */")];
	pages = pages.concat(backup_pages);
	current = main_page = "Main Page";
	woas.refresh_menu_area();
	backstack = [];
	forstack = [];	
	return true;
}

// globla function
function _get_this_path() {
	var slash_c = (navigator.appVersion.indexOf("Win")!=-1)?"\\\\":"/";
	return _get_this_filename().replace(new RegExp("("+slash_c+")"+"[^"+slash_c+"]*$"), "$1");
}

var max_keywords_length = 250;
var max_description_length = 250;

// proper autokeywords generation functions begin here

function sortN(a,b){return b.w - a.w}

//TODO: have Special::Common Words contain all the common words
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

woas["xhtml_to_text"] = function(s) {
	return s.replace(/<br\s?\/?>/g, "\n").replace(/<\/?\w+[^>]*>/g, ' ').replace(/&#?([^;]+);/g, function(str, $1) { if (!isNaN($1)) return String.fromCharCode($1); else return ""; });
}
