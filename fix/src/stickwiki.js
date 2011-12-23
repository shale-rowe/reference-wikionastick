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
	return this.utf8.do_escape(src.replace(/&/g, '&amp;').replace(reMinorG, '&lt;').
			replace(/>/g, '&gt;')); // .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

// DO NOT modify this list! these are namespaces that are reserved to WoaS
var reserved_namespaces = ["Special", "WoaS", "Lock", "Locked", "Unlocked",
		"Unlock", "Tags?", "Tagged", "Untagged", "Include", "Javascript"];

// create the regex for reserved namespaces
var reserved_rx = "^(?:";
for(var i = (woas.tweak.edit_override ? 2 : 0);i < reserved_namespaces.length - 1;i++) {
	reserved_rx += reserved_namespaces[i] + "|";
}
reserved_rx += reserved_namespaces[i] + ")::";
woas._reserved_rx = new RegExp(reserved_rx, "i");
reserved_namespaces = reserved_rx = null;

// return page index (progressive number) given its title
woas.page_index = function(title) {
	return page_titles.indexOf(this.title_unalias(title));
};

woas.is_reserved = function(page) {
	return (page.search(this._reserved_rx) == 0);
};

woas.is_menu = function(title) {
	return title.substr(-6) === '::Menu' && title !== 'WoaS::Help::Menu';
};

