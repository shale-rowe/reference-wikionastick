// @module ui
// User Interface bindings
woas.ui = {
	edit_mode: false,		// set to true when inside an edit textarea
	_textbox_focus: false,	// true when a text box is currently focused
	focus_textbox: function() { // called when a textbox has currently focus
		// 'this' belongs to the text box
		woas.ui._textbox_focus = true;
	},
	blur_textbox: function() { // called when a textbox looses focus
		// 'this' belongs to the text box
		woas.ui._textbox_focus = false;
		ff_fix_focus();
		// reset event handler
		this._textbox_enter_event = this._textbox_enter_event_dummy;
	},
	// event (to be overriden) to run in case of enter key pressed
	// for example, searching
	_textbox_enter_event_dummy: function() {
	},
	_textbox_enter_event: null,
	// custom event handler which can be overriden to process the keypresses
	_custom_key_hook: function(orig_e) {
		// continue parsing as normal
		return true;
	},
	
	// event called on key press
	//NOTE: since this is attached directly to DOM, you should not use 'this'
/*
PVHL: FIX; this needs to be changed as
 1. every user page that adds a text input control needs to know about setting
    blur/focus textbox or else pressing backspace goes back a page.
 2. (comment belongs in hotkey code) deleting a custom key (like back/escape)
    does not remove it from access keys. User desires need to be recognized.
*/
	_keyboard_event_hook: function(orig_e) {
		var e = orig_e || window.event,
			ck = e.keyCode || e.which;
		if (!woas.ui.edit_mode) {
			// there is a custom focus active, call the hook
			// and return if it told us to do so
			if (!woas.ui._custom_key_hook(orig_e))
				return orig_e;
			if (woas.ui._textbox_focus) {
				// return key
				if (ck == 13) {
					// clear focus
					ff_fix_focus();
					// run attached event
					(woas.ui._textbox_enter_event)();
					return false;
				}
				return orig_e;
			}
			// back or cancel keys
			if ((ck == woas.hotkey.all.back) || (ck == woas.hotkey.all.cancel)) {
				woas.ui.back();
				ff_fix_focus();
				return false;
			}
		} else if (ck == woas.hotkey.all.cancel) {
			// cancel key in edit mode
			woas.ui.cancel();
			ff_fix_focus();
			return false;
		}
		return orig_e;
	},
	//  PVHL: This function now sends help system just the help page name
	//  (everything after WoaS::Help)
	help: function() {
		var pg;
		// we are editing
		if (this.edit_mode) {
			pg = "Editor";
		} else {
			// normalize namespace listings
			pg = current;
			if (pg.lastIndexOf('::') === pg.length - 2) {
				pg = pg.substring(0, pg.length - 2);
			}
			if (pg.indexOf('WoaS::') === 0 &&
					woas.help_system._help_lookup.indexOf(pg.substr(6)) !== -1) {
				// change the target page in some special cases
				pg = pg.substr(6);
			}
		}
		woas.help_system.go_to([pg, '']);
	},
	tables_help: function() {
		woas.help_system.go_to(["Tables", '']);
	},
	clear_search: function(no_render) {
//		woas.log("Clearing search"); //log:0
		if (current === "Special::Search") {
			d$("string_to_search").value = "";
			d$("string_to_search").focus();
		}
		// clear search results
		woas._cached_body_search = [];
		woas._cached_title_search = [];
		woas._last_search = null;
		woas.pager.bucket.clear();
		if (!no_render)
			this._search_render();
	},
	// when user clicks the about link
	about: function() {
		if (!this.edit_mode)
			woas.go_to("Special::About");
	},
	_search_render: function() {
		// render search results
		if (current === "Special::Search") {
			woas._search_load();
		} else // will call _search_load() on its own
			woas.go_to("Special::Search");
	},
	// wsif: for Special::Import false, Special::ImportWSIF true
	_import_load: function(wsif) {
		var except = wsif ? 3 : 0, i, settings, chk;
		if (!woas.config.permit_edits)
			d$("btn_import").disabled = true;
		// restore default settings - with some exceptions
		settings = wsif ? woas.config.import_wsif : woas.config.import_woas;
		for(i=0;i < woas.importer._settings_props.length-except;++i) {
			chk = woas.bitfield.get(settings, i);
			d$("woas_cb_import"+woas.importer._settings_props[i].substr(1))
				.checked = chk
			woas.importer[woas.importer._settings_props[i]] = chk;
		}
		if (wsif) {
			// these options are not available for WSIF
			woas.importer.i_styles = woas.importer.i_content = true;
			woas.importer.i_config = false;
		} else {
			// disable settings if needed by content setting
			this._import_load_change();
		}
		// restore the overwrite option which covers other 2 bits
		var ovr = 0;
		if (woas.bitfield.get(settings, woas.importer._OVR_ID))
			ovr += 1;
		if (woas.bitfield.get(settings, woas.importer._OVR_ID+1))
			ovr += 2;
		var params = ["erase", "ignore", "overwrite", "ask"];
		// apply parameter
		d$('woas_import_'+params[ovr]).checked = true;
		woas.importer.i_overwrite = ovr;
	},
	// WoaS::Import can disable page/css import
	// PVHL: TODO: make _import_load cache dom elements or make more efficient
	_import_load_change: function() {
		var c = woas.importer.i_content = d$("woas_cb_import_content").checked,
			s = woas.importer.i_styles = d$("woas_cb_import_styles").checked;
		// the IDs below are from parser.heading_anchor to allow use in links
		// MUST be changed if section title changed
		if (c || s) {
			d$.show("S10522");
		} else {
			d$.hide("S10522");
		}
		if (c) {
			d$.show("S4030");
		} else {
			d$.hide("S4030");
		}
	},
	// click on edit icon
	edit: function() {
		if (!this.display('no_edit')) {
			woas.edit_page(current);
		}
	},
	cancel: function() {
		if (!this.edit_mode)
			return;
		// there was some change, ask for confirm before cancelling
		if ((woas.get_raw_content() !== woas.change_buffer) ||
			(woas.trim(d$("wiki_page_title").value) !== woas.old_title)) {
			if (!confirm(woas.i18n.CANCEL_EDITING))
				return;
		}
		// we will cancel the creation of last page
		if (woas._ghost_page) {
			// we assume that the last page is the ghost page
			pages.pop();
			page_mts.pop();
			page_titles.pop();
			page_attrs.pop();
			// menu entry may have been added for cancelled new page
			var menu_i = woas.page_index("::Menu");
			if (menu_i !== -1) {
				// try to remove menu link
				var menu_orig = woas.get__text(menu_i);
				var menu = menu_orig.replace("\n[["+current+"]]", "");
				if (menu !== menu_orig) {
					woas.set__text(menu_i, menu);
					woas.ui.refresh_menu();
				}
			}
		}
		current = woas.prev_title;
		woas.update_view();
		woas.disable_edit();
	},
	// when back button is clicked
	back: function() {
		if (this.edit_mode || this.display('no_back')) {
			return false;
		}
		var p = woas.history.back();
		return p === null ? false : woas.set_current(p, true);
	},
	// when Forward button is clicked
	forward: function() {
		if (this.display('no_fwd')) {
			return false;
		}
		var p = woas.history.forward();
		return p === null ? false : woas.set_current(p, true)
	},
	// when home is clicked
	home: function() {
		if (!this.display('no_home')) {
			woas.go_to(woas.config.main_page);
		}
		
	},
	edit_menu: function() {
		var ns = woas.current_namespace, mpi, tmp;
		do {
			mpi = woas.page_index(ns + "::Menu");
			if (mpi !== -1) {
				woas.edit_page(ns + "::Menu");
				break;
			}
			tmp = ns.lastIndexOf("::");
			ns = tmp === -1 ? "" : ns.substring(0, tmp);
		} while (ns !== "");
	},
	lock: function() {
		if (!this.display('no_lock')) {
			if (woas.pager.bucket.items.length>1)
				_lock_pages(woas.pager.bucket.items);
			else
				woas.set_current("Lock::" + current, true, true);
		}
	},
	unlock: function() {
		if (!this.display('no_unlock')) {
			if (woas.pager.bucket.items.length>1)
				_unlock_pages(woas.pager.bucket.items);
			else
				woas.set_current("Unlock::" + current, true);
		}
	},
	// scroll to top of page
	top: function() {
		if (this.edit_mode) {
			d$('woas_editor').scrollTop = 0;
		} else {
			//scroll(0,0);
		document.documentElement.scrollTop = 0;
		document.body.scrollTop = 0;
		}
	},
	advanced: function() {
		if (!this.display('no_tools')) {
			woas.go_to("Special::Advanced");
		}
	},
	set_header: function(fixed) {
		if (!woas.browser.ie6) {
			//d$("woas_header_wrap").style.position = (fixed ? "fixed" : "absolute");
			this.display({fix_h: fixed}, true);
		}
	},
	set_menu: function(fixed) {
		if (!woas.browser.ie6) {
			//d$("woas_menu_wrap").style.position = (fixed ? "fixed" : "absolute");
			this.display({fix_m: fixed}, true);
		}
	},
	set_layout: function(fixed)  {
		this.set_header(fixed);
		this.set_menu(fixed);
	},
	toggle_debug: function() {
		if (!this.display('no_debug')) {
			d$.toggle_cls('no_log', true);
		}
	},
	// Used by Special::Options page (also used to check/repair filename in ExportWSIF)
	// chk_box & set are optional
	//
	// 1. if called with 'txt_box' & 'chk_box', and 'set' is true then may set config in
	//      UNIX format and save file -- only to be called from Special::Options code
	// 2. if called with 'txt_box', 'chk_box' only then sets elements with correct values
	// 3. if called with 'txt_box' alone then checks/repairs relative filename in txt_box
	//    (used by Special::ExportWSIF)
	wsif_ds: function(txt_box, chk_box, set) {
		// get path in UNIX format and trim; stored this way - but just to be safe
		var fn = woas.trim(txt_box.value.replace(/\\/g, '/')),
			ds = woas.trim(woas.config.wsif_ds.replace(/\\/g, '/')),
			str = '', i;
		// make sure path is relative - assume stored value is
		while (fn[0] === '/') fn = fn.substr(1);
		if ( set && (ds || fn) ) {
			i = woas.i18n;
			// 1. change data source settings and save file
			// create prompt string (truth table logic used; if str created
			// then a valid condition exists; otherwise reset options)
			if ( !( ds === fn && woas.wsif.ds_multi === this.wsif_ds_multi ) ) {
				if ( ds && !fn ) {
					str = i.WSIF_DS_TO_INTERNAL;
				} else if ( !ds && fn ) {
					str = i.WSIF_DS_TO_EXTERNAL + i.WSIF_EXIST;
				} else if (ds && fn && ds === fn) {
					if ( woas.wsif.ds_multi && !this.wsif_ds_multi ) {
						str = i.WSIF_DS_TO_SINGLE;
					} else if ( !woas.wsif.ds_multi && this.wsif_ds_multi ) {
						str = i.WSIF_DS_TO_MULTI;
					}
				}
				if ( ( ds && fn && ds !== fn ) ) {
					str += i.WSIF_EXIST;
				}
				if ( this.wsif_ds_multi && ( !ds || fn ) ) {
					str += i.WSIF_PAGES;
				}
			}
			// warn of potential risks before setting; restore original if needed
			if ( str && confirm(str + i.CHOOSE_CANCEL) ) {
				// update settings and save file
				woas.config.wsif_ds = fn; // save in UNIX format
				woas.wsif.ds_multi = fn && this.wsif_ds_multi;
				woas.full_commit();
				woas.set_current(current, true, true); // stop forward history destruction
			} else { // reset settings - approval not given or settings not valid
				fn = ds;
				this.wsif_ds_multi = woas.wsif.ds_multi;
				str = '';
			}
		}
		if (chk_box) {
			// 2. load correct values
			chk_box.checked = woas.bool2chk(woas.wsif.ds_multi);
			if (!set) {
				fn = ds;
			}
		}
		// 3. check/repair/set filename
		// convert unix path to windows path for display
		if (!str) {
			txt_box.value = is_windows ? fn.replace(reFwdSlash, '\\') : fn;
		}
	}
};

