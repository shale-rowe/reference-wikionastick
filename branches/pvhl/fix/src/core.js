// core modules

// some tweak settings NOT to be touched - warranty void otherwise
woas.tweak = {
	// DANGER: might cause WoaS corruption!
	edit_override: false,
	// perform integrity test of browser features
	integrity_test: false
};

woas.cmd_duplicate_page = function() {
	var pname = this._new_page("Insert duplicate page title", true, current+" (duplicate)");
	if (pname === null)
		return;
	var pi = this.page_index(current);
	var dpi = this.page_index(pname);
	// duplicate the page
	if (this.is__encrypted(pi)) // encrypted pages are arrays
		pages[dpi] = pages[pi].slice(0);
	else // string copy is OK
		pages[dpi] = pages[pi]; // .slice ?
	page_attrs[dpi] = page_attrs[pi];	
	// go to new page
	this.go_to(pname);
	// commit changes
	this.commit([dpi]);
};

woas.cmd_new_page = function() {
	this._new_page(this.i18n.INSERT_NEW, false, '');
};

// used to create a new page in the wiki
woas._new_page = function(msg, fill_mode, title) {
	title = this._prompt_title(msg, title, false);
	if (title === null)
		return null;
	return this._new_page_direct(title, fill_mode);
};

// will return a valid title for an about-to-be-created page
// PVHL: if called with plugin = true will check plugin title.
// EXISTING BUG: tweak.edit_override could create a bad plug-in here (@), but this
// fixes issue of not allowing plug-in with same name as an existing page.
// Workaround: don't create plugins with "new page" in edit_override mode!
woas._prompt_title = function(msg, title, plugin) {
	// disallow editing when wiki is set to read-only
	if (!this.config.permit_edits) {
		this.alert(this.i18n.READ_ONLY);
		return null;
	}
	var _title;
	while (true) {
		title = prompt(msg, title);
		if (title === null)
			return null;
		title = this.trim(title);
		if (this.valid_title(title)) {
			if (plugin) {
				_title = title;
				title =  "WoaS::Plugins::" + title;
			}
			if (this.page_index(title) === -1) {
				return plugin ? _title : title;
			} else {
				// page exists: warn and try again
				this.alert(this.i18n.PAGE_EXISTS.sprintf(title));
				if (plugin) title = _title;
			}
		}
	}
};

woas._new_page_direct = function(title, fill_mode) {
	// properly split page title in (namespace, title) -> (ns, cr)
	var ns = this.get_namespace(title, true), cr;
	if (ns.length) {
		cr = title.substr(ns.length);
		ns = ns.substr(0, ns.length-2);
	} else cr = title;

	// check if page deserves creation
	if ((ns==="File") || (ns==="Image")) {
		this.go_to(title);
		return title;
	}
	// create and edit the new page
	var ct;
	if (cr !== "Menu")
		ct = "= "+cr+"\n";
	else
		ct = "\n";
	this._create_page_direct(ns, cr, fill_mode, ct);

	if (cr !== 'Menu') {
		var menu = this.get_text("::Menu"),
			test = new RegExp("\\[\\["+title+"\\s*[\\|\\]]");
		// ask if menu link wanted (if option allows) if one doesn't already exist
		if (!menu.match(test) && (this.config.menu_link === 1 ||
				(!this.config.menu_link && confirm(this.i18n.ASK_MENU_LINK)))) {
			// try to put the menu link in a good position
			p = menu.indexOf("\n\n");
			if (p === -1)
				menu += "\n[["+title+"]]";
			else
				menu = menu.substring(0,p+2)+"[["+title+"]]\n"+menu.substring(p+2);
			this.set__text(this.page_index("::Menu"), menu);
		}
	}
	return title;
};

// used to eventually remove the new-to-be page when cancel is pressed
woas._ghost_page = false;

woas._create_page_direct = function(ns, cr, fill_mode, default_ct) {
	// actual page creation
	pages.push(default_ct);
	if (ns.length)
		cr = ns+"::"+cr;
	page_attrs.push(0);
	page_titles.push(cr);
	// set modified timestamp
	page_mts.push(this.config.store_mts ? Math.round(new Date().getTime()/1000) : 0);
//	this.log("Page "+cr+" added to internal array");	// log:1
	if (!fill_mode) {
		// DO NOT set 'current = cr' here!!!
		// enable ghost mode when creating a new-to-be page
		this._ghost_page = true;
		this.log("Ghost page enabled"); //log:1
		// proceed with a normal wiki source page
		this.edit_page(cr);
	}
};

