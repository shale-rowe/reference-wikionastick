// core WoaS, WoaS::UI code

// some tweak settings NOT to be touched - warranty void otherwise
woas.tweak = {
	// DANGER: might cause WoaS corruption!
	"edit_override": false,
	// perform integrity test of browser features
	"integrity_test": true
};

woas.cmd_duplicate_page = function() {
	var pname = this._new_page("Insert duplicate page title", true, current+" (duplicate)");
	if (pname === null)
		return;
	var pi = this.page_index(current);
	var dpi = this.page_index(pname);
	// duplicate the page
	pages[dpi] = pages[pi]; // .slice ?
	page_attrs[dpi] = page_attrs[pi];	
	// go to new page
	go_to(pname);
	// commit changes
	this.commit([dpi]);
};

woas.cmd_new_page = function() {
	this._new_page(this.i18n.INSERT_NEW, false, '');
};

// used to create a new page in the wiki
woas._new_page = function(msg, fill_mode, def_title) {
	var title = this._prompt_title(msg, def_title);
	if (title === null)
		return null;
	return this._new_page_direct(title, fill_mode);
};

woas._prompt_title = function(msg, def_title) {
	// disallow editing when wiki is set to read-only
	if (!this.config.permit_edits) {
		this.alert(this.i18n.READ_ONLY);
		return null;
	}
	var title = def_title;
	do {
		title = prompt(msg, title);
		if (title === null)
			break;
		title = this.trim(title);
		if (this.valid_title(title))
			break;
	} while (1);
	if ((title!==null) && title.length) {
		if (this.page_index(title)!=-1)
			this.alert(this.i18n.PAGE_EXISTS.sprintf(title));
		else
			return title;
	}
	return null;
};

woas._new_page_direct = function(title, fill_mode) {
	var ns = this.get_namespace(title, true), cr;
	if (ns.length) {
		ns = ns.substr(0, -2);
		cr = title.substr(ns.length);
	} else cr = title;
	if (!this._create_page(ns, cr, false, fill_mode))
		return ns+cr;
	var upd_menu = (cr==='Menu');
	if (!upd_menu && confirm(this.i18n.ASK_MENU_LINK)) {
		var menu = this.get_text("::Menu");
		p = menu.indexOf("\n\n");
		if (p === -1)
			menu += "\n[["+title+"]]";
		else
			menu = menu.substring(0,p)+"\n[["+title+"]]"+menu.substring(p)+"\n";
		this.set__text(this.page_index("::Menu"), menu);
		upd_menu = true;
	}
	if (upd_menu)
		this.refresh_menu_area();
	return ns+cr;
}

woas.cmd_erase_wiki = function() {
	if (this.erase_wiki()) {
		if (!this.full_commit())
			alert(this.i18n.FAILED_ERASE);
		back_or(this.config.main_page);
	}
	return null;
};

// pages which shall never be modified
woas.static_pages = ["Special::About", "Special::Advanced", "Special::Options","Special::Import",
						"Special::Lock","Special::Search", "Special::Embed",
						"Special::Export", "Special::License", "Special::ExportWSIF",
						"Special::ImportWSIF", "WoaS::Plugins", "WoaS::CSS::Core",
						"WoaS::Template::Button", "WoaS::Template::Info",
						"WoaS::Template::Search", "WoaS::CSS::Boot"];

woas.static_pages2 = ["WoaS::Plugins", "WoaS::CSS::Core",
						"WoaS::Template::Button", "WoaS::Template::Info",
						"WoaS::Template::Search", "WoaS::CSS::Boot"];
						
woas.help_pages = null;
woas.default_pages = ["::Menu", "WoaS::Aliases", "WoaS::Hotkeys", "WoaS::CSS::Custom"];