woas.ui._textbox_enter_event = woas.ui._textbox_enter_event_dummy;

//API1.0
// PVHL: should make go_to create history but not set_current; would make history easier
woas.go_to = function(cr) {
	var parts = cr.split('#'), section = parts[1], r = true, mv = 0, el;
	cr = parts[0];
	if (cr.indexOf(this.help_system._pfx) === 0 && cr.substr(-2) !== '::'
			&& current && page_titles.indexOf(parts[0]) !== -1) {
		// help system handles all help pages except WoaS::Help and namespace
		// listings unless loading wiki (current is empty)
		parts[0] = cr.substr(this.help_system._pfx.length);
		if (!parts[1]) {
			parts[1] = '';
		}
		woas.help_system.go_to(parts);
		return true;
	}
	// don't go anywhere while editing!
	if (this.ui.edit_mode) {
		return false;
	}
	if (cr && cr !== current) {
			r = this.set_current(cr, true);
	}
	if (r && section) {
		el = d$(section);
		if (el) {
			if (this.ui.display('fix_h')) {
				mv = Number(this.browser.ie) === 7
					? 0
					: d$('woas_header_wrap').offsetHeight + 8;
			} else {
				mv = Number(this.browser.ie) === 7
					? - d$('woas_header_wrap').offsetHeight
					: 8;
			}
			mv = el.offsetTop - mv;
		}
	}
//if (console) console.log(cr+'  '+section+'  '+mv);
	// there must be a better way!
	if (cr !== 'Special::Go to') {
		// just for now! (Chrome uses body - Webkit?)
		document.documentElement.scrollTop = mv;
		document.body.scrollTop = mv;
	}
	return r; // if loading could pass back scroll amount: current = ''
};