woas.cmd_erase_wiki = function(page) {
	if (this.erase_wiki()) {
		if (!this.full_commit()) {
			this.alert(this.i18n.FAILED_ERASE);
			// reload page because all data is lost - works even in IE6
			window.location = window.location;
		}
		// PVHL: successful erase; if called from an Import page will go back there
		this.set_current(page ? page : this.config.main_page, true);
	}
	return null;
};

// pages which shall never be modified
woas.static_pages = [
	"Special::About", "Special::Advanced", "Special::Options",
	"Special::Import", "Special::Lock","Special::Search", "Special::Embed",
	"Special::Export", "Special::License", "Special::ExportWSIF",
	"Special::ImportWSIF"
];

woas.static_pages2 = [
	"WoaS::Plugins", "WoaS::CSS::Boot", "WoaS::CSS::Core", "WoaS::Help",
	"WoaS::ImportSettings", "WoaS::Template::Search", "WoaS::Template::Info",
	"WoaS::Template::Transclusion Example"
];

woas.static_pages = woas.static_pages.concat(woas.static_pages2);
						
woas.erase_wiki = function() {
	if (!this.config.permit_edits) {
		this.alert(this.i18n.READ_ONLY);
		return false;
	}
	if (!confirm(this.i18n.CONFIRM_DELETE_ALL1) ||
		!confirm(this.i18n.CONFIRM_DELETE_ALL2)) {
		return false;
	}
	var _titles, _pages, i, il, pt, pi;
	this.progress_init("Erasing...");
	_titles = [this.config.main_page, "::Menu", "WoaS::Aliases",
			"WoaS::Hotkeys", "WoaS::CSS::Custom"];
	_pages = ["A blank sheet is a catalyst for ideas",
		"[["+this.config.main_page+"]]\n[[Special::Options|Options]]\n\n"+
		"* [[Special::All Pages|All Pages]]\n* [[Special::Go to|Go to...]]\n"+
		"* [[Special::Recent Changes|Recent Changes]]\n\n"+
		"* [[Special::Backlinks|Backlinks]]\n"+
		"* [[Special::New Page|New Page]]\n"+
		"* [[Special::Duplicate Page|Duplicate Page]]\n"+
		"* [[Special::Delete Page|Delete Page]]\n\n\n"+
		"[[Include::WoaS::Template::Search]]\n",
		"Lines that do not start with '$' are ignored\n\n$JS  Javascript",
		this.hotkey._cache_default(),
		"/* Your CSS customization goes here */"];
	// add all system pages
	for (i = 0, il = page_titles.length; i < il; ++i) {
		pt = page_titles[i];
		if (pt.indexOf("WoaS::Help") === 0 ||
				pt.indexOf("Special::") === 0 ||
				this.static_pages2.indexOf(pt) !== -1) {
			pi = this.page_index(pt);
			if (pi === -1) {
				this.alert(this.i18n.STATIC_NOT_FOUND.sprintf(pt));
				continue;
			}
			_pages.push(pages[pi]);
			if (!_pages[_pages.length - 1]) {
				_pages.pop();
				continue;
			}
			_titles.push(pt);
		}
	}
	// PVHL: This is where save could be done with temporary arrays.
	// This whole function could be done in save though - save instead
	// of erase, with save only saving core pages. Simple flag.
	pages = _pages;
	page_titles = _titles;
	// attributes and last modified timestamps for new pages
	// zero is the magic timestamp
	page_attrs = [];
	page_mts = [];
	for (i = 0, il = _pages.length; i < il; ++i) {
		page_attrs.push(0);
		page_mts.push(0);
	}
	current = this.config.main_page;
// PVHL: FIX this needs to be moved at some point
	this.ui.refresh_menu();
	this.history.clear();
	// reload all extensions
	this._load_aliases(this.get_text("WoaS::Aliases"));
	this.hotkey.load(this.get_text("WoaS::Hotkeys"));
	// remove all plugins
	this.plugins.clear();
	this.plugins.load();
	this.progress_finish();
	return true;
};

woas.cmd_main_page = function() {
	this.go_to(this.config.main_page);
	return null;
};

// used to edit many special pages
woas.cmd_edit_special = function(cr) {
	if (!this.config.permit_edits && !this.tweak.edit_override) {
		this.alert(this.i18n.READ_ONLY);
	} else {
		// get source text (ASCII/UTF-8)
		var tmp = this.get_text(cr);
		if (tmp !== null) {
			// setup the wiki editor textbox
			this.current_editing(cr, this.config.permit_edits || this._server_mode, tmp);
		}
	}
	return null;
};

