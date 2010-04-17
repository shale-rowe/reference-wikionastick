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
		else {
			ns = this.get_namespace(title, true);
			if (ns.length) {
				ns = ns.substr(0, -2);
				cr = title.substr(ns.length);
			} else cr = title;
			if (!this._create_page(ns, cr, false, fill_mode))
				return ns+cr;
			var upd_menu = (cr=='Menu');
			if (!upd_menu && confirm(this.i18n.ASK_MENU_LINK)) {
				var menu = this.get_text("::Menu");
				p = menu.indexOf("\n\n");
				if (p==-1)
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
	}
	return null;
};

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
woas.default_pages = ["::Menu", "WoaS::Bootscript", "WoaS::Aliases", "WoaS::Hotkeys", "WoaS::CSS::Custom"];

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
			"/* insert here your boot script */", "", this._default_hotkeys(), "/* Your CSS customization goes here */"];
	pages = pages.concat(backup_pages); backup_pages = null;
	current = this.config.main_page;
	this.refresh_menu_area();
	backstack = [];
	forstack = [];
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

//DEPRECATED
woas.cmd_edit_bootscript = function() {
	return this.cmd_edit_special("WoaS::Bootscript");
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
		this.delete_page_i(pi);
		return true;
	}
	return false;
};

// javascript shortcuts for special pages
woas.shortcuts = ["New Page", "Duplicate Page", "All Pages", "Orphaned Pages", "Backlinks", "Dead Pages", "Erase Wiki", "Edit CSS", "Main Page", "Edit Bootscript", "Aliases", "Go to", "Delete Page", "Recentchanges"];
woas.shortcuts_js = ["cmd_new_page", "cmd_duplicate_page", "special_all_pages", "special_orphaned_pages", "special_backlinks",
					"special_dead_pages", "cmd_erase_wiki", "cmd_edit_css", "cmd_main_page",
					"cmd_edit_bootscript", "cmd_edit_aliases", "cmd_go_to", "cmd_delete",
					"special_recent_changes"];
					
woas.unexportable_pages = ["New Page", "Duplicate Page", "Backlinks", "Erase Wiki", "Edit CSS",
								"Edit Bootscript", "Go to", "Delete Page", "Search"];

woas.unexportable_pages2 = ["WoaS::CSS::Custom", "WoaS::CSS::Core", "WoaS::Aliases", "WoaS::Hotkeys",
							"WoaS::Plugins", "WoaS::Bootscript"];

// return raw javascript tag to be included in XHTML page
woas.raw_js = function(code) {
	return "<scr"+"ipt type=\"text/javascript\">\n"+code+"\n<"+"/s"+"cript>";
};

//API1.0: delete a page given title (without aliases)
woas.delete_page = function(title) {
	var pi = page_titles.indexOf(title);
	//DEBUG line
	if (pi == -1) {
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
	if (current == old_title) {
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