function back_or(or_page) {
	if (!woas.ui.back() && or_page !== current)
		woas.set_current(or_page, true);
}

// when cancel is clicked
function cancel() {
	woas.log("Called deprecated function: cancel");
	woas.ui.cancel();
}

// @module help_system
// PVHL: TODO close window in unload function
woas.help_system = {
	// page names that need to be modified for help lookup: WoaS:: +
	_help_lookup: ["Aliases", "CSS", "CSS::Boot", "CSS::Core", "CSS::Custom", "Hotkeys", "Plugins"],
	// make it easier to change names of help pages
	_pfx: "WoaS::Help::",
	popup_window: null,
	popup_wnd: ',status=no,menubar=no,resizable=yes,scrollbars=no,location=no,toolbar=no',
	// PVHL: TODO store values of these on resize in a config var - add top & left
	popup_w: Math.ceil(screen.width * 0.4),
	popup_h: Math.ceil(screen.height * 0.75),

	popup_code: woas.raw_js("\n\
function get_parent_woas() {\n\
	if (window.opener && !window.opener.closed)\n\
		return window.opener.woas;\n\
	else return null;\n\
}\n\
woas = {\n\
	go_to: function(pg) {\n\
		var woas = get_parent_woas();\n\
		if (woas !== null) {\n\
			// handle section-only links\n\
			if (pg.indexOf('#') === 0) {\n\
				woas.help_system.go_to(['', pg.substr(1)]);\n\
			}\n\
			woas.go_to(pg);\n\
		}\n\
	}\n\
}\n\
// used in help popups to access index\n\
function help_go_index() {\n\
	var woas = get_parent_woas();\n\
	if (woas !== null) {\n\
		woas.help_system.go_to(['Index', '']);\n\
	}\n\
}\n\
// used in help popups to go back to previous page\n\
function help_go_back() {\n\
	var woas = get_parent_woas();\n\
	if (woas !== null) {\n\
		woas.help_system.going_back = true;\n\
		woas.help_system.go_to([woas.help_system.previous_page.pop(), '']);\n\
	}\n\
}\n\
function d$(id) {\n\
	return document.getElementById(id);\n\
}\n\
function help_resize() {\n\
	var top = d$('woas_help_top_wrap').offsetHeight,\n\
		body = d$('woas_help_body_wrap');\n\
	body.style.top = top + 'px'; // stops a slight flash on some browsers\n\
	body.style.height = document.body.offsetHeight - top + 'px';\n\
}\n\
window.onresize = help_resize;\n"
	),

	// PVHL: this needs to be replaced with content from a page; too many side-effects
	//   to bother with right now; redesign coming in new version.
	// params: back|close value, back|close title, back|close function, display title, body
	popup_page: '<'+'div id="woas_help_top_wrap"><'+'div class="woas_help_top">\n\
<'+'input tabindex=2 class="woas_help_button" value="%s" title="%s" onclick="%s()"\
type="button" /><'+'input tabindex=1 class="woas_help_button" value="Index" onclick\
="help_go_index()" type="button" />%s<'+'/div><'+'/div><'+'div id="woas_help_body_wrap">\
<'+'div id="woas_help_body">\n%s<'+'/div><'+'/div>',

	going_back: false,
	previous_page: [],
	// PVHL: code changed to accept an array containing [page, section]
	//   - only comes here if a help page is targeted
	//   - page is name of help page without prefix
	//   - section must be a string (e.g. '')
	//   - no test has been done to see if help page exists
	go_to: function(pg) {
//		woas.log("help_system.go_to(["+pg.join('#')+"])");	//log:0
		if (!pg || pg.length !== 2 || !this.page_title && !pg[0]) {
			// add a log msg?
			this.going_back = false;
			pg = null;
			return;
		}
		if (pg[0]) {
			pg.push(woas.get_text(this._pfx + pg[0]));
			if (!pg[2]) {
				pg[2] = woas.get_text(this._pfx + 'Index');
				if (!pg[2]) { // add a log msg?
					this.going_back = false;
					pg = null;
					return;
				}
				pg[0] = 'Index';
			}
		}
		// save previous page and set new
		if (this.going_back) {
			this.going_back = false;
		} else if (this.page_title) {
			if (pg[0] !== this.page_title) {
				this.previous_page.push( this.page_title );
			} else if (!pg[1] && !this.popup_window.closed) {
				// same page and no section; just bring to front
				setTimeout('woas.help_system.popup_window.focus()', 0);
				return;
			}
		}
		if (pg[0]) {
			this.page_title = pg[0];
		}
		// allow overriding this function
		this.make_pop_up(pg);
/*
PVHL:
  any help page scripts are only active for main window (allows use of examples
  in main window). This works for now because Javascript code doesn't work the
  way the scripting module assumes: removing a script tag does NOT remove the
  code that tag created; the tag could be removed immediately after creation
  withoout affecting anything. Until scripting is rewritten to fix the clear
  function this activation is sufficient.
*/	
		woas.scripting.activate("page");
	},

	// PVHL: create a custom help page from scratch that works in all browsers
	//   pg = [title, section, text]; all must be strings
	make_pop_up: function(pg) {
		var title = this._pfx + pg[0], btn, fn, el;
		if ((this.popup_window === null) || this.popup_window.closed) {
			this.previous_page = [];
			this.popup_window = woas.popup("help_popup", this.popup_w,
				this.popup_h, this.popup_wnd,
				'<'+'title>' + title + '<'+'/title>' + '<'+'style type="text/css">'
				+ woas.css.get() + '<'+'/style>' + this.popup_code,
				woas.parser.parse(this.popup_page.sprintf(
					'Close', 'Close', 'window.close', pg[0], pg[2])),
				' class="woas_help"', ' class="woas_help"');
		} else { // load new page
			btn = this.previous_page.length ? 'Back' : 'Close';
			fn = this.previous_page.length ? 'help_go_back' : 'window.close';
			woas.setHTMLDiv(this.popup_window.document.body, woas.parser.parse(
					this.popup_page.sprintf(btn, btn, fn, pg[0], pg[2])));
			this.popup_window.document.title = title;
		}
		this.popup_window.help_resize();
		if (pg[1]) {
			el = this.popup_window.d$(pg[1]);
			if (el) {
				this.popup_window.d$("woas_help_body_wrap").scrollTop = el.offsetTop;
			}
		}
		// stop page load flash
		pg = null;
		setTimeout('woas.help_system.popup_window.focus()', 0);
	}
};

