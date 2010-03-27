
// page attributes bits are mapped to (readonly, encrypted, ...)

//var end_trim = false;		// trim pages from the end

var forstack = [];			// forward history stack, discarded when saving
var cached_search = "";		// cached XHTML content of last search
var cfg_changed = false;	// true when configuration has been changed
var search_focused = false;	// true when a search box is currently focused
var _custom_focus = false;	// true when an user control is currently focused
var _decrypt_failed = false;	// the last decryption failed due to wrong password attempts (pretty unused)
var result_pages = [];			// the pages indexed by the last result page
var last_AES_page;				// the last page on which the cached AES key was used on
var current_namespace = "";		// the namespace(+subnamespaces) of the current page
var _bootscript = null;					// bootscript
var _hl_reg = null;						// search highlighting regex

// new variables will be properly declared here
woas.prev_title = current;		// previous page's title used when entering/exiting edit mode

woas.save_queue = [];		// pages which need to be saved and are waiting in the queue

// Automatic-Save TimeOut object
woas._asto = null;

// left and right trim
woas.trim = function(s) {
	return s.replace(/(^\s*)|(\s*$)/, '');
}

// used to craft XHTML pages
woas.DOCTYPE = "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\" \"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">\n";
woas.DOC_START = "<"+"html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\">\n<head>\n"+
	"<m"+"eta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\" />\n";
	
	