woas.erase_wiki = function() {
	if (!this.config.permit_edits) {
		this.alert(this.i18n.READ_ONLY);
		return false;
	}
	if (!confirm(this.i18n.CONFIRM_DELETE_ALL1) ||
		!confirm(this.i18n.CONFIRM_DELETE_ALL2))
		return false;
	var i,l,l1,l2,pi,t;
	this.progress_init("Erasing...");
	var backup_pages = [];
	// attributes and last modified timestamps for default pages
	// first entry is for main page
	page_attrs = [0]; page_mts =   [0];
	// zero is the magic timestamp
	for (i=0;i<this.default_pages.length;++i) {
		page_attrs.push(0); page_mts.push(0);
	}
	// build the array of help pages only once
	var help_pfx = "WoaS::Help::";
	if (this.help_pages === null) {
		this.help_pages = [];
		for(i=0,l=page_titles.length;i<l;++i) {
			if (page_titles[i].substr(0, help_pfx.length) === help_pfx)
				this.help_pages.push(page_titles[i].substr(help_pfx.length));
		}
	}
	var copied_help_pages = [];
	// now pick the static pages
	for(i=0,l1=this.static_pages.length,l2=this.help_pages.length,l=l1+l2;i<l;++i) {
		if (i<l1)
			t = this.static_pages[i];
		else
			t = help_pfx+this.help_pages[i-l1];
		pi = this.page_index(t);
		if (pi==-1) {
			this.alert(this.i18n.STATIC_NOT_FOUND.sprintf(t));
			continue;
		} else if (i>=l1)
			copied_help_pages.push(t);
		backup_pages.push(pages[pi]);
		// reset attributes
		page_attrs.push(0);
		// reset timestamp
		page_mts.push(0);
		this.progress_status(i/l);
	}
	// build titles
	page_titles = [ this.config.main_page ];
	page_titles = page_titles.concat(this.default_pages);
	page_titles = page_titles.concat(this.static_pages);
	page_titles = page_titles.concat(copied_help_pages);
	// now build pages
	pages = ["A blank sheet is a catalyst for ideas", "[["+this.config.main_page+"]]\n\n[[Special::All Pages]]\n[[Special::New Page]]\n[[Special::Duplicate Page]]\n[[Special::Go to]]\n[[Special::Delete Page]]\n[[Special::Backlinks]]\n[[Special::Search]]",
			"", this._default_hotkeys(), "/* Your CSS customization goes here */"];
	pages = pages.concat(backup_pages); backup_pages = null;
	current = this.config.main_page;
	this.refresh_menu_area();
	backstack = [];
	forstack = [];
	// reload all extensions
	this._load_aliases(this.get_text("WoaS::Aliases"));
	this._load_hotkeys(this.get_text("WoaS::Hotkeys"));
	this._clear_plugins();
	this._load_plugins(false);

	this.progress_finish();
	return true;
};

woas.cmd_main_page = function() {
	go_to(this.config.main_page);
	return null;
};

woas.cmd_edit_css = function() {
	return this.cmd_edit_special("WoaS::CSS::Custom");
};

//DEPRECATED
woas.cmd_edit_aliases = function() {
	return this.cmd_edit_special("WoaS::Aliases");
};

// used to edit many special pages
woas.cmd_edit_special = function(cr) {
	if (!this.config.permit_edits && !this.tweak.edit_override) {
		this.alert(this.i18n.READ_ONLY);
		return null;
	}
	_servm_alert();
	// get source text (ASCII/UTF-8)
	var tmp = this.get_text(cr);
	if (tmp === null)
		return null;
	// setup the wiki editor textbox
	this.current_editing(cr, this.config.permit_edits | this._server_mode);
	this.edit_ready(tmp);
	return null;
};

woas.cmd_go_to = function() {
	var pname;
	do {
		pname = prompt("Go to page:", current);
		if ((pname !== null) && pname.length)
			if (go_to(pname))
				return;
	} while (pname !== null);
};

woas.cmd_delete = function() {
	// disallow editing when wiki is set to read-only
	if (!this.config.permit_edits) {
		this.alert(this.i18n.READ_ONLY);
		return false;
	}
	var pname = prompt(this.i18n.DELETE_PAGE_PROMPT, current);
	if ((pname === null) || !pname.length)
		return false;
	var pi = this.page_index(pname);
	if (pi == -1) {
		this.alert(this.i18n.PAGE_NOT_EXISTS+pname);
		return false;
	}
	if (this.is_reserved(pname)) {
		this.alert(this.i18n.ERR_RESERVED_NS.sprintf(this.get_namespace(pname, true)));
		return false;
	}
	if (confirm(this.i18n.CONFIRM_DELETE.sprintf(pname))) {
		this.plugins.delete_check(pname);
		this.delete_page_i(pi);
		return true;
	}
	return false;
};