function menu_dblclick() {
	if (!woas.config.dblclick_edit)
		return false;
	woas.ui.edit_menu();
	return true;
}

function page_dblclick() {
	if (!woas.config.dblclick_edit)
		return false;
	edit();
	return true;
}

/** Used by search box **/
function menu_do_search() {
	// directly use the search page if it is active
    if (current === "Special::Search") {
		d$('string_to_search').value = d$('menu_string_to_search').value;
    }
    woas.do_search(d$('menu_string_to_search').value);
}

// Used by Special::Search
// make the actual search and cache the results
function ssearch_do_search() {
	var search_string = d$("string_to_search").value;
	if ( !search_string.length )
		return;
	woas.do_search(search_string);
}

function menu_key_hook(orig_e) {
    var e;
    if (!orig_e)
        e = window.event;
    else
        e = orig_e;
	var ck = woas.browser.ie ? e.keyCode : e.which;
    if (ck == 13) {
		ff_fix_focus();
		menu_do_search();
        return false;
     }
     return orig_e;
}

//FIXME: this is entirely a bad hack
function menu_search_focus(f) {
	if (f) {
		// prevent focus on the menu search box when the search page is active
		if (current == "Special::Search") {
//		ff_fix_focus();
			d$('string_to_search').focus();
		} else {
			woas.ui.focus_textbox();
		}
	} else {
		if (current != "Special::Search")
			woas.ui.blur_textbox();
	}
}

//NOTE: this is attached to onkeydown of menu's search box, so you can't use 'this'
woas.do_search = function(str, noclear) {
	// clear previous search results
	if (!noclear)
		woas.ui.clear_search(true);

	woas.progress_init("Searching");
	// reset result pages
	woas.pager.bucket.clear();

	// cache new search results
	woas._cache_search( str );
	woas.progress_finish();

	// refresh the search page, or go to it if we are not
	woas.ui._search_render();
};

// Used by Special::Options page
function save_options() {
	if (!woas.config.permit_edits) {
		alert(woas.i18n.READ_ONLY);
		return false;
	}
	woas.cfg_commit();
	// prefer to stay on the options page after saving
	woas.set_current(current, false);
}

function ro_woas() {
	if (!woas.config.permit_edits) {
		alert(woas.i18n.WRITE_PROTECTED);
		return false;
	}
	if (confirm(woas.i18n.CONFIRM_READ_ONLY + woas.i18n.CHOOSE_CANCEL)) {
		woas.config.permit_edits = false;
		woas.ui.display({ro:true}); // turn off icons
		woas.cfg_commit();
		// reloads page without killing forward history
		woas.set_current(current, true, true);
	}
}

// Used by Special::Lock
function lock_page(e) {
	// PVHL: see my notes for woas._password_ok for flag use discussion
	//  strings need to be i18n here and in _lock
	var flag = e ? (e.which || e.keyCode) === 13 : true, pwd, pi;
	if (flag) {
		if (!woas.currently_locking || !d$("pw1")) {
			return;
		}
		pwd = d$("pw1").value;
		if (!pwd.length) {
			d$("pw1").focus();
			return;
		}
		if (pwd !== d$("pw2").value) {
			alert("Passwords don't match!");
			d$("pw2").focus();
			return;
		}
		pi = woas.page_index(woas.currently_locking);
		woas.AES.setKey(pwd);
		woas._finalize_lock(pi, true);
	}
	return true;
}

// used in Special::Options
woas.bool2chk = function(b) {
	if (b) return "checked";
	return "";
}

// import wiki from external file
function import_wiki() {
	if (!woas.config.permit_edits) {
		alert(woas.i18n.READ_ONLY);
		return false;
	}
	woas.import_wiki();
}

function set_key() {
	woas._set_password();
}

// below function is used by Special::Lock

var _pw_q_lock = false;