woas.cmd_go_to = function() {
	// don't go anywhere if editing
	if (this.ui.edit_mode)
		return;
	var pname;
	do {
		pname = prompt("Go to page:", current);
		if ((pname !== null) && pname.length)
			if (this.go_to(pname))
				return;
	} while (pname !== null);
};

woas.cmd_delete = function() {
	// disallow editing when wiki is set to read-only
	if (!this.config.permit_edits) {
		this.alert(this.i18n.READ_ONLY);
	} else {
		var pname, pi;
		while ((pname = prompt(this.i18n.DELETE_PAGE_PROMPT, current)) !== null) {
			if (!pname.length)
				continue;
			pi = this.page_index(pname);
			if (pi === -1) {
				this.alert(this.i18n.PAGE_NOT_EXISTS.sprintf(pname));
				continue;
			} else if (this.is_reserved(pname)) {
				this.alert(this.i18n.ERR_RESERVED_NS.sprintf(this.get_namespace(pname, true)));
				continue;
			} else if (confirm(this.i18n.CONFIRM_DELETE.sprintf(pname))) {
				this.plugins.delete_check(pname);
				this.delete_page_i(pi);
				return true;
			}
		}
	}
	return false;
};

// javascript shortcuts for special pages
woas.shortcuts = ["New Page", "Duplicate Page", "All Pages", "Orphaned Pages", "Backlinks",
					"Dead Pages", "Erase Wiki", "Main Page", "Go to", "Delete Page", "Recent Changes"];
woas.shortcuts_js = ["cmd_new_page", "cmd_duplicate_page", "special_all_pages", "special_orphaned_pages", "special_backlinks",
					"special_dead_pages", "cmd_erase_wiki",	"cmd_main_page", "cmd_go_to", "cmd_delete",	"special_recent_changes"];
					
woas.unexportable_pages = ["New Page", "Duplicate Page", "Backlinks", "Erase Wiki", "Edit CSS",
								"Go to", "Delete Page", "Search"];

woas.unexportable_pages2 = ["WoaS::CSS", "WoaS::Aliases", "WoaS::Hotkeys", "WoaS::Plugins"];

// return raw javascript tag to be included in XHTML page
woas.raw_js = function(code) {
	return "<"+"script type=\"text/javascript\">\n"+code+"\n<"+"/s"+"cript>";
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
//	this.log("NOTICE: deleted page "+old_title);	// log:0
	// remove the elements
	page_titles.splice(i,1);
	pages.splice(i,1);
	page_attrs.splice(i,1);
	page_mts.splice(i,1);
	// if we were looking at the deleted page
	if (current === old_title) {
		// go to an existing page
		this.set_current(this.history.previous(), true);
	} else {
		// always refresh the menu because it could contain the deleted page link
		// done automatically above
		this.ui.refresh_menu();
	}
	// remove page from history
	this.history.clear(old_title);
	//TODO: send proper save notification
	return this.commit_delete([i]);
};

// PVHL: Can't make changes to API I would like to without reworking a lot of
//   the code. The changes I have made attempt to fix current history issues.
 
