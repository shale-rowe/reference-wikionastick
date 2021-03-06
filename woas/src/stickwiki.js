// the namespace(+subnamespaces) of the current page
woas.current_namespace = "";

// the last page on which the cached AES key was used on
woas.last_AES_page = "";

// tells if configuration has been changed
woas.cfg_changed = false;

// new variables will be properly declared here
woas.prev_title = current;		// previous page's title used when entering/exiting edit mode

woas.save_queue = [];		// pages which need to be saved and are waiting in the queue

// Auto-Save Thread
woas._autosave_thread = null;

// previous length of WSIF datasource
woas._old_wsif_ds_len = null;

// this will likely happen when javascript code block was corrupted
woas._on_load = woas_on_unload = function() { this.crash("Deferred load/unload function not available!");};

// default post-load hook
woas.post_load = function(){};

// left and right trim
// grabbed from http://blog.stevenlevithan.com/archives/faster-trim-javascript
woas.trim = function(str) {
//	return s.replace(/(^\s*)|(\s*$)/, '');
	str = str.replace(/^\s+/, '');
	for (var i = str.length - 1; i >= 0; i--) {
		if (/\S/.test(str.charAt(i))) {
			str = str.substring(0, i + 1);
			break;
		}
	}
	return str;
};

// used to craft XHTML pages
woas.DOCTYPE = "<"+"!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.1//EN\" \"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd\">\n";
woas.DOC_START = "<"+"html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\">\n<"+"head>\n"+
	"<"+"meta woas_permanent=\"1\" http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\" />\n";