function pw_quality() {

	if (_pw_q_lock)
		return;
		
	_pw_q_lock = true;

// used to get a red-to-green color tone
function _hex_col(tone) {
	var s=Math.floor(tone).toString(16);
	if (s.length==1)
		return "0"+s;
	return s;
}

	// original code from http://lxr.mozilla.org/seamonkey/source/security/manager/pki/resources/content/password.js
	var pw=d$('pw1').value;

	//length of the password
	var pwlength=pw.length;
	
	if (pwlength!==0) {

	//use of numbers in the password
	  var numnumeric = pw.match(/[0-9]/g);
	  var numeric=(numnumeric!==null)?numnumeric.length/pwlength:0;

	//use of symbols in the password
	  var symbols = pw.match(/\W/g);
	  var numsymbols= (symbols!==null)?symbols.length/pwlength:0;

	//use of uppercase in the password
	  var numupper = pw.match(/[^A-Z]/g);
	  var upper=numupper!==null?numupper.length/pwlength:0;
	// end of modified code from Mozilla
	
	var numlower = pw.match(/[^a-z]/g);
	var lower = numlower!==null?numlower.length/pwlength:0;
	
	var u_lo = upper+lower;
	  
	// 80% of security defined by length (at least 16, best 22 chars), 10% by symbols, 5% by numeric presence and 5% by upper case presence
	var pwstrength = ((pwlength/18) * 65) + (numsymbols * 10 + u_lo*20 + numeric*5);
	
	var repco = woas.split_bytes(pw).toUnique().length/pwlength;
	if (repco < 0.8)
		pwstrength *= (repco+0.2);
//		woas.log("pwstrength = "+(pwstrength/100).toFixed(2)+", repco = "+repco);	// log:1
	} else
		pwstrength = 0;
  
	if (pwstrength>100)
		color = "#00FF00";
	else
		color = "#" + _hex_col((100-pwstrength)*255/100) + _hex_col((pwstrength*255)/100) + "00";
  
	d$("pw1").style.backgroundColor = color;
	woas.setHTMLDiv(d$("txtBits"), "Key size: "+(pwlength*8).toString() + " bits");
	
	_pw_q_lock = false;
}

// used by embedded file show page
function show_full_file(pi) {
	var text = woas.get__text(pi);
	if (text===null)
		return;
	// put WoaS in loading mode
	woas.progress_init("Loading full file");
	// clear the partial display and put in the whole file content
	woas.setHTML(d$('_part_display'), '');
	woas.setHTML(d$('woas_file_ct'), woas.xhtml_encode(woas.base64.decode(text)));
	// finished loading the file
	woas.progress_finish();
}

function query_export_file(cr) {
	var fn = cr.substr(cr.indexOf("::")+2);
	if (confirm(woas.i18n.CONFIRM_EXPORT.sprintf(cr)+"\n\n"+woas.ROOT_DIRECTORY+fn))
		woas.export_file(cr, woas.ROOT_DIRECTORY+fn);
}

function query_export_image(cr) {
	var img_name = cr.substr(cr.indexOf("::")+2);
	if (confirm(woas.i18n.CONFIRM_EXPORT.sprintf(img_name)+"\n\n"+woas.ROOT_DIRECTORY+img_name))
		woas.export_image(cr, woas.ROOT_DIRECTORY+img_name);
	return false;
}


// PVHL: FIX Goes back 2 pages
function query_delete_file(cr) {
	if (!confirm(woas.i18n.CONFIRM_DELETE.sprintf(cr)))
		return;
	// do not check for plugin deletion here
	woas.delete_page(cr);
	return false;
}

// delayed function called after page loads and runs the script tag
// PVHL: this should be called by img onload event, not a timer
function _img_properties_show(mime, tot_len, enc_len, mts, fail) {
	var img ='woas_img_tag', html = '';
	if (fail) {
		html = woas.i18n.IMG_LOAD_ERR;
		d$.hide(img);
	} else {
		img = d$(img);
	}
	html +=	"\n"+woas.i18n.MIME_TYPE+": "+mime+"\n"+
		woas.i18n.FILE_SIZE+": about "+_convert_bytes(((tot_len-enc_len)*3)/4, 1)+
		woas.i18n.B64_REQ.sprintf(_convert_bytes(tot_len, 1))+
		"\n"+woas.last_modified(mts)+(fail ? ''
		: "\n"+woas.i18n.WIDTH+": "+img.width+"px\n"+
		woas.i18n.HEIGHT+": "+img.height+"px");
	woas.setHTMLDiv(d$('woas_img_desc'), woas.macro._parse(html));
	return false;
}

function query_delete_image(cr) {
	if (!confirm(woas.i18n.CONFIRM_DELETE_IMAGE.sprintf(cr)))
		return;
	// do not check for plugin deletion here
	woas.delete_page(cr);
	back_or(woas.config.main_page);
	return false;
}

// triggered by UI graphic button
// PVHL: print CSS now controlled by CSS (section /* PRINT */) to allow change
//   by those who use the print window for presentations.
function page_print() {
	woas._customized_popup(current,
		woas.getHTMLDiv(d$("woas_page")),
		'woas={};woas.go_to=function(page){alert("'
		+woas.js_encode(woas.i18n.PRINT_MODE_WARN)+'");}',
		'', ' id="woas_page" class="woas_print"');
}

/*
Needs change to custom help/print css. Read from WoaS::CSS::[Help|Print]
This function is no longer used by the help system; print_popup is hardwired!
*/
woas._customized_popup = function(page_title, page_body, additional_js,
		additional_css, body_extra) {
	if (additional_js.length)
		additional_js = woas.raw_js(additional_js);
	// create the popup
	return woas.popup(
		"print_popup",
		Math.ceil(screen.width*0.75),
		Math.ceil(screen.height*0.75),
		",status=yes,menubar=yes,resizable=yes,scrollbars=yes",
		// head
		"<"+"title>" + page_title + "<"+"/title>" + "<"+
		"style type=\"text/css\">"+ woas.css.get() + additional_css +
		"<"+"/sty" + "le>" + additional_js, page_body, body_extra
	);
};

// below functions used by Special::Export

// PVHL: blob saving disabled until it works cross-browser
woas.export_wiki_wsif = function () {
	var path, fname, author, single_wsif, inline_wsif, all_wsif, done, pos;
	try {
		path = d$("woas_ep_path").value;
		pos = path.lastIndexOf('/') + 1 || path.lastIndexOf('\\') + 1;
		if (pos) {
			fname = path.substring(pos);
			path = woas.ROOT_DIRECTORY + path.substring(0, pos);
		}  else {
			fname = path;
			path  = woas.ROOT_DIRECTORY;
		}
		author = this.trim(d$("woas_ep_author").value);
		single_wsif = !d$("woas_cb_multi_wsif").checked;
		//inline_wsif = !d$("woas_cb_linked_wsif").checked;
		inline_wsif = true;
		all_wsif = !!d$("woas_cb_all_wsif").checked;
	} catch (e) { this.crash(e); return false; }
	
	done = this._native_wsif_save(path, fname, false, single_wsif, inline_wsif, author, all_wsif, []);
	if (done) {
		this.alert(this.i18n.EXPORT_OK.sprintf(done, this.wsif.expected_pages));
	} else {
		this.alert(this.i18n.SAVE_ERROR.sprintf(fname));
	}
	return true;
};