woas.history = (function(){ // woas.history closure
	// commandeer the old backstack (breaks privacy; good enough for now)
	// much easier if it was one stack, but this way for historical reasons
	var backstack = window.backstack,
		forstack = [], // forward history stack, discarded when saving
		going_back = true,	// true if back called and for initial page load
		going_forward = false; // true if forward called
	
	// push a page into history
	function store(page) {
		if (backstack.length > woas.history.MAX_BROWSE_HISTORY)
			backstack = backstack.slice(1);
		backstack.push(page);
	}
	
	// the public API
	return {

	MAX_BROWSE_HISTORY: 6, // public for overriding
	
	has_forstack: function() {
		return (forstack.length > 0);
	},
	
	has_backstack: function() {
		return (backstack.length > 0);
	},
	
	previous: function() {
		// go back or to main page, do not save history
		if (backstack.length > 0) {
			return backstack.pop();
		} else
			return woas.config.main_page;
	},
	
	back: function() {
		if (backstack.length > 0) {
			if (!/^Lock::/.test(current)) {
				forstack.push(current);
			}
			var title = backstack.pop();
			if (title)
				going_back = true;
			return title;			
		}
		woas.log("No back history");
		return null;
	},
	
	forward: function() {
		if (forstack.length > 0) {
			going_forward = true;
			return forstack.pop();
		}
		woas.log("No forward history");
		return null;
	},
	
	go: function(title, keep_fwd) {
		if (!going_back && !woas.ui.edit_mode && current !== title && !/^Lock::/.test(current)) {
			store(current);
		}
		if (!keep_fwd && !going_forward && !going_back/* && !/^Lock::/.test(title)*/) {
			forstack = [];
		}
		going_back = going_forward = false;
	},
	
	// PVHL: this shouldn't be here, but needed for new pages by current design
	// store() should be an internal, private function
	store: function(title) {
		store(title);
	},

	// remove title if it exists. If no title given clear history
	// return false if title was given but not found (could be useful)
	clear: function(title) {
		if  (title && title.length) {
			// remove the deleted page from history
			var found = false, i, it;
			for (i = 0, it = backstack.length; i < it; ++i) {
				// remove also duplicate sequences
				if (backstack[i] === title) {
					found = true;
					backstack.splice(i, 1);
					// fix the loop
					--it;
					// iterate again to remove duplicate sequences
					--i;
				}
			}
			// delete also from forstack
			for (i = 0, it = forstack.length; i < it; ++i) {
				// remove also duplicate sequences
				if (forstack[i] === title) {
					found = true;
					forstack.splice(i,1);
					--it;
					--i;
				}
			}
			return found;
		} else {
			forstack = [];
			backstack = [];
			return true;
		}
	},
	
	// rename old_title; titles must be valid
	rename: function (old_title, new_title) {
		var i;
		for (i = 0; i < backstack.length; ++i) {
			if (backstack[i] === old_title) {
				backstack[i] = new_title;
			}
		}
		for (i = 0; i < forstack.length; ++i) {
			if (forstack[i] === old_title) {
				forstack[i] = new_title;
			}
		}
	},
	
	// use: woas.log(woas.history.log_entry())
	log_entry: function() {
		function frmt(arr) {
			var str = [], i;
			for (i = 0; i < arr.length; ++i) {
				str.push(arr[i]);
			}
			return str.join(" | ");
		}
		return "history" + (backstack.length ? " : " : " > ")
			+ frmt(backstack) + (backstack.length ? " > " : "")
			+ current + (forstack.length ? " | " : "")
			+ frmt(forstack.slice(0).reverse());
	}
}}());

// some general integrity tests - for debug purposes
woas.integrity_test = function() {
	woas.log("Starting integrity test"); //log:1
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
				woas.utf8.encode(UTF8_TEST)
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
		ct = woas.utf8.decode(ct);
		if (ct !== UTF8_TEST) {
			this.crash("UTF8 test failed.\nWritten:\n"+UTF8_TEST+"\nRead:\n"+ct);
			return false;
		}
	} else { // we are on a remote server
		woas.log("Skipping save integrity test because running from web server");	//log:1
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
	woas.log("Integrity test successful"); //log:1
	return true;
};

// used in path normalization during export
woas.DIRECTORY_SEPARATOR = (navigator.appVersion.indexOf("Win")!=-1)?"\\":"/";

woas._dirname_regex = new RegExp("\\"+woas.DIRECTORY_SEPARATOR+"[^\\"+woas.DIRECTORY_SEPARATOR+"]*$");
woas._basename_regex = new RegExp("[\\\\/]([^\\\\/]+)$");		// "\\[\\\\/]([^\\\\/]+)$"

// hackish functions, might stay private for now
woas.dirname = function(fn) {
	return fn.replace(this._dirname_regex, woas.DIRECTORY_SEPARATOR);
};