// general javascript-safe string quoting
// NOTE: not completely binary safe!
// should be used only for titles (which ought not to contain binary bytes)
var reMinorG = new RegExp("<", "g");
woas.js_encode = function (s, split_lines) {
	// not to counfound browsers with saved tags
	s = s.replace(/\\/g, "\\\\").replace(reMinorG, "\\x3C").replace(/>/g, "\\x3E").
		replace(/'/g, "\\'");
	// escape newlines (\r\n happens only on the stupid IE) and eventually split the lines accordingly
	if (!split_lines)
		s = s.replace(new RegExp("\r\n|\n", "g"), "\\n");
	else
		s = s.replace(new RegExp("\r\n|\n", "g"), "\\n\\\n");
	return this._utf8_js_fix(s);
};

// perform ECMAScript encoding only on some UTF-8 sequences
woas.ecma_encode = function(s) {
	return this._utf8_js_fix(s.replace(/\\/g, "\\\\"));
};

woas._ecma_rx_test = new RegExp("[^\u0000-\u007F]");

// returns true if text needs ECMA encoding
// checks if there are UTF-8 characters
woas.needs_ecma_encoding = function(s) {
	return this._ecma_rx_test.test(s);
};

woas._utf8_js_fix = function(s) {
	// fix the >= 128 ascii chars (to prevent UTF-8 characters corruption)
	return s.replace(woas.utf8.reUTF8Space, function(str) {
		var r="";
		for(var a=0,l=str.length;a < l;++a) {
			var s = str.charCodeAt(a).toString(16);
			r += "\\u" + "0000".substr(s.length) + s;
		}
		return r;
	});
};

woas.ecma_decode = function(s) {
	return s.replace(new RegExp("(\\\\u[0-9a-f]{4})+", "g"), function (str, $1) {
		// this will perform real UTF-8 decoding
		var r = "";
		for (var ic=0,totc=str.length;ic < totc;ic+=6) {
			// get the hexa-numeric part
			var c = str.substr(ic+2, 4);
			// remove leading zeroes and convert to base10
			c = parseInt(c.replace(/^0*/,''), 16);
			// convert UTF-8 sequence to character
			r += String.fromCharCode(c);
		}
		return r;
	}).replace(/\\\\/g, "\\");
};

// used to escape blocks of source into HTML-valid output
woas.xhtml_encode = function(src) {
/*	return this.utf8.do_escape(src.replace(/[<>&]+/g, function ($1) {
		var l=$1.length;
		var s="";
		for(var i=0;i < l;i++) {
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
	return this.utf8.do_escape(src.replace(/&/g, '&amp;').replace(reMinorG, '&lt;').
			replace(/>/g, '&gt;')); // .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

// DO NOT modify this list! these are namespaces that are reserved to WoaS
var reserved_namespaces = ["Special", "Lock", "Locked", "Unlocked", "Unlock",
						"Tags" /*DEPRECATED*/,
						"Tagged", "Untagged", "Include", "Javascript",
						"WoaS"];

// create the regex for reserved namespaces
var reserved_rx = "^";
for(var i = (woas.tweak.edit_override ? 1 : 0);i < reserved_namespaces.length;i++) {
	reserved_rx += /*RegExp.Escape(*/reserved_namespaces[i] + "::";
	if (i < reserved_namespaces.length-1)
		reserved_rx += "|";
}
woas._reserved_rx = new RegExp(reserved_rx, "i"); reserved_namespaces = reserved_rx = null;

// return page index (progressive number) given its title
woas.page_index = function(title) {
	return page_titles.indexOf(this.title_unalias(title));
};

woas.is_reserved = function(page) {
	return (page.search(this._reserved_rx)==0);
};

woas.is_menu = function(title) {
	return (title.substr(title.length-6) === "::Menu");
};

// returns namespace with trailing ::
woas.get_namespace = function(page, root_only) {
	var p;
	if ((typeof root_only == "boolean") && (root_only == true))
		p = page.indexOf("::");
	else
		p = page.lastIndexOf("::");
	if (p==-1) return "";
	return page.substring(0,p+2);	
};

// page attributes bits are mapped to (readonly, encrypted, ...)

woas.is_readonly = function(page) {
	return this.is_readonly_id(this.page_index(page));
};

woas.is_readonly_id = function(pi) {
	return !!(page_attrs[pi] & 1);
};

woas.is__encrypted = function (pi) {
	return !!(page_attrs[pi] & 2);
};

woas.is_encrypted = function(page) {
	return this.is__encrypted(this.page_index(page));
};

woas.is__embedded = function(pi) {
	return !!(page_attrs[pi] & 4);
};
woas.is_embedded = function(page) {return this.is__embedded(this.page_index(page));};

woas.is__image = function(pi) {
	return !!(page_attrs[pi] & 8);
};
woas.is_image = function(page) { return this.is__image(this.page_index(page)); };

// a page physically exists if it is not part of a reserved namespace, if it is not a (sub)namespace and if it actually exists
woas.page_exists = function(page) {
	return (this.is_reserved(page) || (page.substring(page.length-2)==="::") || (this.page_index(page)!==-1));
};

// with two trailing double colon
woas._get_namespace_pages = function (ns) {
	var pg = [];
	switch (ns.substr(0, ns.length-2)) {
		case "Locked":
			return this.special_encrypted_pages(true);
		case "Unlocked":
			return this.special_encrypted_pages(false);
		case "Untagged":
			return this.special_untagged();
		case "Tagged": // to be used in wiki source
			return this.special_tagged();
		case "Image":
			return this._special_image_gallery(ns);
	}

	for(i=0, l=page_titles.length;i < l;++i) {
		if (page_titles[i].indexOf(ns)===0)
			pg.push(page_titles[i]);
	}
	return /*"= Pages in "+ns+" namespace\n" + */this._join_list(pg);
};

// return a plain page or a decrypted one if available through the latest key
woas.get_page = function(pi) {
	if (this.is__embedded(pi))
		return null;
	if (!this.is__encrypted(pi))
		return pages[pi];
	if (!this.AES.isKeySet()) {
		this.last_AES_page = "";
		return null;
	}
	// decrypt by using a copy of the array
	var pg = this.AES.decrypt(pages[pi].slice(0));
	this.last_AES_page = page_titles[pi];
	return pg;	
};

var reScriptTags = new RegExp("<"+"script[^>]*>((.|\\n)*?)<"+"\\/script>", "gi"),
	reAnyXHTML = /\<\/?\w+[^>]+>/g;
// get the text of the page, stripped of html tags
woas.get_src_page = function(pi, rawmode) {
	var pg = this.get_page(pi);
	if (pg===null) return null;
	if ((typeof rawmode == "undefined") || (rawmode == false))
		pg = pg.replace(/\{\{\{((.|\n)*?)\}\}\}/g, "");
	else
		pg = pg.replace(/(\{|\})(\1)(\1)/g, "$1<"+"!-- -"+"->$2<"+"!-- -"+"->$3");
	// remove wiki and html that should not be viewed when previewing wiki snippets
	return pg.replace(reScriptTags, "").
			replace(reAnyXHTML, "");
};

woas.get_text = function (title) {
	var pi = this.page_index(title);
	if (pi==-1)
		return null;
	return this.get__text(pi);
};

woas.get_text_special = function(title) {
	var ns = this.get_namespace(title);
	var text = null;
	if (ns.length) {
//		woas.log("namespace of "+title+" is "+namespace);	// log:0
		title = title.substring(ns.length);
		if (!title.length) return this._get_namespace_pages(ns);
		switch (ns) {
			case "Special::":
				text = this._get_special(title, false);
				if (text === false) text = null;
			break;
			case "Tagged::":
				text = this.special_tagged(title);
			break;
			default:
				text = this.get_text(ns+title);
		}
	} else
		text = this.get_text(title);
	return text;
};

woas.__last_title = null;

woas.__password_finalize = function(pwd_obj) {
	d$.show_ni("woas_wiki_area");
	document.title = this.__last_title;
	d$.hide("woas_pwd_mask");
//	scrollTo(0,0);
	// hide input form
	pwd_obj.value = "";
	pwd_obj.blur();
	this.ui.blur_textbox();
};

woas._set_password = function() {
	this.__last_title = document.title;
	document.title = "Enter password";
	// hide browser scrollbars and show mask
	d$.show("woas_pwd_mask");
	d$.hide_ni("woas_wiki_area");
	scrollTo(0,0);
	// show input form
	d$.show_ni("woas_pwd_query");
	d$("woas_password").focus();	
	this.ui.focus_textbox();
};

woas._password_cancel = function() {
	this.__password_finalize(d$("woas_password"));
};

woas._password_ok = function() {
	var pwd_obj = d$("woas_password");
	var pw = pwd_obj.value;
	if (!pw.length) {
		this.alert(this.i18n.PWD_QUERY);
		return;
	}
	this.AES.setKey(pw);
	this.__password_finalize(pwd_obj);
};

//TODO: specify interactive-mode
woas.get__text = function(pi) {
	// is the page encrypted or plain?
	if (!this.is__encrypted(pi))
		return pages[pi];
	this.pager._decrypt_failed = true;
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
				this.last_AES_page = "";
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
		this.last_AES_page = page_titles[pi];
//		if (pg != null)
//			break;
	if (!this.config.key_cache)
		this.AES.clearKey();
	if (pg !== null) {
		this.pager._decrypt_failed = false;
//		if (this.config.key_cache)			this.last_AES_page = page_titles[pi];
	} else {
		this.alert(this.i18n.ACCESS_DENIED.sprintf(page_titles[pi]));
//		AES_clearKey();
		this.last_AES_page = "";
	}
	this.progress_finish();
	return pg;
};

woas.set__text = function(pi, text) {
	this.log("Setting wiki text for page #"+pi+" \""+page_titles[pi]+"\"");	// log:1
	if (this.is__embedded(pi) && !this.is__image(pi))
		text = this.base64.encode(text);
	if (!this.is__encrypted(pi)) {
		pages[pi] = text;
		return;
	}
	pages[pi] = this.AES.encrypt(text);
	this.last_AES_page = page_titles[pi];
};

woas.assert_current = function(page) {
	if( current !== page )
		go_to( page ) ;
	else
		this.set_current( page, true);
};

woas._get_embedded = function(cr, etype) {
	var pi = this.page_index(cr);
	if (pi === -1) {
		var P = {body:this.parser.transclude("Special::Embed|"+etype, [])};
		this.parser.syntax_parse(P, []);
		return P.body;
	}
	return this._get__embedded(cr, pi, etype);
};

woas._get__embedded = function (cr, pi, etype) {
	var text=this.get__text(pi);
	if (text==null) return null;
	var xhtml = "";
	
	if (etype=="file") {
		var fn = cr.substr(cr.indexOf("::")+2);
		var pview_data = this.base64.decode(text, 1024), pview_link = "",
			ext_size = Math.ceil((text.length*3)/4);
		//FIXME: is this even correct?
		if (ext_size-pview_data.length>10)
			pview_link = "<"+"div id='_part_display'><"+"em>"+this.i18n.FILE_DISPLAY_LIMIT+
			"<"+"/em><"+"br /><"+"a href='javascript:show_full_file("+pi+")'>"+this.i18n.DISPLAY_FULL_FILE+"<"+"/a><"+"/div>";
		var P = {body: "\n{{{[[Include::"+cr+"]]}}}"+
				"\n\nRaw transclusion:\n\n{{{[[Include::"+cr+"|raw]]}}}"};
		if (!this.is_reserved(cr))
			P.body += "\n\n\n<"+"a href=\"javascript:query_delete_file('"+this.js_encode(cr)+"')\">"+this.i18n.DELETE_FILE+"<"+"/a>\n";
		P.body += "\n";
		
		// correct syntax parsing of nowiki syntax
		var snippets = [];
		this.parser.pre_parse(P, snippets);
		this.parser.syntax_parse(P, snippets);
		this.parser.undry(P, snippets);
		
		xhtml = "<"+"pre id='woas_file_ct' class=\"woas_nowiki woas_embedded\">"+this.xhtml_encode(pview_data)+"<"+"/pre>"+
				pview_link+"<"+"br /><"+"hr />"+this.i18n.FILE_SIZE+": "+_convert_bytes(ext_size)+
				"<"+"br />" + this.last_modified(this.config.store_mts ? page_mts[pi] : 0)+
				"<"+"br /><"+"br />XHTML transclusion:"+
				P.body +
				"<"+"a href=\"javascript:query_export_file('"+this.js_encode(cr)+"')\">"+this.i18n.EXPORT_FILE+"<"+"/a><"+"br />";
		P = null;
	} else { // etype == image
		var img_name = cr.substr(cr.indexOf("::")+2);
		//TODO: do not create a dynamic script! use after_parse hook
		xhtml = this.parser.parse("= "+img_name+"\n\n"+
		"<"+"script type=\"text/javascript\"> setTimeout(\"_img_properties_show('"+
				text.match(/^data:\s*([^;]+);/)[1] + "', "+
				text.length + ", " +
				(text.match(/^data:\s*[^;]*;\s*[^,]*,\s*/)[0]).length+", "+
				(this.config.store_mts ? page_mts[pi] : 0 ) +
				")\");"+
		"<"+"/script>"+
		"<"+"img id=\"woas_img_tag\" class=\"woas_embedded\" src=\""+text+"\" alt=\""+this.xhtml_encode(img_name)+"\" />"+
		"\n\n<"+"div id=\"woas_img_desc\">"+this.i18n.LOADING+"<"+"/div>"+
		"\nSimple transclusion:\n\n{{{[[Include::"+cr+"]]}}}\n\nTransclusion with additional attributes:\n\n{{{[[Include::"+cr+"|border=\"0\" onclick=\"go_to('"+
		this.js_encode(cr)+"')\" style=\"cursor:pointer\"]]}}}\n"+
		"\n<"+"a href=\"javascript:query_delete_image('"+this.js_encode(cr)+"')\">"+this.i18n.DELETE_IMAGE+"<"+"/a>\n"+
		"\n<"+"a href=\"javascript:query_export_image('"+this.js_encode(cr)+"')\">"+this.i18n.EXPORT_IMAGE+"<"+"/a>\n");
	}
	return xhtml;
};

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
	page_mts.push(this.config.store_mts ? Math.round(new Date().getTime()/1000) : 0);
	
	// save this last page
	this.commit(page_titles.length-1);
	
	this.refresh_menu_area();
	return this.set_current(current, true);
};

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
			// return a special value for executed commands
			return false;
	} else
		text = this.get_text(cr);
	if(text === null) {
		if (interactive)
			this.alert(this.i18n.INVALID_SPECIAL);
	}
	return text;
};