// create a centered popup given some options
woas.popup = function(name,fw,fh,extra,head,body, body_extra, html_extra) {
	body_extra = body_extra || "";
	html_extra = html_extra || "";
	var hpos=Math.ceil((screen.width-fw)/2);
	var vpos=Math.ceil((screen.height-fh)/2);
	var wnd = window.open("about:blank",name,"width="+fw+",height="+fh+		
	",left="+hpos+",top="+vpos+extra);
	wnd.focus();
	wnd.document.writeln(this.DOCTYPE+"<"+"html"+html_extra+"><"+"head>"+head+
						"<"+"/head><"+"body"+body_extra+">"+
						body+"<"+"/body></"+"html>\n");
	wnd.document.close();
	return wnd;
};

// PVHL: None of the progress stuff works because JavaScript is single-threaded
// tell user how much work was already done
woas.progress_status = function (ratio) {
	// no progress indicators in debug mode
	if (this.config.debug_mode) return;
	this.setHTML(d$("woas_wait_text"), this._progress_section + "\n" +
				Math.ceil(ratio*100)+"% done");
};

// used to debug progress indicators
woas._progress_section = false;

// reset progress indicator
woas.progress_init = function(section) {
	if (this._progress_section !== false) {
		this.crash("Progress indicator already started for "+this._progress_section+
					", will not start a new one for "+section);
		return;
	}
	this._progress_section = section;
	if (typeof section == "undefined")
		section = "";
	else section = "\n" + section;
	// no progress indicators in debug mode
	if (this.config.debug_mode) return;
	this.setHTML(d$("woas_wait_text"), section);
	document.body.style.cursor = "wait";
	// put in busy mode and block interaction for a while
	this.ui.display({"wait": true});
	d$("loading_overlay").focus();
};

/*
PVHL: previously this did nothing if in debug mode and 'crashed' if it
  didn't know progress was being used. This can lead to problems from
  various sources. One issue was that if debug mode was changed by import
  then the cursor stayed in 'wait'. This now does the same for every
  caller - just in case; at worst we waste a little time. Cursor control
  will soon be handed over to CSS and '.woas_wait'; leave for now
*/
woas.progress_finish = function(section) {
	document.body.style.cursor = "auto";
	this.setHTML(d$("woas_wait_text"), this.i18n.LOADING);
	if (this.ui.display('wait')) {
		// hide the progress area
		this.ui.display({wait: false});
	}
	this._progress_section = false;
};

function search_focus(focused) {
	if (focused) {
		woas.ui._textbox_enter_event = ssearch_do_search;
		woas.ui.focus_textbox();
	} else {
		woas.ui.blur_textbox();
		ff_fix_focus();
	}
}

woas._hl_marker = _random_string(10)+":%d:";

woas._hl_marker_rx = new RegExp(woas._hl_marker+":(\\d+):", "g");

// display search results
woas._search_load = function() {
	woas.log("called _search_load()");
	var P = {body: ""};
	if (this._last_search === null) {
//		woas.log("No search done, returning blank");	//log:0
	} else {
		// proceed to parsing if there are matching pages
		if (this._cached_title_search.length + this._cached_body_search.length !== 0) {
		
			// (1) prepare the title results
			for(var i=0,it=this._cached_title_search.length;i<it;++i) {
				P.body += "* [["+ this._cached_title_search[i] + "]]\n";
				woas.pager.bucket.add(this._cached_title_search[i]);
			}
			
			// (2) parse the body snippets
			for(var i = 0, it = this._cached_body_search.length; i < it; ++i) {
				P.body += "\n* [[" + this._cached_body_search[i].title + "]] - found "
						+ this._hl_marker+":" + i + ":";
				woas.pager.bucket.add(this._cached_body_search[i].title);
			}

			P.body = 'Results for <'+'strong class="woas_search_highlight">'
					+ woas.xhtml_encode(woas._last_search) + "<"+"/strong>\n" + P.body;
		} else
			P.body = "/No results found for *" + woas.xhtml_encode(woas._last_search) + "*/";

	}

	// position cursor back in search box
	d$("string_to_search").focus();
	
	if (P.body.length) {
		// parse results before applying search terms highlighting
		woas.parser.syntax_parse( P, [] );
		
		P.body = P.body.replace(this._hl_marker_rx, function(str, i) {
			var r="",count=0;
			// PVHL: don't worry about IE pre as results are single line
			for(var a=0,at=woas._cached_body_search[i].matches.length;a<at;++a) {
				r += "<"+"pre class=\"woas_search_results\">" +
						// apply highlighting
						woas._cached_body_search[i].matches[a].replace(woas._reLastSearch, function(str, $1) {
							++count;
								return '<'+'span class="woas_search_highlight">'+$1+'<'+'/span>';
						})+"<"+"/pre>";
			}
			return " <"+"strong>"+count+"<"+"/strong> times: "+r;
		});
	}
	
	// finally output XHTML content
	woas.setHTMLDiv(d$('woas_search_results'), P.body);
};

var _servm_shown = false;

function _servm_alert() {
	if (woas._server_mode) {
		// show the message only once
		if (!_servm_shown) {
			woas.alert(woas.i18n.SERVER_MODE);
			_servm_shown = true;
		}
	}
}

woas.update_view = function() {
	var v = {view: true, edit: false};
	v.no_back = !this.history.has_backstack();
	v.no_fwd = !this.history.has_forstack();
	v.no_home = current === this.config.main_page;
	v.no_tools = current === "Special::Advanced";
	v.no_edit = !(this.config.permit_edits && this.edit_allowed(current));
	/* turn correct lock/unlock icons on/off then disable/enable them both */
	v.locked = this.is_encrypted(current);
	v.unlocked = !v.locked;
	v.no_lock = !this.config.permit_edits || this.is_reserved(current);
	this.ui.display(v, true);
};

// PVHL: this function not used by update_nav_icons (now update_view) any more as it
// had added functionality that is currently untested and unused.
// See 0.12.0 code (or my earlier code) for code
//
// woas.update_lock_icons = function(page) {