// returns namespace with trailing ::
woas.get_namespace = function(page, root_only) {
	var	p = root_only ? page.indexOf("::") : page.lastIndexOf("::");
	return p === -1 ? "" : page.substring(0, p + 2);	
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
// PVHL: the above description doesn't seem to work anymore. For this function a page exists if
// clicking on it would produce a page; e.g. a real or dynamic page. A listing page always
// produces a page, as does an entry in pages. For WoaS and Special it depends on edit_override
// whether is_reserved is accurate. Need to check properly.
woas.page_exists = function(page) {
//	return (this.is_reserved(page) || (page.substring(page.length-2)==="::") || (this.page_index(page)!==-1));
	var exists = false, s = /^Special::/, w = /^WoaS::/;
	exists = ((page.substring(page.length-2)==="::") || (this.page_index(page)!==-1));
	if (!exists && this.is_reserved(page) && !(s.test(page) || w.test(page))) {
		exists = true;
	}
	if (!exists && s.test(page)) {
		for (i = 0; i < this.shortcuts.length; ++i) {
			if (page.substr(9) === this.shortcuts[i]) {
				exists = true;
				break;
			}
		}
	}
	return exists;
};

// with two trailing colons 'xx::'
woas._get_namespace_pages = function (ns) {
	var pg = [], i, l;
	switch (ns.substr(0, ns.indexOf('::'))) {
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
	case "Special":
		for (i = 0; i < this.shortcuts.length; ++i) {
				pg.push(ns + this.shortcuts[i]);
		}
		for(i = 0, l = page_titles.length; i < l; ++i) {
			if (page_titles[i].indexOf(ns) === 0
					// don't show pages used by special functions unless override
					&& (woas.tweak.edit_override ||
					(page_titles[i] !== 'Special::Embed' && page_titles[i] !== 'Special::Lock'))){
				pg.push(page_titles[i]);
			}
		}
		return this._join_list(pg);
	case "Tag":
	case "Tags":
	case "Include":
	case "Lock":
	case "Unlock":
	case "Javascript":
		// these should not be viewed as a namespace
		return woas.i18n.NOT_A_NS.sprintf(ns);
	}

	for(i = 0, l = page_titles.length; i < l; ++i) {
		if (page_titles[i].indexOf(ns) === 0)
			pg.push(page_titles[i]);
	}
	return !pg.length ? woas.i18n.EMPTY_NS.sprintf(ns) : this._join_list(pg);
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
	document.title = this.__last_title;
	this.ui.display({pswd:false});
	// hide input form
	pwd_obj.value = "";
	pwd_obj.blur();
	this.ui.blur_textbox();
};

woas._set_password = function() {
	this.__last_title = document.title;
	document.title = "Enter password";
	// hide browser scrollbars and show mask
	this.ui.display({pswd:true});
	d$("woas_password").focus();	
	this.ui.focus_textbox();
};

woas._password_cancel = function() {
	this.__password_finalize(d$("woas_password"));
};

// PVHL: input now accepts password if enter has been pressed
// see woas.htm for use. (My own design; needs onkeydown in some browsers
// instead of onkeypress for some reason I haven't worked out yet.
woas._password_ok = function(el, e) {
	// test for enter key pressed
	var flag = e ? (e.which || e.keyCode) === 13 : true, pw;
	if (flag) {
		pw = el.value;
		if (!pw.length) {
			this.alert(this.i18n.PWD_QUERY);
		} else {
			this.AES.setKey(pw);
			this.__password_finalize(el);
		}
	}
	return true;
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
		this.go_to( page ) ;
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
		
		// correct syntax parsing of nowiki syntax (also does macros and XHTML comments)
		var snippets = [];
		this.parser.pre_parse(P, snippets);
		this.parser.syntax_parse(P, snippets);
		
		xhtml = this.parser._raw_preformatted("pre", pview_data, 'woas_embedded')+
			pview_link+"<"+"br /><"+"hr />"+this.i18n.FILE_SIZE+": "+_convert_bytes(ext_size)+
			"<"+"br />" + this.last_modified(this.config.store_mts ? page_mts[pi] : 0)+
			"<"+"br /><"+"br />XHTML transclusion:"+P.body+
			"<"+"a onClick=\"query_export_file('"+this.js_encode(cr)+"')\">"+this.i18n.EXPORT_FILE+
			"<"+"/a><"+"br />";
		P = null;
	} else { // etype == image
		// PVHL: modified to handle errors and remove export where not possible
		// TODO: replace all text with i18n strings; add 'get Firefox' link
		//   this all needs to be coming from pages that can be formatted
		//   can be much improved -- just to get it working right now.
		// Can also load dynamically from page -- allows error gathering.
		// Those browsers that can't embed should not be shown an embed page.
		var img_name = cr.substr(cr.indexOf("::")+2), ff = this.browser.firefox,
			mime = text.match(/^data:\s*([^;]+);/)[1],
			tot_len = text.length,
			enc_len = text.match(/^data:\s*[^;]*;\s*[^,]*,\s*/)[0].length,
			mts = (this.config.store_mts ? page_mts[pi] : 0 ),
			fn = "=\"_img_properties_show('"+mime+"',"+tot_len+","+enc_len+ ","+mts;
			load = this.browser.ie6 // instead create description string here
				? 'class="woas_hide" />/This browser can\'t display images yet./'+"\n\n"+
				  woas.i18n.MIME_TYPE+": "+mime+"\n"+woas.i18n.FILE_SIZE+": about "+
				  _convert_bytes(((tot_len-enc_len)*3)/4, 1)+
				  woas.i18n.B64_REQ.sprintf(_convert_bytes(tot_len, 1))+
				  "\n"+woas.last_modified(mts)
				: "onload"+fn+")\"; onerror"+fn+",true)\" /><"+
				"div id=\"woas_img_desc\">"+this.i18n.LOADING+"<"+"/div>";
		// PVHL: use my quick & simple macro parser
		xhtml = this.macro._parse("= "+img_name+"\n\n\n"+"<"+"img id=\"woas_img_tag\" src=\""+
			text+"\" alt=\""+this.xhtml_encode(img_name)+"\" "+load+
			"\n\nSimple transclusion:\n\n{{{[[Include::"+cr+
			"]]}}}\n\nTransclusion with additional attributes:\n\n{{{[[Include::"+cr+
			"|border=\"0\" onclick=\"woas.go_to('"+this.js_encode(cr)+
			"')\" style=\"cursor:pointer\"]]}}}\n\n<"+"a onClick=\"query_delete_image('"+
			this.js_encode(cr)+"')\" class=\"woas_link\">"+this.i18n.DELETE_IMAGE+"<"+"/a>\n"+
			(ff ? "\n<"+"a id=\"woas_img_export\" onClick=\"query_export_image('"+
			this.js_encode(cr)+"')\" class=\"woas_link\">"+this.i18n.EXPORT_IMAGE+"<"+"/a>\n"
			: '\n/This browser can\'t export images yet: *get Firefox!* /'));
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
	this.commit([page_titles.length-1]);
	
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
			this.alert(this.i18n.INVALID_PAGE.sprintf('Special'));
	}
	return text;
};