// javascript shortcuts for special pages
woas.shortcuts = ["New Page", "Duplicate Page", "All Pages", "Orphaned Pages", "Backlinks", "Dead Pages", "Erase Wiki", "Edit CSS", "Main Page", "Aliases", "Go to", "Delete Page", "Recentchanges"];
woas.shortcuts_js = ["cmd_new_page", "cmd_duplicate_page", "special_all_pages", "special_orphaned_pages", "special_backlinks",
					"special_dead_pages", "cmd_erase_wiki", "cmd_edit_css", "cmd_main_page",
					"cmd_edit_aliases", "cmd_go_to", "cmd_delete",
					"special_recent_changes"];
					
woas.unexportable_pages = ["New Page", "Duplicate Page", "Backlinks", "Erase Wiki", "Edit CSS",
								"Go to", "Delete Page", "Search"];

woas.unexportable_pages2 = ["WoaS::CSS::Custom", "WoaS::CSS::Core", "WoaS::Aliases", "WoaS::Hotkeys",
							"WoaS::Plugins"];

// return raw javascript tag to be included in XHTML page
woas.raw_js = function(code) {
	return "<scr"+"ipt type=\"text/javascript\">\n"+code+"\n<"+"/s"+"cript>";
};

//API1.0: delete a page given title (without aliases)
woas.delete_page = function(title) {
	var pi = page_titles.indexOf(title);
	//DEBUG line
	if (pi === -1) {
		this.crash("Requesting deletion of unexisting page!");
		return false;
	}
	return this.delete_page_i(pi);
};

//API1.0: delete a page given absolute page index
//API1.0: @protected
woas.delete_page_i = function(i) {
	var il, old_title = page_titles[i];
	log("DELETED page "+old_title);	// log:1
	// remove the elements
	page_titles.splice(i,1);
	pages.splice(i,1);
	page_attrs.splice(i,1);
	page_mts.splice(i,1);
	// remove the deleted page from history
	var prev_page = null;
	for(i=0,il=backstack.length;i<il;++i) {
		// remove also duplicate sequences
		if ((backstack[i] === old_title) || (prev_page === backstack[i])) {
			backstack.splice(i,1);
			// fix the loop
			--il;--i;
			continue;
		}
		prev_page = backstack[i];
	}
	//TODO: delete also from forstack!
	// if we were looking at the deleted page
	if (current === old_title) {
		// go back or to main page, do not save history
		if(backstack.length > 0) {
			this.set_current(backstack.pop(), true);
		} else
			this.set_current(this.config.main_page);
	}
	// always refresh the menu because it could contain the deleted page link
	this.refresh_menu_area();
	//TODO: send proper save notification
	return this.commit_delete([i]);
};

// some general integrity tests - for debug purposes
woas.integrity_test = function() {
	log("Starting integrity test"); //log:1
	// test integrity of data arrays
	var len = pages.length;
	if ((page_attrs.length != len) ||
			(page_titles.length != len) ||
			(page_mts.length != len)) {
			this.crash("FATAL: data arrays have mismatching length!\n"+
						"#pages = %d, #page_attrs = %d, #page_titles = %d, #page_mts = %d".
						sprintf(pages.length, page_attrs.length, page_titles.length,
						page_mts.length));
		return false;
	}
	// test integrity of ecma encoding for normal UTF-8
	var UTF8_TEST = "Di\u00e2critics are here: \u00e4 \u00e1y";
	if (this.ecma_decode(this.ecma_encode(UTF8_TEST)) !== UTF8_TEST) {
		this.crash("ECMA encoding not working:\n"+this.ecma_decode(this.ecma_encode(UTF8_TEST))+
		"\n"+UTF8_TEST);
		return false;
	}
	// test integrity of ecma encoding for 16bit UTF-8
	var UTF8_TEST2 = "\u30e9\u30c9\u30af\u30ea\u30d5";
	if (this.ecma_decode(this.ecma_encode(UTF8_TEST2)) !== UTF8_TEST2) {
		this.crash("ECMA encoding/decoding not working:\n"+this.ecma_decode(this.ecma_encode(UTF8_TEST2))+
		"\n"+UTF8_TEST2);
		return false;
	}
	// test integrity of load/save functions if not on remote server
	if (!this._server_mode) {
		if (!this.save_file(woas.ROOT_DIRECTORY+"itest.bin", this.file_mode.UTF8_TEXT,
				woas.merge_bytes(woas.utf8Encrypt(UTF8_TEST))
	//			UTF8_TEST
				)) {
			this.crash("Save failure during integrity test\n"+woas.ROOT_DIRECTORY);
			return false;
		}
		var ct = this.load_file(woas.ROOT_DIRECTORY+"itest.bin", this.file_mode.UTF8_TEXT);
		if ((ct === null)||(ct === false)) {
			if (ct === false)
				this.crash("Load failure during integrity test\n"+woas.ROOT_DIRECTORY);
			return false;
		}
		ct = woas.utf8Decrypt(woas.split_bytes(ct));
		if (ct !== UTF8_TEST) {
			this.crash("UTF8 test failed.\nWritten:\n"+UTF8_TEST+"\nRead:\n"+ct);
			return false;
		}
	} else { // we are on a remote server
		log("Skipping save integrity test because running from web server");	//log:1
		//TODO: remote load integrity test
	}
	// now test AES encryption
	woas.AES.setKey("WoaS");
	var testdata = "sample text here";
	var enc = woas.AES.encrypt(testdata);
	if (woas.AES.decrypt(enc) !== testdata) {
		this.crash("AES encryption is not working two-way!");
		woas.AES.clearKey();
		return false;
	}
	if (woas.AES.decrypt(woas.AES.encrypt(UTF8_TEST)) !== UTF8_TEST) {
		this.crash("AES encryption of UTF8 text is not working two-way!");
		woas.AES.clearKey();
		return false;
	}
	woas.AES.clearKey();
	log("Integrity test successful"); //log:1
	return true;
};