// when the page is resized
// PVHL: still some edit resize issues with Safari. Works well enough though.
//   document.documentElement.clientHeight works in all browsers so window.height
//   not used; old IEs don't have window.height.
woas.ui._resize = (function() {
	function resize() {
		if (woas.ui.edit_mode) {
			var e = d$('woas_editor'), h = e.offsetHeight +
				document.documentElement.clientHeight - document.body.offsetHeight;
			if (woas.browser.ie && Number(woas.browser.ie) < 7) {
				// stops IE6 textarea overflow; will fix later
				e.style.width = 0;
				e.style.width = d$('woas_editor_sizer').offsetWidth + 'px';
			}
			// PVHL: stops Opera overflow on resize while editing; don't know why it happens yet
			if (woas.browser.opera) { --h };
			e.style.height = (h > 64 ? h : 64) + 'px';
		}
	}
	return woas.browser.ie && Number(woas.browser.ie) < 8
		// stops ie6/7 editor resizing issue until good fix known
		? function() { setTimeout(resize, 0) }
		: function() { resize(); };
}());
window.onresize = woas.ui._resize;

woas._set_debug = function(status, closed) {
	var logbox = d$("woas_debug_log"), lines = -1, position = 0,
		cut = 100, max = 200; // cut > 0, max > cut
	if (status) {
	// logging function - used in development; call without argument to scroll to bottom
	// and see if we are in debug mode
		woas.log = function (msg) {
			if (msg) {
				if (!woas.tweak.integrity_test) {
					// log up to max lines; 'cut' lines removed if too big
					if (++lines === max) { // lines is line count now, before this post
						logbox.value = logbox.value.substring(position);
						lines = max - cut;
					} else if (lines === cut) {
						position = logbox.value.length;
					}
				}
				logbox.value += msg + '\n';
				// same msg to console
				//if (console) {
				//	console.log(msg);
				// kept as it was here first
				//} else if (window.opera) {
				//	opera.postError(msg);
				//}
			}
			// keep the log scrolled down
			logbox.scrollTop = logbox.scrollHeight;
			return true;
		};
		// activate debug icon
		this.ui.display({no_debug: false, no_log: closed});
	} else {
		this.ui.display({no_debug: true, no_log: true});
		logbox.value = '';
		woas.log = function() { return false; };
	}
	// hide the progress area - PVHL: why done here?
	this.ui.display({wait: false});
	window.log = woas.log // for deprecated function - legacy.js
};

/*
PVHL:
  this function (was refresh_menu_area) now sets the menu using the highest
  namespace menu found for much greater flexibility and better looks.
  If people have problems with this I'll write an update plugin to put
  menu at beginning of sub-menu.
*/
woas.ui.refresh_menu = function() {
	var pi = -1, menu, ns, tmp;
	// locate the menu for current namespace, or a previous one if not found
	// (all the way back to ::Menu if need be). Menu is set every time, though
	// I will see if it makes sense not to for ns=''. There are issues with
	// this, though, and I had to disable optional loading in original code.
	// For now no special menus for any core pages - nice to have later.
	if (current.indexOf('WoaS::') === 0 || current.indexOf('Special') === 0) {
		tmp = -1;
	} else {
		tmp = current.lastIndexOf("::");
	}
	ns = tmp > 0 ? current.substr(0, tmp) : '';
	while (true) {
//		woas.log("menu testing "+ns+"::Menu");	// log:0
		pi = woas.page_index(ns+"::Menu");
		if (pi !== -1 || !ns) { break; }
		tmp = ns.lastIndexOf("::");
		ns = tmp === -1 ? "" : ns.substr(0, tmp);
	}
	menu = pi === -1 ? 'ERROR: No menu!' : woas.get__text(pi);
	if (menu) {
//		woas.log("menu found: "+page_titles[pi]);	// log:0
		woas.parser._parsing_menu = true;
		woas.setHTMLDiv(d$("woas_menu"),
			woas.parser.parse(menu, false, woas.js_mode(ns+"::Menu")));
		woas.parser._parsing_menu = false;
		if (!ns) {
// PVHL: check why woas is done every time; change to when needed
			woas.scripting.clear("menu");
			woas.scripting.activate("menu");
		}
	} else {
		woas.setHTMLDiv(d$("woas_menu"), '');
		woas.scripting.clear("menu");
	}
	woas.current_namespace = ns;
};

// adapted by PVHL from: weston.ruter.net/2009/05/07/detecting-support-for-data-uris
woas.ui.img_display = function() {
	function loaded(el){ /*alert(el.width+" "+el.height);*/
		if (el.width !== 1 || el.height !== 1) {
			woas.ui.display({no_img: true});
		}
	}
	var data = new Image();
	data.onload = function() {/*alert("onload");*/loaded(this);}
	data.onerror = function() {/*alert("onerror");*/loaded(this);}
	data.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
};

woas.menu_display = function(id, visible, opaque) {
	// toolbar images now controlled through anchor tag; dim instead of hiding
	i=id; id = d$('woas_' + id);
	opaque = opaque || false;
	var c = opaque ? 'woas_disabled' : 'woas_hide', ic = id.className, p = ic.indexOf(c);
	if (visible && p !== -1) {
		if (p) {
			id.className = ic.substr(0, ic[p - 1] === ' ' ? p - 1 : p) + ic.substr(p + c.length);
		} else {
			id.className = ic.substr(c.length + (ic.length > c.length && ic[c.length + 1] === ' ' ? 1 : 0));
		}
	} else if (!visible && p === -1) {
		id.className += (ic.length ? ' ' : '') + c;
	}
};

woas.refresh_mts = function(mts) {
	// generate the last modified string to append
	if (mts) {
		this.setHTMLDiv(d$("woas_mts"), this.last_modified(mts));
		this.ui.display({"no_mts": false});
	} else
		this.ui.display({"no_mts": true});
};

woas._set_title = function (new_title) {
	this.setHTMLDiv(d$("woas_title"), this.create_breadcrumb(new_title));
	document.title = new_title;
};

// function which hooks all messages shown by WoaS
// can be fed with multiple messages to show consecutively
woas.alert = function() {
	for(var i=0,l=arguments.length;i < l;++i) {
		alert("WoaS: "+arguments[i]);
	}
};

// same as above, but for unhandled errors
woas.crash = function() {
	for(var i=0,l=arguments.length;i < l;++i) {
		alert("WoaS Unhandled error\n----\n"+arguments[i]);
	}
};