// general javascript-safe string quoting
// NOTE: not completely binary safe!
// should be used only for titles (which ought not to contain binary bytes)
woas.js_encode = function (s, split_lines) {
	// not to counfound browsers with saved tags
	s = s.replace(/\\/g, "\\\\").replace(/</g, "\\x3C").replace(/>/g, "\\x3E").
		replace(/'/g, "\\'");
	// escape newlines (\r\n happens only on the stupid IE) and eventually split the lines accordingly
	if (!split_lines)
		s = s.replace(new RegExp("\r\n|\n", "g"), "\\n");
	else
		s = s.replace(new RegExp("\r\n|\n", "g"), "\\n\\\n");
	return this._utf8_js_fix(s);
}

// perform ECMAScript encoding only on some UTF-8 sequences
woas.ecma_encode = function(s) {
	return this._utf8_js_fix(s.replace(/\\/g, "\\\\"));
}

woas._ecma_rx_test = new RegExp("[^\u0000-\u007F]");

// returns true if text needs ECMA encoding
// checks if there are UTF-8 characters
woas.needs_ecma_encoding = function(s) {
	return this._ecma_rx_test.test(s);
}

woas._utf8_js_fix = function(s) {
	// fix the >= 128 ascii chars (to prevent UTF-8 characters corruption)
	return s.replace(new RegExp("[^\u0000-\u007F]+", "g"), function(str) {
		var r="";
		for(var a=0,l=str.length;a<l;++a) {
			var s = str.charCodeAt(a).toString(16);
			r += "\\u" + "0000".substr(s.length) + s;
		}
		return r;
	});
}

woas.ecma_decode = function(s) {
	return s.replace(new RegExp("(\\\\u[0-9a-f]{4})+", "g"), function (str, $1) {
		// this will perform real UTF-8 decoding
		var r = "";
		for (var ic=0,totc=str.length;ic<totc;ic+=6) {
			// get the hexa-numeric part
			var c = str.substr(ic+2, 4);
			// remove leading zeroes and convert to base10
			c = parseInt(c.replace(/^0*/,''), 16);
			// convert UTF-8 sequence to character
			r += String.fromCharCode(c);
		}
		return r;
	}).replace(/\\\\/g, "\\");
}

// used to escape blocks of source into HTML-valid output
woas.xhtml_encode = function(src) {
/*	return this.utf8_encode(src.replace(/[<>&]+/g, function ($1) {
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
	})); */
	return this.utf8_encode(src.replace(/&/g, '&amp;').replace(/</g, '&lt;').
			replace(/>/g, '&gt;')); // .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

woas.utf8_encode = function(src) {
	return src.replace(/[^\u0000-\u007F]+/g, function ($1) {
		var l=$1.length;
		var s="";
		for(var i=0;i<l;i++) {
			s+="&#"+$1.charCodeAt(i)+";";
		}
		return s;
	});
}

// DO NOT modify this list! these are namespaces that are reserved to WoaS
var reserved_namespaces = ["Special", "Lock", "Locked", "Unlocked", "Unlock",
						"Tags", "Tagged", "Untagged", "Include", "Javascript", "WoaS"];

// create the regex for reserved namespaces
var reserved_rx = "^";
for(var i = (woas.tweak.edit_override ? 1 : 0);i<reserved_namespaces.length;i++) {
	reserved_rx += /*RegExp.Escape(*/reserved_namespaces[i] + "::";
	if (i<reserved_namespaces.length-1)
		reserved_rx += "|";
}
woas._reserved_rx = new RegExp(reserved_rx, "i"); reserved_namespaces = reserved_rx = null;

woas.aliases = [];

woas.title_unalias = function(aliased_title) {
	// apply aliases on title, from newest to oldest
	for(var i=0,l=this.aliases.length;i<l;++i) {
		aliased_title = aliased_title.replace(this.aliases[i][0], this.aliases[i][1]);
	}
	return aliased_title;
}

// return page index (progressive number) given its title
woas.page_index = function(title) {
	return page_titles.indexOf(this.title_unalias(title));
}

woas.is_reserved = function(page) {
	return (page.search(this._reserved_rx)==0);
}

woas.is_menu = function(page) {
	return (page.indexOf("::Menu")==page.length-6);
}

// returns namespace with trailing ::
woas.get_namespace = function(page, root_only) {
	var p;
	if ((typeof root_only == "boolean") && (root_only == true))
		p = page.indexOf("::");
	else
		p = page.lastIndexOf("::");
	if (p==-1) return "";
	return page.substring(0,p+2);	
}

woas.is_readonly = function(page) {
	return this.is_readonly_id(this.page_index(page));
}

woas.is_readonly_id = function(pi) {
	return !!(page_attrs[pi] & 1);
}

woas.is__encrypted = function (pi) {
	return !!(page_attrs[pi] & 2);
}

woas.is_encrypted = function(page) {
	return this.is__encrypted(this.page_index(page));
}

woas.is__embedded = function(pi) {
	return !!(page_attrs[pi] & 4);
}
woas.is_embedded = function(page) {return this.is__embedded(this.page_index(page));}

woas.is__image = function(pi) {
	return !!(page_attrs[pi] & 8);
}
woas.is_image = function(page) { return this.is__image(this.page_index(page)); }

// a page physically exists if it is not part of a reserved namespace, if it is not a (sub)namespace and if it actually exists
woas.page_exists = function(page) {
	return (this.is_reserved(page) || (page.substring(page.length-2)=="::") || (this.page_index(page)!=-1));
}

// joins a list of pages
woas._join_list = function(arr) {
	if (!arr.length)
		return "";
	result_pages = arr.slice(0);
	return "* [["+arr.sort().join("]]\n* [[")+"]]";
}

woas._simple_join_list = function(arr, sorted) {
	if (sorted)
		arr = arr.sort();
	// a newline is added here
	return arr.join("\n")+"\n";
}

// with two trailing double colon
woas._get_namespace_pages = function (ns) {
	var pg = [];
	switch (ns.substr(0, ns.length-2)) {
		case "Locked":
			return "= Pages in "+ns+" namespace\n" + this.special_encrypted_pages(true);
		case "Unlocked":
			return "= Pages in "+ns+" namespace\n" + this.special_encrypted_pages(false);
		case "Untagged":
			return "= Pages in "+ns+" namespace\n" + this.special_untagged(false);
		case "Tagged": // to be used in wiki source
		case "Tags": // is this deprecated?
			return "= Pages in "+ns+" namespace\n" + this.special_tagged(false);
		case "WoaS::Plugins":
			return this.parser.parse(this.get_text("WoaS::Plugins") + this._plugins_list());
		case "Image":
			var iHTML = "";
			for(var i=0, l=page_titles.length;i<l;++i) {
				if (page_titles[i].indexOf(ns)===0)
					iHTML += this.parser.parse("* [[Include::"+page_titles[i]+"]][["+page_titles[i]+"]]\n");
			}
			return "= Pages in "+ns+" namespace\n" + iHTML;
	}

	for(var i=0, l=page_titles.length;i<l;++i) {
		if (page_titles[i].indexOf(ns)===0)
			pg.push(page_titles[i]);
	}
	return "= Pages in "+ns+" namespace\n" + this._join_list(pg);
}

woas._get_tagged = function(tag_filter) {
	var pg = [];
	
	// allow tags filtering/searching
	var tags = this.split_tags(tag_filter),
		tags_ok = [], tags_not = [];
	for(var i=0,tl=tags.length;i<tl;++i) {
		// skip empty tags
		var tag = this.trim(tags[i]);
		if (!tags[i].length)
			continue;
		// add a negation tag
		if (tags[i].charAt(0)=='!')
			tags_not.push( tags[i].substr(1) );
		else // normal match tag
			tags_ok.push(tags[i]);
	} tags = null;
	
	var tmp, fail;
	for(var i=0,l=pages.length;i<l;++i) {
		tmp = this.get_src_page(i);
		// can be null in case of encrypted content w/o key
		if (tmp==null)
			continue;
		tmp.replace(/\[\[Tags?::([^\]]*?)\]\]/g, function(str, $1) {
				// skip protocol references
//				if ($1.search(/^\w+:\/\//)==0)
//					return;
				// get array of tags in this wiki link
				var found_tags = woas.split_tags($1);
				fail = false;
				// filter if "OK" tag is not present
				for (var b=0,bl=tags_ok.length;b<bl;++b) {
					if (found_tags.indexOf(tags_ok[b]) == -1) {
						fail = true;
						break;
					}
				}
				if (!fail) {
					// filter if "NOT" tag is present
					// we are applying this filter only to tagged pages
					// so a page without tags at all does not fit into this filtering
					for (var b=0,bl=tags_not.length;b<bl;++b) {
						if (found_tags.indexOf(tags_not[b]) != -1) {
							fail = true;
							break;
						}
					}
					if (!fail)
						// no failure, we add this page
						pg.push(page_titles[i]);
				}
			});
	}
	if (!pg.length)
		return "No pages tagged with *"+tag_filter+"*";
	return "= Pages tagged with " + tag_filter + "\n" + this._join_list(pg);
}

// return a plain page or a decrypted one if available through the latest key
woas.get_page = function(pi) {
	if (this.is__embedded(pi))
		return null;
	if (!this.is__encrypted(pi))
		return pages[pi];
	if (!this.AES.isKeySet()) {
		last_AES_page = "";
		return null;
	}
	// decrypt by using a copy of the array
	var pg = this.AES.decrypt(pages[pi].slice(0));
	last_AES_page = page_titles[pi];
	return pg;	
}

// get the text of the page, stripped of html tags
woas.get_src_page = function(pi, rawmode) {
	var pg = this.get_page(pi);
	if (pg===null) return null;
	if ((typeof rawmode == "undefined") || (rawmode == false))
		pg = pg.replace(/\{\{\{((.|\n)*?)\}\}\}/g, "");
	else
		pg = pg.replace(/(\{|\})(\1)(\1)/g, "$1<!-- -->$2<!-- -->$3");
	// remove wiki and html that should not be viewed when previewing wiki snippets
	return pg.replace(/<script[^>]*>((.|\n)*?)<\/script>/gi, "").
			replace(/\<\/?\w+[^>]+>/g, "");
}

woas.get_text = function (title) {
	var pi = this.page_index(title);
	if (pi==-1)
		return null;
	return this.get__text(pi);
}

woas.get_text_special = function(title) {
	var ns = this.get_namespace(title);
	var text = null;
	if (ns.length) {
//		log("namespace of "+title+" is "+namespace);	// log:0
		title = title.substring(ns.length);
		if (!title.length) return this._get_namespace_pages(ns);
		switch (ns) {
			case "Special::":
				text = this._get_special(title, false);
			break;
			case "Tagged::": // deprecated?
			case "Tags::":
				text = this._get_tagged(title);
			break;
			default:
				text = this.get_text(ns+title);
		}
	} else
		text = this.get_text(title);
	return text;
}

woas.__last_title = null;

woas.__password_finalize = function(pwd_obj) {
	$.show_ni("wiki_text");
	document.title = this.__last_title;
	$.hide("woas_pwd_mask");
//	scrollTo(0,0);
	// hide input form
	pwd_obj.value = "";
	pwd_obj.blur();
	custom_focus(false);
}

woas._set_password = function() {
	this.__last_title = document.title;
	document.title = "Enter password";
	// hide browser scrollbars and show mask
	$.show("woas_pwd_mask");
	$.hide_ni("wiki_text");
	scrollTo(0,0);
	// show input form
	$.show_ni("woas_pwd_query");
	custom_focus(true);
	$("woas_password").focus();	
}

woas._password_cancel = function() {
	this.__password_finalize($("woas_password"));
}

// function which hooks all messages shown by WoaS
// can be fed with multiple messages to show consecutively
woas.alert = function() {
	for(var i=0,l=arguments.length;i<l;++i) {
		alert("WoaS: "+arguments[i]);
	}
}

// same as above, but for unhandled errors
woas.crash = function() {
	for(var i=0,l=arguments.length;i<l;++i) {
		alert("WoaS Unhandled error\n----\n"+arguments[i]);
	}
}

woas._password_ok = function() {
	var pwd_obj = $("woas_password");
	var pw = pwd_obj.value;
	if (!pw.length) {
		this.alert(this.i18n.PWD_QUERY);
		return;
	}
	this.AES.setKey(pw);
	this.__password_finalize(pwd_obj);
}

//TODO: specify interactive-mode
woas.get__text = function(pi) {
	// is the page encrypted or plain?
	if (!this.is__encrypted(pi))
		return pages[pi];
	_decrypt_failed = true;
	if (!this.AES.isKeySet()) {
		this.alert(this.i18n.ERR_NO_PWD.sprintf(page_titles[pi]));
		return null;
	}
	this.progress_init("AES decryption");
//	var pg = null;
			//TODO: use form-based password input
//			this._get_password('The latest entered password (if any) was not correct for page "'+page_titles[pi]+"\"");
//			var pw = prompt('The latest entered password (if any) was not correct for page "'+page_titles[pi]+"'\n\nPlease enter the correct password.", '');
//			if ((pw==null) || !pw.length) {
			// we are waiting for the password to be set programmatically
/*			if (!pw.length) {
				last_AES_page = "";
				AES_clearKey();
				document.body.style.cursor = "auto";
				return null;
			}
			AES_setKey(pw);
			retry++;
*/
//			return null;
//		}
		// pass a copied instance to the decrypt function
		// AES_decrypt can return null on failure, but can also return a garbled output
		var pg = this.AES.decrypt(pages[pi].slice(0));
		last_AES_page = page_titles[pi];
//		if (pg != null)
//			break;
	if (!this.config.key_cache)
		this.AES.clearKey();
	if (pg !== null) {
		_decrypt_failed = false;
//		if (this.config.key_cache)			last_AES_page = page_titles[pi];
	} else {
		this.alert(this.i18n.ACCESS_DENIED.sprintf(page_titles[pi]));
//		AES_clearKey();
		last_AES_page = "";
	}
	this.progress_finish();
	return pg;
}

woas.set__text = function(pi, text) {
	log("Setting wiki text for page #"+pi+" \""+page_titles[pi]+"\"");	// log:1
	if (this.is__embedded(pi) && !this.is__image(pi))
		text = encode64(text);
//	text = _new_syntax_patch(text);
	if (!this.is__encrypted(pi)) {
		pages[pi] = text;
		return;
	}
	pages[pi] = this.AES.encrypt(text);
	last_AES_page = page_titles[pi];
}

// Sets text typed by user
woas.set_text = function(text) {
	var pi = this.page_index(current);
	// this should never happen!
	if (pi==-1) {
		log("current page \""+current+"\" is not cached!");	// log:1
		return;
	}
	this.set__text(pi, text);
}

woas.assert_current = function(page) {
	if( current != page )
		go_to( page ) ;
	else
		this.set_current( page, true);
}

// used to eventually remove the new-to-be page when cancel is pressed
woas._ghost_page = false;

woas._create_page = function (ns, cr, ask, fill_mode) {
	if (this.is_reserved(ns+"::") && !this.tweak.edit_override) {
		this.alert(this.i18n.ERR_RESERVED_NS.sprintf(ns+"::"+cr, ns));
			return false;
	}
	if ((ns=="File") || (ns=="Image")) {
		if (!fill_mode && ask)
			this.alert(this.i18n.DUP_NS_ERROR);
		else
			go_to(ns+"::"+cr);
		return false;
	}
	// this is what happens when you click a link of unexisting page
	if (!fill_mode && ask && !confirm(this.i18n.PAGE_NOT_FOUND))
		return false;
	// create and edit the new page
	if (cr!="Menu")
		pages.push("= "+cr+"\n");
	else
		pages.push("\n");
	if (ns.length)
		cr = ns+"::"+cr;
	page_attrs.push(0);
	page_titles.push(cr);
	// set modified timestamp
	page_mts.push(Math.round(new Date().getTime()/1000));
	log("Page "+cr+" added to internal array");	// log:1
	if (!fill_mode) {
		// DO NOT set 'current = cr' here!!!
		// enable ghost mode when creating a new-to-be page
		if (!ask)
			this._ghost_page = true;
		// proceed with a normal wiki source page
		this.edit_page(cr);
	}
	return true;
}

woas._get_embedded = function(cr, etype) {
	log("Retrieving embedded source "+cr);	// log:1
	var pi=this.page_index(cr);
	if (pi==-1)
		return this.parser.parse("[[Include::Special::Embed|"+etype+"]]");
	return this._get__embedded(cr, pi, etype);
}

woas._get__embedded = function (cr, pi, etype) {
	var text=this.get__text(pi);
	if (text==null) return null;
	var xhtml = "";
	
	if (etype=="file") {
		var fn = cr.substr(cr.indexOf("::")+2);
		var pview_data = decode64(text, 1024), pview_link = "";
		var ext_size = Math.ceil((text.length*3)/4);
		if (ext_size-pview_data.length>10)
			pview_link = "<div id='_part_display'><em>"+this.i18n.FILE_DISPLAY_LIMIT+
			"</em><br /><a href='javascript:show_full_file("+pi+")'>"+this.i18n.DISPLAY_FULL_FILE+"</a></div>";
		var _del_lbl;
		if (!this.is_reserved(cr))
			_del_lbl = "\n\n<a href=\"javascript:query_delete_file('"+this.js_encode(cr)+"')\">"+this.i18n.DELETE_FILE+"</a>\n";
		else
			_del_lbl = "";
		xhtml = "<pre id='_file_ct' class=\"embedded\">"+this.xhtml_encode(pview_data)+"</pre>"+
				pview_link+"<br /><hr />"+this.i18n.FILE_SIZE+": "+_convert_bytes(ext_size)+
				"<br />" + this.last_modified(page_mts[pi])+
				"<br /><br />XHTML transclusion:"+this.parser.parse("\n{{{[[Include::"+cr+"]]}}}"+
				"\n\nRaw transclusion:\n\n{{{[[Include::"+cr+"|raw]]}}}"+
				_del_lbl+"\n<a href=\"javascript:query_export_file('"+this.js_encode(cr)+"')\">"+this.i18n.EXPORT_FILE+"</a>\n");
	} else { // etype == image
		var img_name = cr.substr(cr.indexOf("::")+2);
		xhtml = this.parser.parse("= "+img_name+"\n\n"+
		"<s"+"cript> setTimeout(\"_img_properties_show('"+
				text.match(/^data:\s*([^;]+);/)[1] + "', "+
				text.length + ", " +
				(text.match(/^data:\s*[^;]*;\s*[^,]*,\s*/)[0]).length+", "+
				page_mts[pi]+
				")\");"+
		"</s"+"cript>"+
		"<img id=\"img_tag\" class=\"embedded\" src=\""+text+"\" alt=\""+this.xhtml_encode(img_name)+"\" />"+
		"\n\n<div id=\"img_desc\">"+this.i18n.LOADING+"</div>"+
		"\nSimple transclusion:\n\n{{{[[Include::"+cr+"]]}}}\n\nTransclusion with additional attributes:\n\n{{{[[Include::"+cr+"|border=\"0\" onclick=\"go_to('"+
		this.js_encode(cr)+"')\" style=\"cursor:pointer\"]]}}}\n"+
		"\n<a href=\"javascript:query_delete_image('"+this.js_encode(cr)+"')\">"+this.i18n.DELETE_IMAGE+"</a>\n"+
		"\n<a href=\"javascript:query_export_image('"+this.js_encode(cr)+"')\">"+this.i18n.EXPORT_IMAGE+"</a>\n");
	}
	return xhtml;
}

// export a base64-encoded image to a file
woas.export_image = function(page, dest_path) {
	var pi=this.page_index(page);
	if (pi==-1)
		return false;
	var data=this.get__text(pi);
	if (data==null)
		return false;
	return this._b64_export(data, dest_path);
}

// used to export files/images
woas.export_file = function(page, dest_path) {
	var pi=this.page_index(page);
	if (pi==-1)
		return false;
	var data=this.get__text(pi);
	if (data==null)
		return false;
	// attempt to save the file (binary mode)
	return this.save_file(dest_path, this.file_mode.BINARY, decode64(data));
}

woas._embed_process = function(etype) {
	// pick the correct mode for file inclusion
	// normalize etype to the correspondant binary flag value
	var desired_mode;
	if (etype == "image") {
		desired_mode = this.file_mode.DATA_URI;
		etype = 12;
	} else {
		desired_mode = this.file_mode.BASE64;
		etype = 4;
	}
	
	// load the data in DATA:URI mode
	var ct = this.load_file(null, desired_mode);
	if ((ct === false) || ((typeof ct != "string") || !ct.length)) {
		this.alert(this.i18n.LOAD_ERR);
		return false;
	}
	
	pages.push(ct);
	page_attrs.push(etype);
	page_titles.push(current);
	// set modified timestamp to now
	page_mts.push(Math.round(new Date().getTime()/1000));
	
	// save this last page
	this.commit(page_titles.length-1);
	
	this.refresh_menu_area();
	return this.set_current(current, true);
}

woas._get_special = function(cr, interactive) {
	var text = null;
	var pi = this.shortcuts.indexOf(cr);
	cr = "Special::" + cr;
	if (pi != -1) {
		var fn = this.shortcuts_js[pi];
		var is_cmd = (fn.substr(0,4)=="cmd_");
		if (!interactive && is_cmd)
			return null;
		text = this[fn]();
		// skip the cmd shortcuts
		if (is_cmd)
			return null;
	} else
//	log("Getting special page "+cr);	// log:0
/*			if (this.is_embedded(cr)) {
				text = this._get_embedded(cr, this.is_image(cr) ? "image":"file");
				if (text == null) {
					if (_decrypt_failed)
						_decrypt_failed = false;
					return;
				}
				this._add_namespace_menu("Special");
				
				this.load_as_current(cr, text, );
				return;
			}	*/
		text = this.get_text(cr);
	if(text == null) {
		if (this.tweak.edit_override && interactive) {
			this._create_page("Special", cr.substr(9), true, false);
			return null;
		}
		if (interactive)
			this.alert(this.i18n.INVALID_SPECIAL);
	}
	return text;
}

woas.get_javascript_page = function(cr) {
	var emsg = "-", text;
	try {
		text = eval(cr);
		if (text == null)
			return null;
	}
	catch (e) {
		emsg = e.toString();
	}
	if (text == null) {
		this.crash("Dynamic evaluation of '"+cr+"' failed!\n\nError message:\n\n"+emsg);
		return null;
	}
	return text;
}

// Load a new current page
// return true if page needs to be saved in history, false otherwise
woas.set_current = function (cr, interactive) {
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
		// skip not found references but also null namespace references
		if (p>0) {
			namespace = cr.substring(0,p);
//			log("namespace of "+cr+" is "+namespace);	// log:0
			cr = cr.substring(p+2);
				switch (namespace) {
					case "Javascript":
					// this namespace will deprecate many others
					text = this.get_javascript_page(cr);
					if (text == null)
						return false;
					break;
					case "Special":
						text = this._get_special(cr, interactive);
						if (text == null)
							return false;
						break;
					case "Tagged": // deprecated
					case "Tags":
						text = this._get_tagged(cr);
						if (text == null)
							return false;
						break;
					case "Lock":
						pi = this.page_index(cr);
						if (this.AES.isKeySet()) {
							// display a message
							if (confirm(this.i18n.LOCK_CONFIRM.sprintf(cr)+
								(last_AES_page ? this.i18n.LOCK_CONFIRM_LAST.sprintf(last_AES_page) : ''))) {
								this._finalize_lock(pi);
								return false;
							}
						}
						text = this.get_text("Special::Lock");
						break;
					case "Unlock":
						pi = this.page_index(cr);
						if (!confirm(this.i18n.CONFIRM_REMOVE_ENCRYPT.sprintf(cr)))
							return;
						text = this.get_text(cr);
						if (_decrypt_failed) {
							_decrypt_failed = false;
							return false;
						}
						pages[pi] = text;
						page_attrs[pi] -= 2;
						if (!this.config.key_cache)
							this.AES.clearKey();
						if (this.set_current(cr, true)) {
							this.save_page(cr);
							return true;
						}
						return false;
					case "WoaS":
						pi = woas.page_index(namespace+"::"+cr);
						var real_t = page_titles[pi];
/*						if (this.is__embedded(pi)) {
							//TODO: do not use namespace to guess the embedded file type
							text = this._get__embedded(real_t, pi, "file");
						} else { */
							text = this.get_text(real_t);
							if (text !== null) {
								switch (cr) {
									case "Plugins":
										text = this.parser.parse(text + this._plugins_list());
									break;
									case "Aliases":
									case "Bootscript":
									// page is stored plaintext
									break;
									default:
										text = this.parser.parse(text);
								}
							}	
//						}
						if(text === null) {
							if (_decrypt_failed)
								_decrypt_failed = false;
							return false;
						}
						this._add_namespace_menu(namespace);
						if (namespace.length)
							cr = real_t;
						this.load_as_current(cr, text, page_mts[pi]);
						return;
					case "File":
					case "Image":
						text = this._get_embedded(namespace+"::"+cr, namespace.toLowerCase());
						if(text == null) {
							if (_decrypt_failed)
								_decrypt_failed = false;
							return false;
						}
						this._add_namespace_menu(namespace);
						if (namespace.length)
							cr = namespace + "::" + cr;
						this.load_as_current(cr, text, page_mts[this.page_index(namespace+"::"+cr, namespace.toLowerCase())]);
						return true;
						break;
					default:
						text = this.get_text(namespace+"::"+cr);
				}

		} else {
			namespace = "";
			text = this.get_text(cr);
		}
	}
	
	if(text == null) {
		if (_decrypt_failed) {
			_decrypt_failed = false;
			return false;
		}
		if (!this._create_page(namespace, cr, true, false))
			return false;
//		log("Editing new page "+namespace+cr);	// log:0
		return true;
	}
	
	this._add_namespace_menu(namespace);

	// hard-set the current page to the namespace page
	if (namespace.length) {
		cr = namespace + "::" + cr;
		pi = this.page_index(cr);
		if (pi)
			mts = page_mts[pi];
		else mts = null;
	} else {
		pi = this.page_index(cr);
		cr = page_titles[pi];
		mts = page_mts[pi];
	}
	
	return this.load_as_current(cr, this.parser.parse(text), mts);
}