// this is quite undocumented
woas.get_javascript_page = function(cr) {
	var emsg = "-", text;
	text = woas.eval(cr, true);
	if (this.eval_failed) {
		this.crash("Dynamic evaluation of '"+cr+"' failed!\n\nError message:\n\n"+this.eval_fail_msg);
		return null;
	}
	// for safety
	if ((typeof text).toLowerCase() != "string")
		return null;
	return text;
};

woas.eval = function(code, return_value) {
	var rv;
	try {
		if (return_value)
			eval("rv = "+code);
		else
			eval(code);
		woas.eval_failed = false;
	}
	catch (e) {
		this.eval_fail_msg = e.toString();
		this.eval_failed = true;
	}
//	woas.log("woas.eval(\""+code+"\", "+return_value+") = "+rv);	//log:0
	return rv;
};

// Load a new current page
// return true if page needs to be saved in history, false otherwise
woas.set_current = function (cr, interactive) {
	// call hooks which decide upon our navigation capabilities
	if (!woas.pager.browse_hook(cr))
		return false;
//	this.log("Setting current page to \""+cr+"\"");	//log:0
	var text, namespace, pi,
		// whether to reset bucket or not
		set_b = false;
	woas.pager.bucket.clear();
	// eventually remove the previous custom script
	if (cr.substring(cr.length-2)==="::") {
		text = this._get_namespace_pages(cr);
		namespace = cr.substring(0,cr.length-2);
		cr = "";
	} else {
		var p = cr.indexOf("::");
		// skip not found references but also null namespace references
		if (p>0) {
			namespace = cr.substring(0,p);
//			this.log("namespace of "+cr+" is "+namespace);	// log:0
			cr = cr.substring(p+2);
				switch (namespace) {
					case "Javascript":
					// this namespace may deprecate many others
					text = this.get_javascript_page(cr);
					if (text === null)
						return false;
					break;
					case "Special":
						text = this._get_special(cr, interactive);
						//the 'false' special value is returned in case of command execution
						if (text === false)
							return true;
						// no such special page exists
						if (text === null)
							return false;
						break;
					case "Tagged":
						text = this.special_tagged(cr);
						if (text === null)
							return false;
						break;
					case "Lock":
						// prevent special pages from being locked
						if (this.is_reserved(cr)) {
							this.alert(this.i18n.CANNOT_LOCK_RESERVED);
							return false;
						}
						pi = this.page_index(cr);
						if (this.AES.isKeySet()) {
							// display a message
							if (confirm(this.i18n.CONFIRM_LOCK.sprintf(cr)+
								(this.last_AES_page ? this.i18n.CONFIRM_LOCK_LAST.sprintf(last_AES_page) : ''))) {
								this._finalize_lock(pi);
								return false;
							}
						}
						text = this.get_text("Special::Lock");
						break;
					case "Unlock":
						pi = this.page_index(cr);
						if (!confirm(this.i18n.CONFIRM_REMOVE_ENCRYPT.sprintf(cr)))
							return false;
						text = this.get_text(cr);
						if (this.pager.decrypt_failed())
							return false;
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
						// unexisting page
						if (pi === -1)
							return false;
						var real_t = page_titles[pi];
/*						if (this.is__embedded(pi)) {
							//TODO: do not use namespace to guess the embedded file type
							text = this._get__embedded(real_t, pi, "file");
						} else { */
						// detect if showing a plugin
						var _pfx = "WoaS::Plugins::";
						if (real_t.substr(0, _pfx.length) === _pfx) {
							text = this.plugins.get(real_t.substr(_pfx.length));
							if (text !== null) {
								if (this.plugins.is_external) {
									text = this.plugins.describe_external(text);
								} else
									text = this._raw_preformatted('div', text, 'woas_core_page woas_nowiki woas_nowiki_multiline');
							}
						} else {
							text = this.get_text(real_t);
							if (text !== null) {
								switch (cr) {
									case "Plugins":
										text = this.parser.parse(text + this.plugins.list());
									break;
									case "Aliases":
									case "Hotkeys":
										case "CSS::Core":
									case "CSS::Boot":
									case "CSS::Custom":
										// page is stored plaintext
										text = this._raw_preformatted('div', text, 'woas_core_page woas_nowiki woas_nowiki_multiline');
									break;
									default:
										// help pages and related resources
										text = this.parser.parse(text);
								} // switch per page title
							} // text not null
						} // plugins/non-plugins

						if(text === null) {
							// called for reset purposes
							this.pager.decrypt_failed();
							return false;
						}
						this._add_namespace_menu(namespace);
						if (namespace.length)
							cr = real_t;
						return this.load_as_current(cr, text, this.config.store_mts ? page_mts[pi] : 0, true);
					case "File":
					case "Image":
						text = this._get_embedded(namespace+"::"+cr, namespace.toLowerCase());
						if(text === null) {
							// called for reset purposes
							this.pager.decrypt_failed();
							return false;
						}
						this._add_namespace_menu(namespace);
						if (namespace.length)
							cr = namespace + "::" + cr;
						var mts;
						if (this.config.store_mts)
							mts = page_mts[this.page_index(namespace+"::"+cr, namespace.toLowerCase())];
						else mts = 0;
						return this.load_as_current(cr, text, mts, true);
					default:
						text = this.get_text(namespace+"::"+cr);
						set_b = true;
				}

		} else {
			namespace = "";
			text = this.get_text(cr);
			set_b = true;
		}
	}
	
	// action taken when no such page exists (or decryption failed)
	if (text === null) {
		if (this.pager.decrypt_failed())
			return false;
		return this._new_page(this.i18n.PAGE_NOT_FOUND, false, namespace.length ? namespace+ "::"+ cr : cr);
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
	// used by some special pages (e.g. backlinks) for page title override
	return this.load_as_current(cr, this.parser.parse(text, false, this.js_mode(cr)), this.config.store_mts ? mts : 0, set_b);
};

// enable safe mode for non-reserved pages
woas.js_mode = function(cr) {
	if (this.config.safe_mode)
		return this.is_reserved(cr) ? 1 : 3;
//	else
	return 1;
};

woas.last_modified = function(mts) {
	// do not show anything when the timestamp is magic (zero)
	if (mts == 0)
		return "";
	return this.i18n.LAST_MODIFIED + (new Date(mts*1000)).toLocaleString();
};

// actually load a page given the title and the proper XHTML
woas.load_as_current = function(title, xhtml, mts, set_b) {
	if (typeof title == "undefined") {
		this.crash("load_as_current() called with undefined title");
		return false;
	}
	
	// used by some special pages (e.g. backlinks) for page title override
	this.parser.render_title = title;
	// the bucket will contain only the rendered page
	if (set_b)
		this.pager.bucket.one(title);

	
	scrollTo(0,0);
	this.log("load_as_current(\""+title+"\", "+set_b+") - "+(typeof xhtml == "string" ? (xhtml.length+" bytes") : (typeof xhtml)));	// log:1
	this.setHTMLDiv(d$("woas_wiki_area"), xhtml);
	this.refresh_mts(mts);

	this._set_title(title);
	
	this.history.go(current);
	
	this.update_nav_icons(title);
	current = title;
	// active menu or page scripts
	this.scripting.activate(this.is_menu(current) ? "menu" : "page");
	return true;
};

woas._finalize_lock = function(pi) {
	this._perform_lock(pi);
	var title = page_titles[pi];
	this.set_current(title, true);
	if (!this.config.key_cache) {
		this.AES.clearKey();
		this.last_AES_page = "";
	} else
		this.last_AES_page = title;
	this.save_page_i(pi);
};

woas._perform_lock = function(pi) {
	pages[pi] = this.AES.encrypt(pages[pi]);
	page_attrs[pi] += 2;
};

woas._add_namespace_menu = function(namespace) {
	if (this.current_namespace === namespace)
		return;
	var pi;
	if (namespace === "")
		pi = -1;
	else // locate the menu for current namespace
		pi = this.page_index(namespace+"::Menu");
	if (pi === -1) {
//		this.log("no namespace menu found");	// log:0
		this.setHTMLDiv(d$("woas_ns_menu_area"), "");
		if (this.current_namespace !== "") {
			d$.hide("woas_ns_menu_area");
			d$.hide("woas_ns_menu_edit_button");
		}
		this.current_namespace = namespace;
		return;
	}
	var menu = this.get__text(pi);
	this.setHTMLDiv(d$("woas_ns_menu_area"), menu === null ? "" : this.parser.parse(menu, false, this.js_mode(namespace+"::Menu")) );
	// show sub-menu
	d$.show("woas_ns_menu_area");
	d$.show("woas_ns_menu_edit_button");
	this.current_namespace = namespace;	
};

// auto-save thread
woas._auto_saver = function() {
	if (woas.save_queue.length && !woas.ui.edit_mode) {
		woas.commit(woas.save_queue);
		woas.menu_display("save", false);
	}
	// always clear previous thread
	clearTimeout(woas._autosave_thread);
	// re-launch the thread
	if (_this.config.auto_save)
		woas._autosave_thread = setTimeout("woas._auto_saver()", woas.config.auto_save);
};

// save configuration on exit
woas._on_unload = function () {
	if (this.save_queue.length)
		this.commit(this.save_queue);
	else {
		if (this.config.save_on_quit && this.cfg_changed)
			this.cfg_commit();
	}
	return true;
};

 // DO NOT use setHTML for the document.body object in IE browsers
woas.setHTML = woas.getHTML = null;

// these are unchanged for all browsers
woas.getHTMLDiv = function(elem) {return elem.innerHTML;};
woas.setHTMLDiv = function(elem, html) {elem.innerHTML = html;};

// when the page is loaded - onload, on_load
woas._on_load = function() {
	// output platform information - note that revision is filled in only in releases
	woas.log("*** WoaS v"+this.version+"-r@@WOAS_REVISION@@"+" started");	// log:1
	
	// store the old length to eventually force full save when entering/exiting WSIF datasource mode
	this._old_wsif_ds_len = this.config.wsif_ds.length;

	// (0) set some browser-tied functions
	if (this.browser.ie) {	// some hacks for IE
		this.setHTML = function(elem, html) {elem.text = html;};
		this.getHTML = function(elem) {return elem.text;};
		var obj = d$("woas_wiki_header");
		obj.style.filter = "alpha(opacity=75);";
		if (this.browser.ie6) {
			d$("woas_wiki_header").style.position = "absolute";
			d$("i_woas_menu_area").style.position = "absolute";
		}
		// IE6/7 can't display logo
		if (!this.browser.ie8) {
			d$.hide("img_logo");
			// replace with css when capability exists:
			d$("woas_logo").style.width = "1%";
		}
	} else {
		this.setHTML = this.setHTMLDiv;
		this.getHTML = this.getHTMLDiv;
		// everyone else needs a logo; will be better when done in css.
		d$("woas_logo").style.width = "35px";
		d$.show("img_logo");
	}
	
	// (1) check integrity of WoaS features - only in debug mode
	if (this.config.debug_mode) {
		this._set_debug(true);
		if (this.tweak.integrity_test) {
			if (!this.integrity_test())
				// test failed, stop loading
				return;
		}
	} else
		this._set_debug(false);

	// (2) load the actual pages (if necessary)
	if (this.config.wsif_ds.length) {
		if (!this._wsif_ds_load(this.config.wsif_ds, this.config.wsif_ds_lock)) {
			// the file load error is already documented to user
			if (this.wsif.emsg !== null) {
				// force debug mode
				this._set_debug(true);
				this.crash("Could not load WSIF pages data!\n"+this.wsif.emsg);
			}
			return;
		}
	}

	// (3) setup some DOM cage objects (read cache)
	this.dom.init();

	// (4) activate the CSS, with eventual fixups for some browsers
	this.css.set(this.get_text("WoaS::CSS::Core")+"\n"+this.get_text("WoaS::CSS::Custom"));
	
	// (5) continue with UI setup
	d$('woas_home_hl').title = this.config.main_page;
	d$('img_home').alt = this.config.main_page;
	
	// properly initialize navigation bar icons
	// this will cause the alternate text to display on IE6/IE7
	var nav_bar = ["back", "forward", "home", "edit", "print", "advanced",
					"cancel", "save", "lock", "unlock", "setkey", "help",
					"top", "debug"];
	for(var i=0,it=nav_bar.length;i < it;++i) {
		this.img_display(nav_bar[i], true);
	}
	
	// customized keyboard hook
	document.onkeydown = woas.ui._keyboard_event_hook;
	
	// Go straight to requested page
	var qpage=document.location.href.split("?")[1];
	if (qpage) {
		current = unescape(qpage);
		// extract the section (if any)
		var p=current.indexOf("#");
		if (p !== -1)
			current = current.substring(0,p);
	}
	
	// (6) initialize extensions - plugins go first so that external javascript/CSS
	// starts loading
	this.setHTML(d$("woas_wait_text"), "Initializing extensions...");
	this.plugins.load();
	this._load_aliases(this.get_text("WoaS::Aliases"));
	this.hotkey.load(this.get_text("WoaS::Hotkeys"));

	if (this.config.permit_edits)
		d$.show("menu_edit_button");
	else
		d$.hide("menu_edit_button");
	
	// enable the auto-save thread
	if (this.config.cumulative_save && this.config.auto_save)
		this._autosave_thread = setTimeout("woas._auto_saver()", this.config.auto_save);
	
	this._editor = new TextAreaSelectionHelper(d$("woas_editor"));

	this.setHTML(d$("woas_wait_text"), "Completing load process...");
	
	// set a hook to be called when loading process is complete
	if (!woas.dom.wait_loading(woas._early_render))
		woas._load_hangup_check(true);
};

// the first page rendering is a delicate process
// plugins and related libraries/CSS must be loaded
// before rendering the first page to prevent some glitches
// to happen, like: missing CSS, missing macros etc
woas._dummy_fn = function() { return; };
woas._load_hangup_check = function(first) {
	// first time we just re-create the spawning thread
	if (!first) {
		if (!woas.dom._loading) {
			woas.log("_load_hangup_check() finished");
			return
		}
		// ask user if he wishes to continue waiting for libraries to finish loading
		if (!confirm(this.i18n.CONTINUE_WAIT_LOAD)) {
			// run the hook like if nothing hung up
			woas.dom._run_post_load_hook();
			woas.log("_load_hangup_check() cancelled");
			return;
		}
	}
	// launch again this thread, every 3s
	woas.log("_load_hangup_check() respawned (still loading: "+woas.dom.get_loading()+")");
	setTimeout("woas._load_hangup_check(false);", 3000);
};
	
woas._early_render = function() {
	woas.history._forward_browse = true; // used to not store backstack
	woas.set_current(current, true);
	woas.refresh_menu_area();
	// feed the current title before running the disable edit mode code
	woas.prev_title = current;
	woas.disable_edit();
	
//	this.progress_finish();
	d$.hide("loading_overlay");
	
	// launching post-load hook
	woas.post_load();	
};

// disable edit-mode after cancel/save actions
woas.disable_edit = function() {
//	woas.log("DISABLING edit mode");	// log:0
	this.ui.edit_mode = false;
	// reset change buffer used to check for page changes
	this.change_buffer = null;
	this.old_title = null;
	// check for back and forward buttons - TODO grey out icons
	this.update_nav_icons(current);
	this.menu_display("home", true);
	if (this.config.cumulative_save)
		this.menu_display("save", (this.save_queue.length!==0));
	else
		this.menu_display("save", false);
	this.menu_display("cancel", false);
	this.menu_display("print", true);
	this.menu_display("setkey", true);
	d$.show("i_woas_text_area");
	// aargh, FF eats the focus when cancelling edit
	d$.hide("edit_area");
	this._set_title(this.prev_title);
};

function _lock_pages(arr) {
	this.alert("Not yet implemented");
}

function _unlock_pages(arr) {
	this.alert("Not yet implemented");
}

woas.edit_allowed = function(page) {
	// can always edit pages if they have an actual data representation
	if (this.tweak.edit_override)
		return (this.page_index(page) != -1);
	// force read-only
	if (!this.config.permit_edits)
		return false;
	if (this.edit_allowed_reserved(page))
		return true;
	// page in reserved namespace
	if (this.is_reserved(page))
		return false;
	// page has readonly bit set
	return !this.is_readonly(page);
};

woas.edit_allowed_reserved = function(page) {
	var _pfx = "WoaS::Plugins::";
	if (page.substr(0, _pfx.length) === _pfx)
		return true;
	// allow some reserved pages to be directly edited/saved
	switch (page) {
		case "WoaS::Aliases":
		case "WoaS::Hotkeys":
		case "WoaS::CSS::Custom":
			return true;
	}
	return false;
};

// setup the title boxes and gets ready to edit text
woas.current_editing = function(page, disabled) {
//	woas.log("current = \""+current+"\", current_editing(\""+page+"\", disabled: "+disabled+")");	// log:0
	this.prev_title = current;
	d$("wiki_page_title").disabled = (disabled && !this.tweak.edit_override ? "disabled" : "");
	d$("wiki_page_title").value = page;
	this.ui.edit_mode = true;
	this._set_title(this.i18n.EDITING.sprintf(page));
	// current must be set BEFORE calling enabling menu edit
//	woas.log("ENABLING edit mode");	// log:0
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
	d$.hide("i_woas_text_area");

	// FIXME! hack to show the editor pane correctly on IE
	if (!this.browser.ie) {
		d$("woas_editor").style.width = window.innerWidth - 35 + "px";
		d$("woas_editor").style.height = window.innerHeight - 180 + "px";
	} else {
		d$("woas_editor").style.width = document.documentElement.clientWidth - 35 + "px";
		d$("woas_editor").style.height = document.documentElement.clientHeight - 180 + "px";
	}
	d$.show("edit_area");

	d$("woas_editor").focus();
	current = page;
	scrollTo(0,0);
};

woas.change_buffer = null;
woas.old_title = null;

// sets the text and allows changes monitoring
woas.edit_ready = function (txt) {
	d$("woas_editor").value = txt;
	// save copy of text to check if anything was changed
	// do not store it in case of ghost pages
	this.change_buffer = txt;
	this.old_title = d$("wiki_page_title").value;
};

woas.edit_page = function(page) {
	// can't edit again if already editing
	if (this.ui.edit_mode)
		return false;
	if (!this.edit_allowed(page)) {
		woas.log("Not allowed to edit page "+page);	// log:1
		return false;
	}
	_servm_alert();
	var tmp = this.get_text(page);
	if (tmp===null) return false;
	if (this.is_embedded(page) && !this.is_image(page))
		tmp = this.base64.decode(tmp);
	// setup the wiki editor textbox
	this.current_editing(page, this.is_reserved(page));
	this.edit_ready(tmp);
	return true;
};

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
	if (title.indexOf("[")!==-1 || title.indexOf("]")!==-1 ||
		title.indexOf("{")!==-1 || title.indexOf("}")!==-1 ||
		title.indexOf("<") !== -1 || title.indexOf(">")!==-1 ||
		title.indexOf("|")!==-1 || title.indexOf(":::")!==-1) {
		this.alert(this.i18n.INVALID_TITLE);
		return false;
	}
	if (title.substr(-2)==="::") {
		this.alert(this.i18n.ERR_PAGE_NS);
		return false;
	}
	var ns = this.get_namespace(title, true);
	if (ns.length && this.is_reserved(ns+"::") && !this.tweak.edit_override) {
		this.alert(this.i18n.ERR_RESERVED_NS.sprintf(ns));
		return false;
	}
	return true;
};