// PVHL: have simplified usage (here just to document):
woas.currently_locking = '';
// called from Special::Lock page
function _lock_page() {
	// do not call if not on a page locking context
	if (current.indexOf("Lock::")!==0)
		return;
	var page = current.substring(6);
	woas.currently_locking = page;
	d$("btn_lock").value = "Lock "+page;
	d$("pw1").focus();
}

function _woas_new_plugin() {
	var title = woas._prompt_title("Please enter plugin name", "Myplugin", true);
	if (title === null)
		return;
	var def_text;
	// provide special include page support
	// --UNSUPPORTED FEATURE--
	if (title.charAt(0) === '@') {
		def_text = "plugins/"+title.substr(1)+".js\n";
	} else {
		def_text = "/* "+title+" plugin */\n";
	}
	woas._create_page_direct("WoaS::Plugins", title, false, def_text);
	// now we will be editing the plugin code
}

// PVHL: make this part of closure for method below
woas._last_filename = null;

// works - one way or another - for all browsers
// retrieve complete path & filename from file input control
// 	 id is optional, default is 'filename_'
//   use_last is optional (used with id)
//   filename is returned if it exists, otherwise empty string
woas.get_input_file_url = function(id, use_last) {
	id = id || 'filename_';
	var f = d$(id), fn = f.value, is_path = /[\\\/]+/;
	if (!fn) {
		this.alert(this.i18n.FILE_SELECT_ERR);
	} else {
		if (!is_path.test(fn)) {
			// read of control failed to provide directory path
			// try known firefox method (early firefox succeeded, so not here)
			if (this.browser.firefox) {
				try {
					netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
					fn = f.value;
				} catch (e) {
					woas.log("NOTICE: exception while attempting to access file path:\n\n" + e);	// log:1
					// PVHL: replace with i18n string!
					alert('Unable to access local files due to browser security settings. ' +
						'To overcome this, follow these steps:\n' +
						'(1) Enter "about:config" in the URL field;\n' +
						'(2) Right click and select New->Boolean;\n' +
						'(3) Enter "signed.applets.codebase_principal_support" ' +
						'(without the quotes) as a new preference name;\n' +
						'(4) Click OK and try loading the file again.');
					fn = '';
				}
			}
			if (!is_path.test(fn)) {
				// couldn't get path; ask for direct entry unless use_last specified
				if (use_last) {
					fn = this._last_filename;
				} else {
					fn = prompt(this.i18n.ALT_BROWSER_INPUT
							.sprintf(this.basename(fn)), this.ROOT_DIRECTORY);
				}
			}
			if (!is_path.test(fn)) {
				fn = false; // why not '' ?
			} else {
				this._last_filename = fn;
			}
		}
	}
	return fn;
}

/*
woas.css.ff2 (string:valid CSS): css added if browser == ff2 when !raw 
woas.css.set(css, raw)
  css (string:valid CSS): the raw css to be set; replaces old css
  raw (boolean, optional): if true browser fixes will not be applied to css
woas.css.get(): returns currently set CSS (string:valid CSS)
*/
woas.css = {
	// PVHL: these probably aren't needed anymore - check.
	FF2: "\npre { white-space: -moz-pre-wrap !important; }\n",
	IE: "\npre { word-wrap: break-word !important; }\n",
	OPERA: "\npre { white-space: -o-pre-wrap !important; }\n",
	
	// TODO: replace with factory function for just this browser
	set: function(css, raw) {
		raw = raw || false;
		// add some browser-specific wrapping fixes
		if (!raw) {
			if (woas.browser.firefox2)
				// fixes are added first so they can be overridden
				// (although they have an !important property attribute)
				css = this.FF2 + css;
			else if (woas.browser.trident)
				css = this.IE + css;
			else if (woas.browser.presto)
				css = this.OPERA + css;
		}
		if (woas.browser.ie)
			woas.dom._cache.stylesheet.cssText = css;
		else {
		// Setting innerText was causing a 13 second delay in Chrome!
		// Current versions of Chrome/Safari (AppleWebKit Windows) seem to be OK with innerHTML
			/*if (woas.browser.chrome || woas.browser.safari)
				woas.dom._cache.stylesheet.innerText = css;
			else*/
			woas.dom._cache.stylesheet.innerHTML = css;
		}
	},
	
	// Not used/needed in public API; can't easily fix this with current code.
	// Can't see this being a problem though.
	get: function() {
		if (woas.browser.ie)
			return woas.dom._cache.stylesheet.cssText;
		// on Chrome/Safari innerHTML contains br tags
		// PVHL: Above is no longer true (see css.set) - was this an early WebKit issue?
		/*if (woas.browser.chrome || woas.browser.safari)
			return woas.dom._cache.stylesheet.innerText;*/
		return woas.dom._cache.stylesheet.innerHTML;
	}
};

/*
woas.ui.display() closure
	pfx:(private) defines the prefix that will be added to all CSS classes
	state: (private) used to track current control state
	dsp is either:
	  (1) object passed to display to set new state;
	       - any dsp key that tests true is set in state
		   - any dsp key that tests false is reset in state if it exists
	  (2) a string that will be tested to see if such a key is set.
	      Possibilities are:
	         view, edit, pswd, wait, locked, unlocked, ro, fix_h, fix_m,
	         no_img, no_back, no_fwd, no_home, no_tools, no_edit, no_lock,
			 no_log, no_debug, no_mts
	      Plug-ins can add anything desired; everything controlled through CSS.
*/
woas.ui.display = (function() {
	var pfx = 'woas_',
		state = {};
	return function(dsp, resize) {
		var clas, s = [];
		// show if state exists for disabling functions
		if (typeof dsp === 'string') {
			return !!state[dsp];
		} else {
			for (clas in dsp) {
				if (dsp.hasOwnProperty(clas)) {
					if (dsp[clas]) {
						state[clas] = true;
					} else if (state[clas] && state.hasOwnProperty(clas)) {
						state[clas] = false;
					}
				}
			}
			for (clas in state) {
				if (state[clas] && state.hasOwnProperty(clas)) {
					s.push(pfx + clas);
				}
			}
			document.documentElement.className = s.join(' ');
		}
		if (resize) { this._resize(); }
	}
}())