// used in path normalization during export
woas.DIRECTORY_SEPARATOR = (navigator.appVersion.indexOf("Win")!=-1)?"\\":"/";

woas._dirname_regex = new RegExp("\\"+woas.DIRECTORY_SEPARATOR+"[^\\"+woas.DIRECTORY_SEPARATOR+"]*$");
woas._basename_regex = new RegExp("\\[\\\\/]([^\\\\/]+)$");

// hackish functions, might stay private for now
woas.dirname = function(fn) {
	return fn.replace(this._dirname_regex, woas.DIRECTORY_SEPARATOR);
};

woas.basename = function(fn) {
	fn = fn.match(this._basename_regex);
	if (fn === null)
		return "";
	return fn[1];
};

// the export path used by export feature
woas.ROOT_DIRECTORY = woas.dirname(_get_this_filename());

//API1.0: get page attributes - can be overriden by plugins
//TODO: all code should use this function
woas.get_page_attrs = function(pi) {
	// no error check
	return page_attrs[pi];
};

//API1.0: set page attributes - can be overriden by plugins
//TODO: all code should use this function
woas.set_page_attrs = function(pi, attrs) {
	// no error check
	page_attrs[pi] = attrs;
	return true;
};

// get file URL from input XHTML element
// this might not work on some browsers
// not to be called for Mozilla-based browsers
woas.get_input_file_url = function() {
	var r = false;
	// we have requested a direct read of the file from the input object
	if (this.browser.opera) {
		// ask user for path, since browser do not allow us to see where file really is
		r = $("filename_").value;
		r = prompt(this.i18n.ALT_BROWSER_INPUT.sprintf(this.basename(r)), this.ROOT_DIRECTORY);
		if ((r === null) || !r.length)
			r = false;
		else
			this._last_filename = r;
	} else {
		r = $("filename_").value;
		if (!r.length)
			r = false;
	}
	if (r === false)
		this.alert(this.i18n.FILE_SELECT_ERR);
	return r;
};

//API1.0: dynamically add a hotkey
// returns true if hotkey was added successfully or if already present
woas.add_hotkey = function(key, function_obj) {
};

woas.utf8Encrypt = function(s) {
	return woas.split_bytes( unescape( encodeURIComponent( s ) ) );
};

woas.utf8Decrypt = function(byte_arr) {
	try {
		return decodeURIComponent( escape( woas.merge_bytes( byte_arr ) ) );
	}
	catch (e) {
		log(e);	//log:1
	}
	return null;
};

woas.split_bytes = function(s) {
	var l=s.length;
	var arr=[];
	for(var i=0;i<l;i++)
		arr.push(s.charCodeAt(i));
	return arr;
};
	
woas.merge_bytes = function(byte_arr) {
	var l=byte_arr.length, s="";
	for(var i=0;i<l;i++) {
		s+=String.fromCharCode(byte_arr[i]);
	}
	return s;
};