woas.rename_page = function(previous, newpage) {
	woas.log("Renaming "+previous+" to "+newpage);	// log:1
	if (this.page_index(newpage)!=-1) {
		this.alert(this.i18n.PAGE_EXISTS.sprintf(newpage));
		return false;
	}
	// this is the actual rename operation
	var pi = this.page_index(previous);
	page_titles[pi] = newpage;
	// variables used to change all occurrencies of previous title to new title
	var reTitles = new RegExp("\\[\\[(Include::)?" + RegExp.escape(previous) + "(\\]\\]|\\|)", "g"),
		// the original page (dried)
		P = {body:null},
		// the expanded
		NP = {body:null},
		changed,
		snippets,
		ilen;
	for(var i=0,l=pages.length;i < l;i++) {
		P.body = this.get_page(i);
		if (P.body === null)
			continue;
		changed = false;
		snippets = [];
		// the parser will know what to take away from the page
		this.parser.dry(P, NP, snippets);
		// replace direct links and transclusion links
		NP.body = NP.body.replace(reTitles, function (str, inc) {
			changed = true;
			ilen = 2 + inc.length;
			return str.substr(0, ilen)+newpage+str.substr(previous.length+ilen);
		});
		if (changed) {
			// clear dynamic newlines
			NP.body = NP.body.replace(this.parser.reNL_MARKER, "");
			this.parser.undry(NP, snippets);
			this.set__text(i, NP.body);
		}
		P.body = NP.body = snippets = null;
	}
	if (previous === this.config.main_page)
		this.config.main_page = newpage;
	// make sure that previous title is consistent
	if (this.prev_title === previous)
		this.prev_title = newpage;
	//TODO: propagate rename to backstack and forstack!
	return true;
};