woas.get_javascript_page = function(cr) {
	var text = woas.eval(cr, true);
	if (this.eval_failed) {
		woas.log(this.i18n.JS_PAGE_FAIL1.sprintf(cr) +
			this.i18n.JS_PAGE_FAIL2 + this.eval_fail_msg);
		return null;
	}
	// safety check; returned value contains 'body' or ['title', 'body']
	// body can be null if type is not array, otherwise type must be array and
	// title can be empty, but body must exist (dynamic page creation)
	if ((typeof text) === "undefined" ||
			(!(text instanceof Array) && (typeof text) === "string") ||
			((text instanceof Array) && text.length === 2 &&
				(typeof text[0]) === 'string' && (typeof text[1]) === 'string'
				&& text[1])) {
		return text || null;
	}
	this.log(this.i18n.JS_PAGE_FAIL1.sprintf(cr) + this.i18n.JS_PAGE_FAIL3
		.sprintf(text, text instanceof Array ? 'array' : typeof text));
	return null;
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
// return true if page was successfully loaded
// PVHL: needs to handle section references;
//   no_history added for Lock/Unlock/Options, etc. to stop history problems
woas.set_current = function (cr, interactive, keep_fwd) {
	// pager.browse_hook determines if cr is allowed to be set
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
						if (text === null) {
							return false;
						} else if (text instanceof Array) {
							// allows function to return [title, body]
							if (!text[1]) {
								return false;
							}
							// title allowed to be empty string: 'Javascript::'
							cr = text[0] || '';
						}
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
								(this.last_AES_page ? this.i18n.CONFIRM_LOCK_LAST.sprintf(this.last_AES_page) : ''))) {
								this._finalize_lock(pi);
								return false;
							}
						}
						text = this.get_text("Special::Lock");
						break;
					case "Unlock":
						pi = this.page_index(cr);
						// PVHL: Just a preventive; could be a bug: only unlock if locked;
						//   maybe the wrong place but OK for now
						if (pi !== -1 && (page_attrs[pi] & 0x2)) {
							if (!confirm(this.i18n.CONFIRM_REMOVE_ENCRYPT.sprintf(cr)))
								return false;
							text = this.get_text(cr);
							if (this.pager.decrypt_failed())
								return false;
							pages[pi] = text;
							page_attrs[pi] ^= 0x2;
							if (!this.config.key_cache)
								this.AES.clearKey();
							if (this.set_current(cr, true, true)) {
								this.save_page(cr);
								return true;
							}
						}
						return false;
					case "WoaS":
						pi = woas.page_index(namespace+"::"+cr);
						// unexisting page
						if (pi === -1) {
							if (interactive) {
								this.alert(this.i18n.INVALID_PAGE.sprintf('WoaS'));
							}
							return false;
						}
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
									text = this.parser._raw_preformatted('pre', text,
										'woas_core_page');
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
										text = this.parser._raw_preformatted('pre', text,
											'woas_core_page');
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
	return this.load_as_current(cr, this.parser.parse(text, false, this.js_mode(cr)),
		this.config.store_mts ? mts : 0, set_b, keep_fwd);
};