var reReplaceBr = new RegExp("<"+"br\\s?\\/?>", "gi");
woas.xhtml_to_text = function(s) {
	return s.replace(reReplaceBr, "\n").replace(/<\/?\w+[^>]*>/g, ' ').
					replace(/&#?([^;]+);/g, function(str, $1) { if (!isNaN($1)) return String.fromCharCode($1); else return ""; });
};

// convert UTF8 sequences of the XHTML source into &#dddd; sequences
woas.utf8_encode = function(src) {
	return src.replace(/[^\u0000-\u007F]+/g, function ($1) {
		var l=$1.length;
		var s="";
		for(var i=0;i<l;i++) {
			s+="&#"+$1.charCodeAt(i)+";";
		}
		return s;
	});
};

// WoaS DOM manager
// all DOM modifications shall be indexed by this module
woas.dom = {
	// hashmap used to quickly reference some important DOM objects
	_cache: {},
	// DOM management area
	_objects: [],
	
	init: function() {
		this._cache.head = document.getElementsByTagName("head")[0];
		this._cache.body = document.getElementsByTagName("body")[0];
		if (woas.browser.ie)
			this._cache.stylesheet = document.styleSheets[0];
		else
			this._cache.stylesheet = document.getElementsByTagName("style")[0];
	},
	
	add_css: function(css_id, css_src, external, after_load) {
/*		if (document.createStyleSheet) {// check for MSIE
			this._cache.head.insertAdjacentHTML('beforeEnd',
				'<span id="'+'" style="display:none">x</span>'  // MSIE needs this for some reason
				+ '<style id="'+'" type="text/css">'+css_text+'</style>');
			//TODO: check that style can then be properly removed
		  } else { */
		// always add this custom prefix
		css_id = "woas_css_"+css_id;
		
		// check if we have a duplicate instance
		if (this.index(css_id) !== -1) {
			woas.log("DOM: instance "+css_id+" already exists");
			return false;
		}
		
		var style;
		if (external) {
			style = document.createElement("link")
			style.setAttribute("rel", "stylesheet");
			style.setAttribute("type", "text/css");
			style.setAttribute("id", css_id);
			style.setAttribute("href", css_src);
			// only when external
			++this._loading;
		} else {
			style = document.createElement('style');
			style.type = "text/css";
			style.id = css_id;
			style.appendChild(document.createTextNode(css_text));
		}
		
		this._objects.push( {obj:style, parent: (woas.browser.ie ? this._cache.body:this._cache.head),
							instance:css_id, after_load: external ? after_load : null } );
		
		woas.log("DOM: "+css_id+" created "+this._show_load());
		// add a callback which informs us of the completion (not always possible)
		if (external) {
			// these engines don't support a callback :(
			if (woas.browser.gecko || woas.browser.webkit) {
				setTimeout("woas.dom._elem_onload('"+woas.js_encode(css_id)+"');", 100);
			} else { // good ol' IE
				style.onload = style.onreadystatechange = woas._make_delta_func("woas.dom._elem_onload",
													"'"+woas.js_encode(css_id)+"'");
			}
		}
		
		// on IE inject directly in body
		if (woas.browser.ie) {
			this._cache.body.appendChild(style);
		} else {
			this._cache.head.appendChild(style);
		}
		return true;
	},
	
	remove_css: function(i) {
		return this.remove("woas_css_"+i);
	},

	remove_script: function(script_class, script_id) {
		return this.remove("woas_script_"+script_class+"_"+script_id);
	},
	
	remove: function(instance) {
		var found = this.index(instance);
		if (found === -1)
			return false;
		// delete DOM entry from parent container
		this._objects[found].parent.removeChild(this._objects[found].obj);
		// fix arrays
		this._objects.splice(found, 1);
		return true;
	},
	
	// counter of elements being loaded
	_loading: 0,
	
	// generic callback used when we want to run something after the file has been loaded
	// (usually CSS/JavaScript)
	_elem_onload: function(instance) {
		if (!woas.dom.get_loaded(instance) && (!this.readyState || this.readyState == 'complete'
										 || this.readyState == 'loaded') ) {
		  // unplug handler
		  var dom_obj = woas.dom._objects[woas.dom.index(instance)];
		  dom_obj.obj.onload = dom_obj.obj.onreadystatechange = null;
		  // set as loaded (shall not remove from arrays)
		  woas.dom.set_loaded(instance);
		}
	},
	
	get_loaded: function(instance) {
		var i = this.index(instance);
		if (i !== -1) {
			if (this._objects[i].instance === instance)
				return this._objects[i].loaded;
		}
		woas.log("DOM: "+instance+" is not indexed"+this._show_load());
		return false;
	},
	
	// get list of instances which are still loading
	get_loading: function() {
		var a=[];
		for(var i=0,it=this._objects.length;i<it;++i) {
			if (!this._objects[i].loaded)
				a.push(this._objects[i].instance);
		}
		return a;
	},
	
	// short-hand to get index of an instance
	index: function(instance) {
		for(var i=0,it=this._objects.length;i<it;++i) {
			if (this._objects[i].instance === instance)
				return i;
		}
		return -1;
	},

	set_loaded: function(instance) {
		var i = this.index(instance);
		if (i !== -1) {
			this._objects[i].loaded = true;
				
			// now call the associated callback
			if (typeof this._objects[i].after_load == "function") {
				(this._objects[i].after_load)();
			}
			
			// reduce the counter of 'hung' requests
			--this._loading;
			woas.log("DOM: "+instance+" completed loading"+this._show_load());
			
			return true;
		}
		woas.log("DOM: "+instance+" completed loading, but was not indexed"+this._show_load());
		return false;
	},
	
	_show_load: function() {
		return "";
		return " (%d/%d)".sprintf(this._loading, this._objects.length)+"\n"+
				"still loading: "+this.get_loading();
	},
	
	// regex used to remove some comments
	reJSComments: /^\s*\/\*[\s\S]*?\*\/\s*/g,
	
	_internal_add: function(script_token, script_content, external, after_load) {
		script_token = "woas_script_"+script_token;
		// check if we have a duplicate instance
		if (this.index(script_token) !== -1) {
			woas.log("DOM: instance "+script_token+" already exists");
			return false;
		}
		
		var s_elem = document.createElement("script");
		s_elem.type="text/javascript";
		s_elem.id = script_token;

		// register in our management arrays
		this._objects.push( {obj:s_elem, parent:this._cache.head, instance:script_token,
								external: external ? true : false,
								loaded: external ? false : true, after_load: external ? after_load : null} );
		// only external sources should be marked as "loading"
		if (external)
			++this._loading;
		woas.log("DOM: "+script_token+" created "+(external ? "("+script_content+") ":"(inline) ")+this._show_load());
		// add a callback which informs us of the completion
		if (external)
			s_elem.onload = s_elem.onreadystatechange = woas._make_delta_func("woas.dom._elem_onload",
													"'"+woas.js_encode(s_elem.id)+"'");
		if (external)
			s_elem.src = script_content;
		this._cache.head.appendChild(s_elem);
		if (!external) {
//			alert("Inline code:\n"+script_content);
			woas.setHTML(s_elem, script_content);
		}
		return true;
	},
	
	add_script: function(script_class, script_id, script_content, external, after_load) {
		// remove the comments
		if (!external)
			script_content = script_content.replace(this.reJSComments, '');
		// it's not necessary to add this script tag
		if (!script_content.length) return false;
		return this._internal_add(script_class+"_"+script_id, script_content, external, after_load);
	},
	
	// remove all script objects
	remove_all: function() {
		var it=this._instances.length;
		for(var i=0;i<it;++i) {
			// remove the object
			this._objects[i].parent.removeChild(this._objects[i].obj);
		}
		// clear objects array
		this._objects = [];
	}
	
};

// generate a delta function and cache it
woas._delta_cache = {};
woas._make_delta_func = function(fn_name, fn_args) {
	var id=fn_name+' '+fn_args;
	var fn_obj;
	if (typeof woas._delta_cache[id] == "undefined") {
		eval("fn_obj = function() { "+fn_name+"("+fn_args+"); };");
		woas._delta_cache[id] = fn_obj;
	} else
		fn_obj = woas._delta_cache[id];
	return fn_obj;
}

// WoaS 'pager' module
woas.pager = {
	get: function(title) {
		return woas.get_text(title);
	},
	
	get_by_index: function(i) {
		return woas.get__text(i);
	}
};

// namespace for custom stuff defined by macros/plugins
// if you are a JavaScript developer you should put singleton instance objects in here
woas.custom = { };