woas.get_raw_content = function() {
	var c=d$("woas_editor").value;
	// remove CR added by some browsers
	//TODO: check if ie8 still adds these
	if (this.browser.ie || this.browser.opera)
		c = c.replace("\r\n", "\n");
	return c;
};

// action performed when save is clicked
woas.save = function() {
	// you can't save if not editing
	if (!this.ui.edit_mode)
		return false;
	// we will always save ghost pages if save button was hit
	var null_save = !this._ghost_page, was_ghost = this._ghost_page;
	// always reset ghost page flag
	this._ghost_page = false;
	woas.log("Ghost page disabled"); //log:1
	// when this function is called in non-edit mode we perform a full commit
	// for cumulative save
	if (this.config.cumulative_save && !this.ui.edit_mode) {
		this.full_commit();
		this.menu_display("save", false);
		return;
	}
	var raw_content = this.get_raw_content();
	
	// check if this is a null save only if page was not a ghost page
	if (null_save)
		null_save = (raw_content === this.change_buffer);
	
	var can_be_empty = false, skip = false, renaming = false;
	switch(current) {
		case "WoaS::CSS::Custom":
			if (!null_save) {
				this.css.set(this.get_text("WoaS::CSS::Core")+"\n"+raw_content);
				this.pager.set_body(current, raw_content);
			}
			back_to = this.prev_title;
			break;
		case "WoaS::Aliases":
			if (!null_save)
				this._load_aliases(raw_content);
			can_be_empty = true;
			// fallback wanted
			skip = true;
		case "WoaS::Hotkeys":
			if (!skip && !null_save)
				this.hotkey.load(raw_content);
			// fallback wanted
		default:
			// check if text is empty (page deletion)
			if (!null_save && !can_be_empty && (raw_content === "")) {
				if (confirm(this.i18n.CONFIRM_DELETE.sprintf(current))) {
					this.plugins.delete_check(current);
					this.delete_page(current);
					this.disable_edit();
					back_or(this.config.main_page);
				}
				return;
			} else {
				var new_title = this.trim(d$("wiki_page_title").value);
				renaming = (this.old_title !== new_title);
				// do not glitch when creating a new page
				if (was_ghost)
					this.prev_title = new_title;
				// here the page gets actually saved
				if (!null_save || renaming) {
					// disallow empty titles
					if (renaming && !this.valid_title(new_title))
						return false;
					// rename before eventually setting the changes
					if (renaming) {
						if (!this.rename_page(this.old_title, new_title))
							return false;
					}
					// actually set text only if it was changed
					if (!null_save)
						this.pager.set_body(new_title, raw_content);
					var maybe_plugin;
					if (this.is_menu(new_title)) {
						if (renaming || !null_save) {
							this.refresh_menu_area();
							back_to = this.prev_title;
						}
						maybe_plugin = false;
					} else {
						back_to = new_title;
						maybe_plugin = true;
					}
					// update the plugin if this was a plugin page
					// NOTE: plugins are not allowed to be renamed, so
					// old title is equal to new title
					if (maybe_plugin) {
						var _pfx = "WoaS::Plugins::";
						if (new_title.substr(0, _pfx.length) === _pfx) {
							// we do not directly call _update_plugin because
							// plugin does not exist before creation so disabling it
							// would fail
							this.plugins.disable(new_title.substr(_pfx.length));
							this.plugins.enable(new_title.substr(_pfx.length));
						}
					}
				} else { // not renaming and not changed text
					back_to = this.prev_title;
					// do not glitch when creating a new page
				}
			}
	}

	var saved = current;
//	if (back_to !== null)
		this.set_current(back_to, true);
/*	else { // used for CSS editing
		back_or(this.config.main_page);
		//TODO: refresh mts?
	} */
	if (!null_save || renaming)
		this.refresh_menu_area();
	this.disable_edit();
	if (!null_save || renaming)
		this.save_page(saved);
};

woas.save_page = function(title) {
	return this.save_page_i(this.page_index(title));
};

woas.save_page_i = function(pi) {
	// update the modified time timestamp (only when not in dev-mode)
	if (!this.tweak.edit_override)
		page_mts[pi] = this.config.store_mts ? Math.round(new Date().getTime()/1000) : 0;
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
		woas.log("save_queue = ("+this.save_queue+")");	// log:1
		return true;
	}
	return this.commit([pi]);
};

woas.create_breadcrumb = function(title) {
	var tmp=title.split("::");
	if (tmp.length===1)
		return title;
	var s="", partial="", js="";
	for(var i=0;i < tmp.length-1;i++) {
		// editing is active
		if (this.ui.edit_mode)
			s+= tmp[i]+" :: ";
		else {
			partial += tmp[i]+"::";
			js = "go_to('"+this.js_encode(partial)+"')";
			s += "<"+"a title=\""+this.xhtml_encode(tmp[i])+"\" href=\"javascript:"+js+"\" onclick=\""+js+"; return false;\">"+tmp[i]+"<"+"/a> :: ";
		}
	}
	// add page title
	return s+tmp[tmp.length-1];
};