// enable safe mode for non-reserved pages
woas.js_mode = function(cr) {
	return this.config.safe_mode && !this.is_reserved(cr) ? 3 : 1;
};

// no is optional; used by recently modified page
woas.last_modified = function(mts, no) {
	// do not show anything when the timestamp is magic (zero)
	if (mts == 0)
		return "";
	return (no ? "" : this.i18n.LAST_MODIFIED) + (new Date(mts*1000)).toLocaleString();
};

// actually load a page given the title and the proper XHTML
woas.load_as_current = function(title, xhtml, mts, set_b, keep_fwd) {
	if (typeof title == "undefined") {
		this.crash("load_as_current() called with undefined title");
		return false;
	}
	
	// used by some special pages (e.g. backlinks) for page title override
	this.parser.render_title = title;
	// the bucket will contain only the rendered page
	if (set_b)
		this.pager.bucket.one(title);
	this.ui.top();
//	this.log("load_as_current(\""+title+"\", "+set_b+") - "+(typeof xhtml == "string" ? (xhtml.length+" bytes") : (typeof xhtml)));	// log:0
	this.setHTMLDiv(d$("woas_page"), xhtml);
	this.refresh_mts(mts);
	this.history.go(title, keep_fwd);
	current = title;
	this.ui.refresh_menu();
	// activate menu or page scripts
// PVHL: FIX - menu can be activated twice
	this.scripting.activate(this.is_menu(current) ? "menu" : "page");
	this._set_title(title);
	this.update_view();
	//this.log(this.history.log_entry());	// log:0
//if (console) console.log('load_as_current: ' + this.history.log_entry());
	return true;
};

woas._finalize_lock = function(pi, back) {
	this._perform_lock(pi);
	var title = page_titles[pi];
	if (!this.config.key_cache) {
		this.AES.clearKey();
		this.last_AES_page = "";
	} else
		this.last_AES_page = title;
	if (back) { // only if called from Lock:: page
		this.ui.back();
	} else {
		// need to refresh display; no history
		this.set_current(title, true, true);
	}
	// PVHL: moved because current page was saved as 'Lock::xxx'
	this.save_page_i(pi);
};