woas.basename = function(fn) {
	var m = fn.match(this._basename_regex);
	if (m === null)
		return fn;
	return m[1];
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

//API1.0: dynamically add a hotkey
// returns true if hotkey was added successfully or if already present
woas.add_hotkey = function(key, function_obj) {
	//FIXME: this needs to be finished!
};

woas.split_bytes = function(s) {
	var l=s.length;
	var arr=[];
	for(var i=0;i < l;i++)
		arr.push(s.charCodeAt(i));
	return arr;
};
	
woas.merge_bytes = function(byte_arr) {
	var l=byte_arr.length, s="";
	for(var i=0;i < l;i++) {
		s+=String.fromCharCode(byte_arr[i]);
	}
	return s;
};

var reReplaceBr = new RegExp("<"+"br\\s?\\/?>", "gi");
woas.xhtml_to_text = function(s) {
	return s.replace(reReplaceBr, "\n")
		.replace(/<\/?\w+[^>]*>/g, '')
		.replace(/&#?([^;]+);/g, function(str, $1) {
			return isNaN($1) ? '' : String.fromCharCode($1);
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
				'<'+'span id="'+'" style="display:none">x<'+'/span>'  // MSIE needs this for some reason
				+ '<+'style id="'+'" type="text/css">'+css_text+'<'+'/style>');
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
			style = document.createElement("link");
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
				style.onreadystatechange = woas._make_delta_func("woas.dom._elem_onload",
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
		// go away if it is already loaded
		if (woas.dom.get_loaded(instance))
			return;
		// only for IE
		if (woas.browser.ie && (typeof this.readyState != "undefined")) {
			if (this.readyState != 'complete' && this.readyState != 'loaded')
				return;
			// remove handler
			this.onreadystatechange = null;
		} else if (woas.browser.firefox) {
		  // unplug handler
		  var dom_obj = woas.dom._objects[woas.dom.index(instance)];
		  dom_obj.obj.onload = null;
		}
		// set as loaded (shall not remove from arrays)
		woas.dom.set_loaded(instance);
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
		for(var i=0,it=this._objects.length;i < it;++i) {
			if (!this._objects[i].loaded)
				a.push(this._objects[i].instance);
		}
		return a;
	},
	
	// short-hand to get index of an instance
	index: function(instance) {
		for(var i=0,it=this._objects.length;i < it;++i) {
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
			// check if we need to launch the hook
			if (this._loading === 0)
				this._run_post_load_hook();
			
			return true;
		}
		woas.log("DOM: "+instance+" completed loading, but was not indexed"+this._show_load());
		return false;
	},
	
	_show_load: function() {
		return "";
/*		return " (%d/%d)".sprintf(this._loading, this._objects.length)+"\n"+
				"still loading: "+this.get_loading();
*/
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
		if (external) {
			if (woas.browser.ie)
				s_elem.onreadystatechange = woas._make_delta_func("woas.dom._elem_onload",
													"'"+woas.js_encode(s_elem.id)+"'");
			else
				s_elem.onload = woas._make_delta_func("woas.dom._elem_onload",
													"'"+woas.js_encode(s_elem.id)+"'");
			// specify the external URL
			s_elem.src = script_content;
		}
				
		this._cache.head.appendChild(s_elem);
		if (!external) {
//			woas.alert("Inline code:\n"+script_content);
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
		for(var i=0;i < it;++i) {
			// remove the object
			this._objects[i].parent.removeChild(this._objects[i].obj);
		}
		// clear objects array
		this._objects = [];
	},
	
	// call the argument function when there aren't other libraries left to load
	// returns true if loading was already complete
	// returns false if we are async-waiting
	_post_load_hook: woas._dummy_fn,
	wait_loading: function(fn_object) {
		if (this._loading === 0) {
			(fn_object)();
			// always reset associated async hook
			this._post_load_hook = woas._dummy_fn;
			return true;
		}
		// associate the hook
		this._post_load_hook = fn_object;
		return false;
	},
	
	_run_post_load_hook: function() {
		// run in a thread so that the call to last object unload does not wait on the hook
		setTimeout('woas.dom._post_load_hook();woas.dom._post_load_hook=woas._dummy_fn;', 10);
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
};

// @module pager
woas.pager = {

	_decrypt_failed: false,	// the last decryption failed due to wrong password attempts
	
	decrypt_failed: function() {
		if (this._decrypt_failed) {
			this._decrypt_failed = false;
			return true;
		}
		return false;
	},

	get: function(title) {
		return woas.get_text(title);
	},
	
	get_by_index: function(i) {
		return woas.get__text(i);
	},
	
	// this yummy function needs can be overriden
	// Determines if page 'title' is allowed to be loaded by woas.set_current
	// return false to block the page from being loading, true to allow.
	browse_hook: function(title) {
		return true;
	},
	
	// set content of specified page
	set_body: function(title, new_body) {
		var pi = woas.page_index(title);
		if (woas.debug_mode) {
			if (pi === -1) {
				woas.log("BUG: page \""+title+"\" does not exist!");	// log:1
				return;
			}
		}
		woas.set__text(pi, new_body);
	}
};

// @module pager.bucket
woas.pager.bucket = {
	items: [],		// multi-pages selection
	clear: function() {
		this.items = [];
	},
	add: function(title) {
		if (this.items.indexOf(title) === -1)
			this.items.push(title);
	},
	// used when we want to set a single page in bucket
	one: function(title) {
		this.items = [title];
	}
};

// namespace for custom stuff defined by macros/plugins
// if you are a JavaScript developer you should put singleton instance objects in here
woas.custom = { };