// StickWiki custom scripts array
woas.swcs = [];

woas._clear_swcs = function () {
//	setHTML(swcs, "");
	if (!this.swcs.length) return;
	for(var i=0;i<this.swcs.length;i++) {
		document.getElementsByTagName("head")[0].removeChild(this.swcs[i]);
	}
	this.swcs = [];
}

woas.create_breadcrumb = function(title) {
	var tmp=title.split("::");
	if (tmp.length==1)
		return title;
	var s="", partial="", js="";
	for(var i=0;i<tmp.length-1;i++) {
		partial += tmp[i]+"::";
		js = "go_to('"+this.js_encode(partial)+"')";
		if (kbd_hooking)
			s+= tmp[i]+" :: ";
		else
			s += "<a href=\"javascript:"+js+"\" onclick=\""+js+"\">"+tmp[i]+"</a> :: ";		
	}
	// add page title
	return s+tmp[tmp.length-1];
}

woas._activate_scripts = function() {
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

woas._set_title = function (new_title) {
	var wt=$("wiki_title");
	// works with IE6, FF, etc.
	wt.innerHTML = this.create_breadcrumb(new_title);
	document.title = new_title;
}

woas.last_modified = function(mts) {
	// do not show anything when the timestamp is magic (zero)
	if (mts == 0)
		return "";
	return this.i18n.LAST_MODIFIED + (new Date(mts*1000)).toLocaleString();
}

// actually load a page given the title and the proper XHTML
woas.load_as_current = function(title, xhtml, mts) {
	if (typeof title == "undefined") {
		this.crash("load_as_current() called with undefined title");
		return false;
	}
	scrollTo(0,0);
	log("load_as_current(\""+title+"\") - "+(typeof xhtml == "string" ? (xhtml.length+" bytes") : (typeof xhtml)));	// log:1
	$("wiki_text").innerHTML = xhtml;
	this.refresh_mts(mts);

	this._set_title(title);
	this.update_nav_icons(title);
	current = title;
	this._activate_scripts();
	
	return true;
}

woas.refresh_mts = function(mts) {
	// generate the last modified string to append
	if (mts) {
		$("wiki_mts").innerHTML = this.last_modified(mts);
		$.show("wiki_mts");
	} else
		$.hide("wiki_mts");
}

woas._finalize_lock = function(pi) {
	this._perform_lock(pi);
	var title = page_titles[pi];
	this.set_current(title, true);
	if (!this.config.key_cache) {
		this.AES.clearKey();
		last_AES_page = "";
	} else
		last_AES_page = title;
	this.save_page_i(pi);
}

woas._perform_lock = function(pi) {
	pages[pi] = this.AES.encrypt(pages[pi]);
//	log("E: encrypted length is "+pages[pi].length);	// log:0
	page_attrs[pi] += 2;
}

woas._add_namespace_menu = function(namespace) {
//	log("adding namespace menu for \""+namespace+"\"");	// log:0
//	log("current namespace is \""+current_namespace+"\"");	// log:0
	if (current_namespace == namespace)
		return;
	var pi;
	if (namespace == "")
		pi = -1;
	else
		pi = this.page_index(namespace+"::Menu");
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

woas.refresh_menu_area = function() {
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

woas._gen_display = function(id, visible, prefix) {
	if (visible)
		$.show(prefix+"_"+id);
	else
		$.hide(prefix+"_"+id);
}

woas.img_display = function(id, visible) {
	if (!this.browser.ie || this.browser.ie8) {
		this._gen_display(id, visible, "img");
		this._gen_display(id, !visible, "alt");
	} else {
		this._gen_display(id, !visible, "img");
		this._gen_display(id, visible, "alt");
	}
}

woas.menu_display = function(id, visible) {
	this._gen_display(id, visible, "menu");
//	log("menu_"+id+" is "+$("menu_"+id).style.display);
}

// auto-save thread
function _auto_saver() {
	if (woas.save_queue.length && !kbd_hooking) {
		woas.commit(woas.save_queue);
		woas.menu_display("save", false);
	}
	if (_this.config.auto_save)
		woas._asto = setTimeout("_auto_saver()", woas.config.auto_save);
}

// save configuration on exit
woas.before_quit = function () {
	if (this.save_queue.length)
		this.commit(this.save_queue);
	else {
		if (this.config.save_on_quit && cfg_changed)
			this.cfg_commit();
	}
	return true;
}

woas.setHTML = woas.getHTML = null;

// when the page is loaded - onload, on_load
woas.after_load = function() {
	log("***** Woas v"+this.version+" started *****");	// log:1

//	document.body.style.cursor = "wait";
	
	if (this.browser.ie) {	// some hacks for IE
		this.setHTML = function(elem, html) {elem.text = html;};
		this.getHTML = function(elem) {return elem.text};
		var obj = $("sw_wiki_header");
		obj.style.filter = "alpha(opacity=75);";
		if (this.browser.ie6) {
			$("sw_wiki_header").style.position = "absolute";
			$("sw_menu_area").style.position = "absolute";
		}
	} else {
		this.setHTML = function(elem, html) {elem.innerHTML = html;};
		this.getHTML = function(elem) {return elem.innerHTML;};
//		setup_uri_pics($("img_home"),$("img_back"),$("img_forward"),$("img_edit"),$("img_cancel"),$("img_save"),$("img_advanced"));
	}
	
	this.setHTML($("woas_wait_text"), this.i18n.LOADING);
	
	$('a_home').title = this.config.main_page;
	$('img_home').alt = this.config.main_page;
	
	if (this.config.debug_mode) {
		$.show_ni("debug_info");
		$.show_ni("woas_debug_panel");
	} else {
		$.hide_ni("debug_info");
		$.hide_ni("woas_debug_panel");
	}

	// properly initialize navigation bar icons
	// this will cause the alternate text to display on IE6
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
	this.img_display("setkey", true);
	this.img_display("help", true);
	
	// customized keyboard hook
	document.onkeydown = kbd_hook;

	// Go straight to page requested
	var qpage=document.location.href.split("?")[1];
	if(qpage)
		current = unescape(qpage);

	// check integrity of WoaS when finished - only in debug mode
	if (this.tweak.integrity_test)
		if (!this.integrity_test())
			return;
		
	// first thing to do: load the actual pages!
	if (this.tweak.native_wsif) {
		if (!this._native_load()) {
			// the file load error is already documented to user
			if (this.wsif.emsg !== null)
				this.crash("Could not load WSIF pages data!\n"+this.wsif.emsg);
			return;
		}
	}
		
//	this.swcs = $("sw_custom_script");

	this._load_aliases(this.get_text("WoaS::Aliases"));

	this._create_bs();	//moved here to fix bug 1898587
	this.set_current(current, true);
	this.refresh_menu_area();
	// feed the current title before running the disable edit mode code
	this.prev_title = current;
	this.disable_edit();
	
	if (this.config.permit_edits)
		$.show("menu_edit_button");
	else
		$.hide("menu_edit_button");
	
	// enable the auto-saver hook
	if (this.config.cumulative_save && this.config.auto_save)
		this._asto = setTimeout("_auto_saver(woas)", this.config.auto_save);
	
//	this._create_bs();
	
	this._editor = new TextAreaSelectionHelper($("wiki_editor"));
	
	// set some fixup CSS with some browsers
	if (this.browser.firefox || this.browser.opera)
		this.set_css(this.get_css());
	
//	this.progress_finish();
	$.hide("loading_overlay");
}

// match all aliases defined in a page
woas._load_aliases = function(s) {
	this.aliases = [];
	if (s==null || !s.length) return;
	s.replace(/^(\$[A-Za-z0-9_]{2,})\s+([\s\S]+)$/gm, function(str, alias, value) {
		// save the array with the alias regex and alias value
		var cpok = [ new RegExp(RegExp.escape(alias), "g"), value];
		woas.aliases.push(cpok);
	});
}

woas._create_bs = function() {
	var s=this.get_text("WoaS::Bootscript");
	if (s==null || !s.length) return false;
	// remove the comments
	s = s.replace(/^\s*\/\*(.|\n)*?\*\/\s*/g, '');
	if (!s.length) return false;
	_bootscript = document.createElement("script");
	_bootscript.type="text/javascript";
	_bootscript.id = "woas_bootscript";
	document.getElementsByTagName("head")[0].appendChild(_bootscript);
	this.setHTML(_bootscript, s);
	return true;
}

// remove bootscript (when erasing for example)
woas._clear_bs = function() {
	if (_bootscript!=null) {
		var head = document.getElementsByTagName("head")[0];
		head.removeChild(_bootscript);
		_bootscript = null;
	}
}

function ff_fix_focus() {
//runtime fix for Firefox bug 374786
	if (woas.browser.firefox)
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

// set to true when inside an edit textarea
var kbd_hooking=false;

function kbd_hook(orig_e) {
	if (!orig_e)
		e = window.event;
	else
		e = orig_e;
		
	if (!kbd_hooking) {
		if (_custom_focus)
			return orig_e;
		if (search_focused) {
			// return key
			if (e.keyCode==13) {
				ff_fix_focus();
				do_search();
				return false;
			}
			return orig_e;
		}
		// backspace or escape
		if ((e.keyCode==8) || (e.keyCode==27)) {
			go_back();
			ff_fix_focus();
			return false;
		}
	}

	// escape
	if (e.keyCode==27) {
		cancel();
		ff_fix_focus();
		return false;
	}

	return orig_e;
}

// when the page is resized
woas._onresize = function() {
	var we = $("wiki_editor");
	if (!we) {
		log("no wiki_editor");
		return;
	}
	we.style.width = window.innerWidth - 30 + "px";
	we.style.height = window.innerHeight - 150 + "px";
}

if (!woas.browser.ie)
	window.onresize = woas._onresize;

woas.update_nav_icons = function(page) {
	this.menu_display("back", (backstack.length > 0));
	this.menu_display("forward", (forstack.length > 0));
	this.menu_display("advanced", (page != "Special::Advanced"));
	this.menu_display("edit", this.edit_allowed(page));
	this.update_lock_icons(page);
}

woas.update_lock_icons = function(page) {
	var cyphered, can_lock, can_unlock;
	if (result_pages.length<2) {
		var pi = this.page_index(page);
		if (pi==-1) {
			can_lock = can_unlock = false;
			cyphered = false;
		} else {
			can_unlock = cyphered = this.is__encrypted(pi);
			can_lock = !can_unlock && this.config.permit_edits;
		}
	} else {
//		log("result_pages is ("+result_pages+")");	// log:0
		can_lock = can_unlock = (result_pages.length>0);
		cyphered = false;
	}
	
	// update the encryption icons accordingly
	this.menu_display("lock", !kbd_hooking && can_lock);
	this.menu_display("unlock", !kbd_hooking && can_unlock);
	// we can always input decryption keys by clicking the setkey icon
	//this.menu_display("setkey", cyphered);
	var cls;
	if (cyphered || (page.indexOf("Locked::")==0))
		cls = "woas_text_area locked";
	else
		cls = "woas_text_area";
	$("wiki_text").className = cls;
}

// disable edit-mode after cancel/save actions
woas.disable_edit = function() {
//	log("DISABLING edit mode");	// log:0
	kbd_hooking = false;
	// reset change buffer used to check for page changes
	this.change_buffer = null;
	this.old_title = null;
	// check for back and forward buttons - TODO grey out icons
	this.update_nav_icons(current);
	this.menu_display("home", true);
	if (this.config.cumulative_save)
		this.menu_display("save", this.save_queue.length!=0);
	else
		this.menu_display("save", false);
	this.menu_display("cancel", false);
	this.menu_display("print", true);
	this.menu_display("setkey", true);
	$.show("i_woas_text_area");
	// aargh, FF eats the focus when cancelling edit
	$.hide("edit_area");
	this._set_title(this.prev_title);
}

function _lock_pages(arr) {
	this.alert("Not yet implemented");
}

function _unlock_pages(arr) {
	this.alert("Not yet implemented");
}

woas.edit_allowed = function(page) {
	if (this.tweak.edit_override)
		return (this.page_index(page) != -1);
	if (!this.config.permit_edits)
		return false;
	if (this.is_reserved(page))
		return false;
	return !this.is_readonly(page);
}

// setup the title boxes and gets ready to edit text
woas.current_editing = function(page, disabled) {
//	log("current = "+current+", current_editing(\""+page+"\", disabled: "+disabled+")");	// log:0
	this.prev_title = current;
	$("wiki_page_title").disabled = (disabled && !this.tweak.edit_override ? "disabled" : "");
	$("wiki_page_title").value = page;
	kbd_hooking = true;
	this._set_title(this.i18n.EDITING.sprintf(page));
	// current must be set BEFORE calling enabling menu edit
//	log("ENABLING edit mode");	// log:0
	this.menu_display("back", false);
	this.menu_display("forward", false);
	this.menu_display("advanced", false);
	this.menu_display("setkey", false);
	this.menu_display("home", false);
	this.menu_display("edit", false);
	this.menu_display("print", false);
	this.menu_display("save", true);
	this.menu_display("cancel", true);
	this.update_lock_icons(page);
	$.hide("i_woas_text_area");

	// FIXME!
	if (!this.browser.ie)	{
		$("wiki_editor").style.width = window.innerWidth - 35 + "px";
		$("wiki_editor").style.height = window.innerHeight - 180 + "px";
	}
	
	$.show("edit_area");

	$("wiki_editor").focus();
	current = page;
	scrollTo(0,0);
}

woas.change_buffer = null;
woas.old_title = null;

// sets the text and allows changes monitoring
woas.edit_ready = function (txt) {
	$("wiki_editor").value = txt;
	// save copy of text to check if anything was changed
	// do not store it in case of ghost pages
	this.change_buffer = txt;
	this.old_title = $("wiki_page_title").value;
}

var _servm_shown = false;

function _servm_alert() {
	if (woas._server_mode) {
		// show the message only once
		if (!_servm_shown) {
			this.alert(this.i18n.SERVER_MODE);
			_servm_shown = true;
		}
	}
}

woas.edit_page = function(page) {
	if (!this.edit_allowed(page)) {
		log("Not allowed to edit page "+page);	// log:1
		return;
	}
	_servm_alert();
	var tmp = this.get_text(page);
	if (tmp===null) return false;
	if (this.is_embedded(page) && !this.is_image(page))
		tmp = decode64(tmp);
	// setup the wiki editor textbox
	this.current_editing(page, this.is_reserved(page));
	this.edit_ready(tmp);
	return true;
}

//API1.0: check if a title is valid
woas.valid_title = function(title) {
	if (title.length == 0) {
		this.alert(this.i18n.EMPTY_TITLE);
		return false;
	}
	if (title.length > 256) {
		this.alert(this.i18n.TOO_LONG_TITLE.sprintf(256));
		return false;
	}
	if (title.indexOf("[")!=-1 || title.indexOf("]")!=-1 ||
		title.indexOf("{")!=-1 || title.indexOf("}")!=-1 ||
		title.indexOf("<") != -1 || title.indexOf(">")!=-1 ||
		title.indexOf("|")!=-1) {
		this.alert(this.i18n.INVALID_TITLE);
		return false;
	}
	if (title.substr(-2)=="::") {
		this.alert(this.i18n.ERR_PAGE_NS);
		return false;
	}
	var ns = this.get_namespace(title, true);
	if (ns.length && this.is_reserved(ns+"::") && !this.tweak.edit_override) {
		this.alert(this.i18n.ERR_RESERVED_NS.sprintf(title, ns));
		return false;
	}
	return true;
}

woas.rename_page = function(previous, newpage) {
	log("Renaming "+previous+" to "+newpage);	// log:1
	if (this.page_index(newpage)!=-1) {
		this.alert(this.i18n.PAGE_EXISTS.sprintf(newpage));
		return false;
	}
	var pi = this.page_index(previous);
	page_titles[pi] = newpage;
	var re = new RegExp("\\[\\[" + RegExp.escape(previous) + "(\\]\\]|\\|)", "gi");
	var changed;
	for(var i=0,l=pages.length;i<l;i++) {
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
	if (previous == this.config.main_page)
		this.config.main_page = newpage;
	// make sure that previous title is consistent
	if (this.prev_title === previous)
		this.prev_title = newpage;
	return true;
}

// applies some on-the-fly patches for the syntax changes in v0.9
function _new_syntax_patch(text) {
	//BUG: will also modify text contained in nowiki blocks
	text = text.replace(/(^|\n)(\+*)([ \t])/g, function (str, $1, $2, $3) {
		return $1+String("*").repeat($2.length)+$3;
	});
	
	return text;
}

function _css_obj() {
	return document.getElementsByTagName("style")[0];
}

woas.FF2_CSS_FIXUP = "\n.wiki_preformatted { white-space: -moz-pre-wrap !important; }\n";

// Opera gets 100% as real 100%
//woas.OPERA_FIXUP = "\ndiv.wiki_header, #loading_overlay, #woas_pwd_query, #woas_pwd_mask { width: 100%; }\n";

woas.get_css = function() {
	var co = document.getElementsByTagName("style")[0];
	var css = co.innerHTML;
	if (this.browser.firefox2) {
		// remove the fixup if present
		if (css.substr(0, this.FF2_CSS_FIXUP.length) == this.FF2_CSS_FIXUP)
			css = css.substr(this.FF2_CSS_FIXUP.length);
	}
/*	if (this.browser.opera) {
		// remove the fixup if present
		if (css.substr(0, this.OPERA_FIXUP.length) == this.OPERA_FIXUP)
			css = css.substr(this.OPERA_FIXUP.length);
	} */
	return css;
}
	
woas.setCSS = function(new_css) { this.set_css(new_css); }

//API1.0: set WoaS CSS
woas.set_css = function(new_css) {
	// with some browsers we have weird hot-fixes
    // Mozilla, since 1999
    if (this.browser.firefox2)
		new_css = this.FF2_CSS_FIXUP + new_css;
//	if (this.browser.opera)
//		new_css = this.OPERA_FIXUP + new_css;
	if (!this.browser.ie) {
		_css_obj().innerHTML = new_css;
		return;
	}
	var head=document.getElementsByTagName('head')[0];
	var sty=document.styleSheets[0];
	sty.cssText = new_css;
}

woas.get_raw_content = function() {
	var c=$("wiki_editor").value;
	// remove CR added by some browsers
	//TODO: check if ie8 still adds these
	if (this.browser.ie || this.browser.opera)
		c = c.replace("\r\n", "\n");
	return c;
}

// action performed when save is clicked
woas.save = function() {
	// we will always save ghost pages if save button was hit
	var null_save = !this._ghost_page;
	// always reset ghost page flag
	this._ghost_page = false;
	// when this function is called in non-edit mode we perform a full commit
	// for cumulative save
	if (this.config.cumulative_save && !kbd_hooking) {
		this.full_commit();
		this.menu_display("save", false);
		return;
	}
	var raw_content = this.get_raw_content();
	
	// check if this is a null save only if page was not a ghost page
	if (null_save)
		null_save = (raw_content === this.change_buffer);
	
	var can_be_empty = false;
	switch(current) {
		case "Special::Edit CSS":
			if (!null_save)
				this.setCSS(raw_content);
			back_to = null;
			current = "Special::Advanced";
			$("wiki_page_title").disabled = "";
			break;
		case "WoaS::Aliases":
			if (!null_save)
				this._load_aliases(raw_content);
			// fallback wanted
		case "WoaS::Bootscript":
			can_be_empty = true;
			// fallback wanted
		default:
			// check if text is empty
			if (!null_save && !can_be_empty && (raw_content == "")) {
				if (confirm(this.i18n.CONFIRM_DELETE.sprintf(current))) {
					var deleted = current;
					this.delete_page(current);
					this.disable_edit();
					back_or(this.config.main_page);
				}
				return;
			} else {
				var new_title = this.trim($("wiki_page_title").value);
				// here the page gets actually saved
				if (!null_save || (this.old_title !== new_title)) {
					null_save = false;
					this.set_text(raw_content);
					// disallow empty titles
					if (!this.valid_title(new_title))
						return false;
					if (this.is_menu(new_title)) {
						this.refresh_menu_area();
						back_to = this.prev_title;
					} else {
						if (new_title != current) {
							if (!this.rename_page(current, new_title))
								return false;
						}
						back_to = new_title;
					}
				} else
					back_to = this.prev_title;
			}
	}
	var saved = current;
	if (back_to !== null)
		this.set_current(back_to, true);
	else { // used for CSS editing
		back_or(this.config.main_page);
		//TODO: refresh mts?
	}
	if (!null_save)
		this.refresh_menu_area();
	this.disable_edit();
	if (!null_save)
		this.save_page(saved);
}

// push a page into history
function history_mem(page) {
	if (backstack.length>6)
		backstack = backstack.slice(1);
	backstack.push(page);
}

woas.save_page = function(title) {
	return this.save_page_i(this.page_index(title));
}

woas.save_page_i = function(pi) {
	// update the modified time timestamp (only when not in dev-mode)
	if (!this.tweak.edit_override)
		page_mts[pi] = Math.round(new Date().getTime()/1000);
	// this is the dummy function that will allow more efficient file saving in future
	if (this.config.cumulative_save) {
		// add the page to the bucket, if it isn't already in
		if (!this.save_queue.length) {
			this.save_queue.push(pi);
			this.menu_display("save", true);
		} else {
			if (this.save_queue.indexOf(pi)==-1)
				this.save_queue.push(pi);
		}
		log("save_queue = ("+this.save_queue+")");	// log:1
		return true;
	}
	return this.commit([pi]);
}

var max_keywords_length = 250;
var max_description_length = 250;

// proper autokeywords generation functions begin here

var reKeywords = new RegExp("[^\\s\x01-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]{2,}", "g");
function _auto_keywords(source) {
	if (!source.length) return "";
	var words = source.match(reKeywords);
	if (!words.length) return "";
	var nu_words = new Array();
	var density = new Array();
	var wp=0;
	for(var i=0;i<words.length;i++) {
		if (words[i].length==0)
			continue;
		cond = (woas.i18n.common_words.indexOf(words[i].toLowerCase())<0);
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
	density = density.sort(function(a,b){return b.w - a.w});
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

var _g_br_rx = new RegExp("<"+"br\\s?\\/?>", "gi");
woas.xhtml_to_text = function(s) {
	return s.replace(_g_br_rx, "\n").replace(/<\/?\w+[^>]*>/g, ' ').replace(/&#?([^;]+);/g, function(str, $1) { if (!isNaN($1)) return String.fromCharCode($1); else return ""; });
}

woas.cancel_edit = function() {
	// there was some change, ask for confirm before cancelling
	if ((this.get_raw_content() !== this.change_buffer) ||
		(this.trim($("wiki_page_title").value) !== this.old_title)) {
		if (!confirm(this.i18n.CANCEL_EDITING))
			return;
	}
	if (kbd_hooking) {
		// we will cancel the creation of last page
		if (this._ghost_page) {
			// we assume that the last page is the ghost page
			pages.pop();
			page_mts.pop();
			page_titles.pop();
			page_attrs.pop();
			this._ghost_page = false;
		}
		this.disable_edit();
	}
}