woas._perform_lock = function(pi) {
	// PVHL: Just a preventive; may be a bug that could lock twice:
	//   only lock if unlocked
	if (!(page_attrs[pi] & 0x2)) {
		pages[pi] = this.AES.encrypt(pages[pi]);
		page_attrs[pi] |= 0x2;
	}
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

woas._on_unload = function () {
	// close down Print & Help windows if they exist
	// Doesn't work in recent Opera
	if (this.popup_window && !this.popup_window.closed) {
		this.popup_window.close();
	}
	if (this.help_system.popup_window && !this.help_system.popup_window.closed) {
		this.help_system.popup_window.close();
	}
	// PVHL: These saves don't work; will leave code here for now. Testing
	//	 showed delayed save failures so delayed save was removed as an option
	//   (risky); config save was removed as it used to corrupt content; this
	//   (useless?) option actually saves the whole file currently IIRC.
	if (this.save_queue.length)
		this.commit(this.save_queue);
	else {
		if (this.config.save_on_quit && this.cfg_changed)
			this.cfg_commit();
	}
	return true;
};

// these are unchanged for all browsers
woas.getHTMLDiv = function(elem) {return elem.innerHTML;};
woas.setHTMLDiv = function(elem, html) {elem.innerHTML = html;};

// when the page is loaded - onload, on_load
woas._on_load = function() {
	// set up log functions so enable/disable does not require reload
	this._set_debug(this.config.debug_mode, this.config.debug_closed);
	d$("woas_debug_log").value = ""; // for Firefox
	// output platform information - note that revision is filled in only in releases
	woas.log("*** WoaS v"+this.version+"-r@@WOAS_REVISION@@"+" started");	// log:1
	// needed to check if data source changes; forces full save when entering/exiting
	// WSIF datasource mode or changing the name of the data source file
	this._old_wsif_ds = is_windows
		// convert unix path to windows path
		? this.config.wsif_ds.replace(reFwdSlash, '\\')
		: this.config.wsif_ds;

	// (0) set some browser-tied functions
	// PVHL: is the following warning still true? Take out of onload function
	// DO NOT use setHTML for the document.body object in IE browsers
	if (this.browser.ie && Number(this.browser.ie) < 9) {	// some hacks for IE
		this.setHTML = function(elem, html) {elem.text = html;};
		this.getHTML = function(elem) {return elem.text;};
	} else {
		this.setHTML = this.setHTMLDiv;
		this.getHTML = this.getHTMLDiv;
	}

	// (1) check integrity of WoaS features - only in debug mode
	if (this.log() && this.tweak.integrity_test && !this.integrity_test()) {
		// test failed, stop loading
		return;
	}

	// (2) load the actual pages (if necessary)
	if (this.config.wsif_ds.length) {
		// make sure file path is good for current browser
		var path = is_windows
			? this.config.wsif_ds.replace(reFwdSlash, '\\')
			: this.config.wsif_ds.replace(/\\/g, '/');
		if (!this._wsif_ds_load(path, this.config.wsif_ds_lock)) {
			// the file load error is already documented to user
			if (this.wsif.emsg !== null) {
				// force debug mode
				this._set_debug(true);
				this.crash("Could not load WSIF pages data!\n"+this.wsif.emsg);
			}
			return;
		}
	}

	// PVHL: if current doesn't exist can't continue; could have been done
	// earlier but this allows future enhancements (load default from wsif)
	if (!current) {
		// should modify to allow choice from among available pages;
		// this shouldn't be possible though - current should always be set
		this._set_debug(true);
		this.crash('No initial page setting found: can\'t continue!');
	}
	// (3) setup some DOM cage objects (read cache)
	this.dom.init();

	// (4) activate the CSS, with eventual fixups for some browsers
	this.css.set(this.get_text("WoaS::CSS::Core")+"\n"+this.get_text("WoaS::CSS::Custom"));

	// (5) continue with UI setup
	this.ui.img_display(); /* turn off images if data_uri doesn't work */
	d$('woas_home').title = this.config.main_page;
	this.ui.set_header(this.config.fixed_header);
	this.ui.set_menu(this.config.fixed_menu);

	// customized keyboard hook
	document.onkeydown = woas.ui._keyboard_event_hook;

	// (6) initialize extensions - plugins go first so that external javascript/CSS
	// starts loading
	this.setHTML(d$("woas_wait_text"), "Initializing extensions...");
	this.plugins.load();
	this._load_aliases(this.get_text("WoaS::Aliases"));
	this.hotkey.load(this.get_text("WoaS::Hotkeys"));

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
	
// no 'this' for this function
// PVHL: should load document location here for later use as well
woas._early_render = function() {
	// PVHL: handle requested page in location: woas.html?page%20name#sect_name
	//   If page doesn't exist current is loaded instead.
	//   should add ability to give the href of pages and sections to user
	var loc = woas.trim(unescape(document.location.href.split('?')[1] || '')),
		page = loc.split('#')[0] || '',
		hash = document.location.href.split('#')[1],
		cr_bkup = current;
	hash = hash ? '#' + woas.parser.heading_anchor(unescape(hash), true) : ''; // see if IE needs null check
	if (!page || page_titles.indexOf(page) === -1) {
		// no such page;
		page = current;
	} else {
		cr_bkup = page;
	}
	// feed the current title before running the disable edit mode code
	woas.prev_title = cr_bkup;
	woas.disable_edit();
	// goto requested page or default (current; always exists by this point)
	// force go_to to load even if current
	current = '';
	woas.go_to(page + hash);
	current = cr_bkup;
//	this.progress_finish();
	woas.ui.display({wait: false});
	// launching post-load hook
	woas.post_load();
	// PVHL: awful hack may not be needed once scroll_wrap used
	//if (hash && woas.browser.webkit) {
	//	setTimeout('woas.go_to("'+hash+'")',0);
	//}
};

// disable edit-mode after cancel/save actions and on initial load
woas.disable_edit = function() {
//	woas.log("DISABLING edit mode");	// log:0
	// reset change buffer used to check for page changes
	this.ui.edit_mode = false;
	this.change_buffer = null;
	this.old_title = null;
	if (woas._ghost_page) {
		woas._ghost_page = false;
		woas.log("Ghost page disabled"); //log:1
	}
	this.ui.top();
	this.log(); // scroll to bottom of log
	this._set_title(this.prev_title);
	//woas.log(woas.history.log_entry()); //log:0
//if (console) console.log('disable edit: ' + this.history.log_entry());
};

function _lock_pages(arr) {
	this.alert(woas.i18n.NOT_YET_IMPLEMENTED);
}

function _unlock_pages(arr) {
	this.alert(woas.i18n.NOT_YET_IMPLEMENTED);
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
woas.current_editing = function(page, disabled, txt) {
//	woas.log("ENABLING edit mode");	// log:0
//	woas.log("current = \""+current+"\", current_editing(\""+page+"\", disabled: "+disabled+")");	// log:0
	_servm_alert();
	this.ui.edit_mode = true;
	this.prev_title = current;
	current = page;
	d$("wiki_page_title").disabled = (disabled && !this.tweak.edit_override ? "disabled" : "");
	d$("wiki_page_title").value = this.old_title = page;
	// save copy of text to check if anything was changed
	// do not store it in case of ghost pages
	d$("woas_editor").value = this.change_buffer = txt;
	this._set_title(this.i18n.EDITING.sprintf(page));
	woas.ui.display({view: false, edit: true}, true);
	d$("woas_editor").focus();
};

// PVHL: apparently removed - left here for now
woas.edit_ready = function (txt) {
	woas.log("Called woas.edit_ready!");	// log:1
	return;
}

woas.edit_page = function(page) {
	// can't edit again if already editing
	if (this.ui.edit_mode)
		return false;
	if (!this.edit_allowed(page)) {
		woas.log("Not allowed to edit page "+page);	// log:1
		return false;
	}
	var tmp = this.get_text(page);
	if (tmp===null) return false;
	if (this.is_embedded(page) && !this.is_image(page))
		tmp = this.base64.decode(tmp);
	// setup the wiki editor textbox
	this.current_editing(page, this.is_reserved(page), tmp);
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
	if (title.match(/(\[|\]|\{|\}|\<|\>|\||\#|\"|:::)/)) {
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
		// dry removes nowiki/macros/comments, but without dynamic newlines
		this.parser.dry(P, NP, snippets);
		// replace direct links and transclusion links
		NP.body = NP.body.replace(reTitles, function (str, inc) {
			changed = true;
			inc = inc || '';
			ilen = 2 + inc.length;
			return str.substr(0, ilen)+newpage+str.substr(previous.length+ilen);
		});
		if (changed) {
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
	this.history.rename(previous, newpage);
	return true;
};

woas.get_raw_content = function() {
	var c = d$("woas_editor").value;
 	// remove CR added by some browsers
 	//TODO: check if ie8 still adds these
	// PVHL: ie8 does, ie9 doesn't; changed so it doesn't matter
	// though a fixed Opera will take longer ... insignificant,
	// and I will change in new version (function as found didn't work anyway)
	if (((this.browser.ie && this.browser.ie < 9) || this.browser.opera) && /\r\n/.test(c)) {
		c = c.replace(/\r\n/g, "\n");
	}
 	return c;
};

// action performed when save is clicked
woas.save = function() {
	if (!this.ui.edit_mode) {
		if (this.config.cumulative_save) {
			// when this function is called in non-edit mode we perform
			// a full commit for cumulative save
			this.full_commit(); // PVHL: this could have failed!
			this.menu_display("save", false);
			return;
		} else {
			// you can't save if not editing
			return false;
		}
	}
	var raw_content = this.get_raw_content(),
		do_save = this._ghost_page || (raw_content !== this.change_buffer),
		back_to = this.prev_title,
		can_be_empty = false,
		skip = false,
		renaming = false,
		menu = false;

	switch(current) {
	case "WoaS::CSS::Custom":
		if (do_save) {
			this.css.set(this.get_text("WoaS::CSS::Core")+"\n"+raw_content);
			this.pager.set_body(current, raw_content);
		}
		break;
	case "WoaS::Aliases":
		if (do_save)
			this._load_aliases(raw_content);
		can_be_empty = true;
		skip = true;
		// fallthrough wanted
	case "WoaS::Hotkeys":
		if (!skip && do_save)
			this.hotkey.load(raw_content);
		// fallthrough wanted
	default:
		// check if text is empty (page deletion)
		if (do_save && (raw_content === "") && !can_be_empty) {
			if (this._ghost_page) {
				this.ui.cancel();
			} else if (confirm(this.i18n.CONFIRM_DELETE.sprintf(current))) {
				this.plugins.delete_check(current);
				this.delete_page(current);
				this.prev_title = current;
				this.disable_edit();
			}
			return;
		} else {
			var new_title = this.trim(d$("wiki_page_title").value);
			renaming = (this.old_title !== new_title);
			do_save |= renaming;
			if (this._ghost_page) {
				// new page needs history
				this.history.store(this.prev_title);
				this.prev_title = new_title;
			}
			if (do_save) {
				// rename if title is valid
				if (renaming && (
						!this.valid_title(new_title) ||
						!this.rename_page(this.old_title, new_title))) {
					return false;
				}
				// actually set text only if it was changed
				if (do_save)
					this.pager.set_body(new_title, raw_content);
				var menu = this.is_menu(new_title);
				// update the plugin if this was a plugin page
				// NOTE: plugins are not allowed to be renamed, so
				// old title is equal to new title
				if (!menu) {
					back_to = new_title;
					var _pfx = "WoaS::Plugins::";
					if (new_title.substr(0, _pfx.length) === _pfx) {
						// we do not directly call _update_plugin because
						// plugin does not exist before creation so disabling it
						// would fail
						this.plugins.disable(new_title.substr(_pfx.length));
						this.plugins.enable(new_title.substr(_pfx.length));
					}
				}
			}
		}
	}
	if (do_save) {
		this.save_page(current);
	}
	this.set_current(back_to, true, true); // don't clear fwd history
	this.disable_edit();
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
	if (title === "::Menu") {
		return title;
	} else if (title.indexOf('Javascript::') === 0) {
		return 'Javascript :: ' + title.substr(12);
	}
	var tmp = title.split("::");
	if (tmp.length === 1)
		return title;
	var s = "", partial = "", js = "", i, il;
	for(i = 0 , il = tmp.length - 1; i < il; i++) {
		// editing is active - PVHL: not used any more?
		if (this.ui.edit_mode)
			s += tmp[i]+" :: ";
		else {
			partial += tmp[i]+"::";
			js = "woas.go_to('"+this.js_encode(partial)+"')";
			// add link to "::" if it isn't on the end of the title
			s += tmp[i] + (tmp[i + 1] ? " <"+"a class=\"woas_link\" title=\"" +
				this.xhtml_encode(partial)+"\" onclick=\"" + js +
				"; return false;\">::<"+"/a> " : " ::");
		}
	}
	// add page title
	return s + tmp[tmp.length-1];
};
