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
		}
		// cancel key
		if (ck == woas.hotkey.all.cancel) {
			woas.ui.cancel();
			ff_fix_focus();
			return false;
		}
		return orig_e;
	},
	// could have a better name
	// PVHL: most of this should be moved into woas.help_system
	//  Also, allow an optional page title to be passed in, even if in editor
	//  This function should use full page titles; help_system should use postfix
	//  (everything after WoaS::Help)
	help: function() {
		var wanted_page, pi, htitle = current;
		// we are editing
		if (this.edit_mode) {
			wanted_page = "WoaS::Help::Editor";
			pi = woas.page_index(wanted_page);
		} else {
			// normalize namespace listngs
			if (htitle.lastIndexOf('::') === htitle.length - 2)
				htitle = htitle.substring(0, htitle.length - 2);
			if (htitle.indexOf('WoaS::') === 0 &&
					woas.help_system._help_lookup.indexOf(htitle.substr(6)) !== -1)
				// change the target page in some special cases
				htitle = htitle.substr(6);
			pi = woas.page_index("WoaS::Help::"+htitle);
			if (pi === -1) {
				wanted_page = "WoaS::Help::Index";
				pi = woas.page_index(wanted_page);
			} else {
				wanted_page = "WoaS::Help::"+htitle;
			}
		}
		woas.help_system.go_to(wanted_page, pi);
	},
	tables_help: function() {
		woas.help_system.go_to("WoaS::Help::Tables");
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
			this._import_load_change(true);
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
	// WoaS::Import can disable page import
	_import_load_change: function(init) {
		if (init) {
			this._import_load_css = d$("woas_cb_import_styles").checked;
		}
		if (d$("woas_cb_import_content").checked) {
			woas.importer.i_content = true;
			d$.show("woas_import_content");
			// import CSS only possible if import content selected
			d$("woas_cb_import_styles").checked = woas.importer.i_styles
				= this._import_load_css;
			d$("woas_cb_import_styles").disabled = false;
		} else {
			woas.importer.i_content = false;
			d$.hide("woas_import_content");
			this._import_load_css = d$("woas_cb_import_styles").checked;
			d$("woas_cb_import_styles").checked = woas.importer.i_styles = false;
			d$("woas_cb_import_styles").disabled = true;
		}
	},
	// click on edit icon
	edit: function() {
		woas.edit_page(current);
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
					woas.refresh_menu_area();
				}
			}
		}
		current = woas.prev_title;
		woas.update_view();
//		woas.log(woas.history.log_entry()); //log:0
		woas.disable_edit();
	},
	// when back button is clicked
	back: function() {
		if (this.edit_mode)
			return false;
		var p = woas.history.back();
		if (p === null)
			return false;
		return woas.set_current(p, true);
	},
	// when Forward button is clicked
	forward: function() {
		var p = woas.history.forward();
		if (p === null)
			return false;
		return woas.set_current(p, true)
	},
	// when home is clicked
	home: function() {
		woas.go_to(woas.config.main_page);
	},
	ns_menu_dblclick: function() {
		if (!woas.config.dblclick_edit)
			return false;
		woas.ui.edit_ns_menu();
		return true;
	},
	edit_ns_menu: function() {
		var ns = woas.current_namespace, mpi, tmp;
		while (ns !== "") {
			mpi = woas.page_index(ns + "::Menu");
			if (mpi !== -1) {
				woas.edit_page(ns + "::Menu");
				break;
			}
			tmp = ns.lastIndexOf("::");
			ns = tmp === -1 ? "" : ns.substring(0, tmp);
		}
	},
	lock: function() {
		if (woas.pager.bucket.items.length>1)
			_lock_pages(woas.pager.bucket.items);
		else
			woas.go_to("Lock::" + current);
	},
	unlock: function() {
		if (woas.pager.bucket.items.length>1)
			_unlock_pages(woas.pager.bucket.items);
		else
			woas.go_to("Unlock::" + current);
	},
	// scroll to top of page
	top: function() {
		scrollTo(0,0);
	},
	advanced: function() {
		woas.go_to("Special::Advanced");
	},
	set_header: function(fixed) {
		if (!woas.browser.ie6) {
			d$("woas_header_wrap").style.position = (fixed ? "fixed" : "absolute");
		}
	},
	set_menu: function(fixed) {
		if (!woas.browser.ie6) {
			d$("woas_menu_wrap").style.position = (fixed ? "fixed" : "absolute");
		}
	},
/*	set_mode: function(edit) {
		if (edit) {
		} else {
		}
	},*/
	set_layout: function(fixed)  {
		this.set_header(fixed);
		this.set_menu(fixed);
	},
	// if called with input 'el' and !'check' then sets config in UNIX format,
	// if called with input 'el' and 'check' then checks/repairs filename in el.
	// else gets config value. Returns OS native path.
	wsif_ds: function(el, check) {
		// get path in UNIX format; stored this way - but just to be safe
		var ds = woas.config.wsif_ds.replace(/\\/g, '/'), i, c, e, o,
			subpath = (el ? el.value.replace(/\\/g, '/') : ds);
		// make sure it's relative - assume stored value is
		while (subpath[0] === '/') subpath = subpath.substr(1);
		if (el && !check) {
			i = woas.i18n, c = i.CHOOSE_CANCEL, e = i.WSIF_EXIST, o = i.WSIF_ORIGINAL;
			// warn of potential risks before setting; restore original if needed
			if ((subpath && ds && subpath !== ds && confirm(e + o + c)) ||
					(subpath && !ds && confirm(i.WSIF_DS_TO_EXTERNAL + e + c)) ||
					(!subpath && ds && confirm(i.WSIF_DS_TO_INTERNAL + o + c))) {
				woas.config.wsif_ds = subpath;
			} else {
				subpath = ds;
			}
			el.value = subpath;
		}
		if (is_windows) {
			// convert unix path to windows path
			subpath = subpath.replace(reFwdSlash, '\\');
		}
		return subpath;
	}
};

woas.ui._textbox_enter_event = woas.ui._textbox_enter_event_dummy;

//API1.0
woas.go_to = function(cr) {
	// won't go anywhere while editing!
	if (this.ui.edit_mode)
		return false;
	if (cr === current)
		return true;
	return this.set_current(cr, true)
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
	popup_window: null,
	popup_wnd: ',status=no,menubar=no,resizable=yes,scrollbars=no,location=no,toolbar=no',
	popup_w: Math.ceil(screen.width * 0.75),
	popup_h: Math.ceil(screen.height * 0.75),
	popup_title: null,

	popup_code: woas.raw_js("\n\
function get_parent_woas() {\n\
	if (window.opener && !window.opener.closed)\n\
		return window.opener.woas;\n\
	else return null;\n\
}\n\
woas = {\n\
	go_to: function(page) { var woas = get_parent_woas();\n\
		if (woas !== null)\n\
			woas.help_system.go_to(page);\n\
	}\n\
}\n\
// used in help popups to access index\n\
function help_go_index() {\n\
	var woas = get_parent_woas();\n\
	if (woas === null) return;\n\
	woas.help_system.go_to('WoaS::Help::Index');\n\
}\n\
// used in help popups to go back to previous page\n\
function help_go_back() {\n\
	var woas = get_parent_woas();\n\
	if (woas === null) return;\n\
	woas.help_system.going_back = true;\n\
	woas.help_system.go_to(woas.help_system.previous_page.pop());\n\
	return;\n\
}\n\
function d$(id) {\n\
	return document.getElementById(id);\n\
}\n\
function help_resize() {\n\
	var top = d$('woas_help_top_wrap').offsetHeight,\n\
		body = d$('woas_help_body_wrap');\n\
	body.style.top = top; // stops a slight flash on some browsers\n\
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
<'+'div class="woas_help_body">\n%s<'+'/div><'+'/div>',

	going_back: false,
	previous_page: [],

	go_to: function(wanted_page, pi) {
//		woas.log("help_system.go_to(\""+wanted_page+"\")");	//log:0
		var t = {}, _pfx = "WoaS::Help::";
		if (typeof pi == "undefined")
			pi = woas.page_index(wanted_page);
		// this is a namespace
		if (pi === -1) {
			woas.go_to(wanted_page);
			return;
		} else {
			// see if this page shall be opened in the main wiki or in the help popup
			if (page_titles[pi].substr(0, _pfx.length) === _pfx)
				t.text = woas.get__text(pi);
			else { // open in main wiki
				woas.go_to(page_titles[pi]);
				return;
			}
		}
		if (t.text === null)
			return;
		// save previous page and set new
		if (this.going_back)
			this.going_back = false;
		else if (this.page_title !== null)
			this.previous_page.push( this.page_title );
		this.page_title = wanted_page;
		// allow overriding this function
		this.make_pop_up(t);
	},

	// PVHL: create a custom help page from scratch that works in all browsers
	make_pop_up: function(t) {
		var title = this.page_title.substr(12), btn, fn;
		if ((this.popup_window === null) || this.popup_window.closed) {
			this.previous_page = [];
			this.popup_window = woas.popup("help_popup", this.popup_w,
				this.popup_h, this.popup_wnd,
				'<'+'title>' + this.page_title + '<'+'/title>' + '<'+'style type="text/css">'
				+ woas.css.get() + '<'+'/style>' + this.popup_code,
				woas.parser.parse(this.popup_page.sprintf(
					'Close', 'Close', 'window.close', title, t.text)),
				' class="woas_help" onload="help_resize()"', ' class="woas_help"');
			this.popup_window.help_resize(); //seems to help a bit with flash
		} else { // load new page
			btn = this.previous_page.length ? 'Back' : 'Close';
			fn = this.previous_page.length ? 'help_go_back' : 'window.close';
			woas.setHTMLDiv(this.popup_window.document.body,
				woas.parser.parse(this.popup_page.sprintf(btn, btn, fn, title, t.text)));
			this.popup_window.document.title = this.page_title;
			this.popup_window.scrollTo(0,0);
			this.popup_window.help_resize();
			// stop flash on page load
			setTimeout("woas.help_system.popup_window.focus()", 0);
		}
	}
};

function menu_dblclick() {
	if (!woas.config.dblclick_edit)
		return false;
	edit_menu();
	return true;
}

function page_dblclick() {
	if (!woas.config.dblclick_edit)
		return false;
	edit();
	return true;
}

function edit_menu() {
	woas.edit_page("::Menu");
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
	woas.ui.back(); // works now history is somewhat fixed
	//woas.set_current("Special::Advanced", true);
}

function ro_woas() {
	if (!woas.config.permit_edits) {
		alert(woas.i18n.WRITE_PROTECTED);
		return false;
	}
	if (confirm(woas.i18n.CONFIRM_READ_ONLY + woas.i18n.CHOOSE_CANCEL)) {
		woas.config.permit_edits = false;
		woas.cfg_commit();
		// reparse page
		woas.setHTMLDiv(d$("woas_page"),
			woas.parser.parse(woas.get_text("Special::Options"), false, 1));
		woas.scripting.activate("page");
	}
}

// Used by Special::Lock
function lock_page(page) {
	var pwd = d$("pw1").value;
	if (!pwd.length) {
		d$("pw1").focus();
		return;
	}
	if (pwd !== d$("pw2").value) {
		d$("pw2").focus();
		return;
	}
	var pi = woas.page_index(page);
	woas.AES.setKey(pwd);
	woas._finalize_lock(pi);
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
	// PVHL: refresh already done by woas.import_wiki
	// woas.refresh_menu_area();
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
}

function query_delete_file(cr) {
	if (!confirm(woas.i18n.CONFIRM_DELETE.sprintf(cr)))
		return;
	// do not check for plugin deletion here
	woas.delete_page(cr);
	back_or(woas.config.main_page);
}

// delayed function called after page loads and runs the script tag
function _img_properties_show(mime, tot_len, enc_len, mts) {
	var img=d$('woas_img_tag');
	woas.setHTML(d$('woas_img_desc'),
		woas.i18n.MIME_TYPE+": "+mime+"<"+"br /"+
		">"+woas.i18n.FILE_SIZE+": about "+_convert_bytes(((tot_len-enc_len)*3)/4)+
		woas.i18n.B64_REQ.sprintf(_convert_bytes(tot_len))+
	"<"+"br />"+woas.last_modified(mts)+
	"<"+"br />"+woas.i18n.WIDTH+": "+img.width+"px<"+"br />"+woas.i18n.HEIGHT+": "+img.height+"px");
}

function query_delete_image(cr) {
	if (!confirm(woas.i18n.CONFIRM_DELETE_IMAGE.sprintf(cr)))
		return;
	// do not check for plugin deletion here
	woas.delete_page(cr);
	back_or(woas.config.main_page);
}

// triggered by UI graphic button
function page_print() {
	woas._customized_popup(current, woas.getHTMLDiv(d$("woas_page")),
		'woas={};woas.go_to=function(page){alert("'
		+woas.js_encode(woas.i18n.PRINT_MODE_WARN)+'");}');
}

/*
PVHL: this is incorrect as css_payload will be overwritten by css.get
But why is it here at all? I use custom CSS for TOC -- what did this fix?
My guess is it fixes the print function.
Change to custom help/print css. Read from WoaS::CSS::[Help|Print]
*/
woas._customized_popup = function(page_title, page_body, additional_js,
		additional_css, body_extra) {
	var css_payload = "";
	if (woas.browser.ie && !woas.browser.ie8) {
		if (woas.browser.ie6)
			css_payload = "div.woas_toc { align: center;}";
		else
			css_payload = "div.woas_toc { position: relative; left:25%; right: 25%;}";
	} else
		css_payload = "div.woas_toc { margin: 0 auto;}\n";
	
	if (additional_js.length)
		additional_js = woas.raw_js(additional_js);
	// create the popup
	return woas.popup(
		"print_popup",
		Math.ceil(screen.width*0.75),
		Math.ceil(screen.height*0.75),
		",status=yes,menubar=yes,resizable=yes,scrollbars=yes",
		// head
		"<"+"title>" + page_title + "<"+"/title>" + "<"+"style type=\"text/css\">"
		+ css_payload + woas.css.get() + additional_css +
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
		inline_wsif = false;
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

// workaround to get full file path on FF3
// by Chris
function ff3_getPath(fileBrowser) {
	try {
		netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
	} catch (e) {
	    alert('Unable to access local files due to browser security settings. '
	    +'To overcome this, follow these steps: (1) Enter "about:config" in the URL field; '+ 
	    '(2) Right click and select New->Boolean; (3) Enter "signed.applets.codebase_principal_support" '+
	     '(without the quotes) as a new preference name; (4) Click OK and try loading the file'+
	     ' again.');
	    return false;
	}
	var fileName=fileBrowser.value;
	return fileName;
}

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
	d$.show("loading_overlay");
	d$("loading_overlay").focus();
};

woas.progress_finish = function(section) {
	if (this._progress_section === false) {
		this.crash("Cannot finish an unexisting progress indicator section");
		return;
	}
	// no progress indicators in debug mode
	if (!this.config.debug_mode) {
		document.body.style.cursor = "auto";
		this.setHTML(d$("woas_wait_text"), this.i18n.LOADING);
		// hide the progress area
		d$.hide("loading_overlay");
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
			for(var a=0,at=woas._cached_body_search[i].matches.length;a<at;++a) {
				r += "<"+"pre class=\"woas_nowiki woas_search_results\">" +
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
	this.ui.display(v);
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
			var h = d$("woas_editor").offsetHeight +
				document.documentElement.clientHeight - document.body.offsetHeight;
			// PVHL: stops Opera overflow on resize while editing; don't know why it happens yet
			if (woas.browser.opera) { --h };
			d$("woas_editor").style.height = (h > 64 ? h : 64) + "px";
		}
	}
	return woas.browser.ie6
		// stops initial textarea overflow for IE6
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
		woas.log = function (aMessage) {
			if (typeof aMessage !== "undefined") {
				if (!woas.tweak.integrity_test) {
					// log up to max lines; 'cut' lines removed if too big
					if (++lines === max) { // lines is line count now, before this post
						logbox.value = logbox.value.substring(position);
						lines = max - cut;
					} else if (lines === cut) {
						position = logbox.value.length;
					}
				}
				logbox.value += aMessage + '\n';
			}
			// keep the log scrolled down
			logbox.scrollTop = logbox.scrollHeight;
			if(window.opera)
				opera.postError(aMessage);
			return true;
		};
		// activate debug icon
		d$.show("woas_debug");
		if (!closed) { d$.show("woas_debug_console")
		} else {  d$.hide("woas_debug_console") }
		// hide the progress area
		d$.hide("loading_overlay");
	} else {
		d$.hide("woas_debug");
		d$.hide("woas_debug_console");
		logbox.value = '';
		woas.log = function() { return false; };
	}
	window.log = woas.log // for deprecated function - legacy.js
};

woas.refresh_menu_area = function() {
	var tmp = this.current_namespace;
 	this.current_namespace = this.parser.marker;
	this._add_namespace_menu(tmp);
	var menu = this.get_text("::Menu");
	if (menu == null)
		this.setHTMLDiv(d$("woas_menu"), "");
	else {
		this.parser._parsing_menu = true;
		this.setHTMLDiv(d$("woas_menu"), this.parser.parse(menu, false, this.js_mode("::Menu")));
		this.parser._parsing_menu = false;
		this.scripting.clear("menu");
		this.scripting.activate("menu");
	}
};

woas._gen_display = function(id, visible, prefix) {
	if (visible)
		d$.show(prefix+"_"+id, true);
	else
		d$.hide(prefix+"_"+id);
};

// adapted by PVHL from: weston.ruter.net/2009/05/07/detecting-support-for-data-uris
woas.ui.img_display = function() {
	function loaded(el){ /*alert(el.width+" "+el.height);*/
		if (el.width !== 1 || el.height !== 1) {
			woas.ui.display({no_img: true}, false);
		}
	}
	var data = new Image();
	data.onload = function() {/*alert("onload");*/loaded(this);}
	data.onerror = function() {/*alert("onerror");*/loaded(this);}
	data.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
};

woas.menu_display = function(id, visible, opaque) {
	// menu images now controlled through anchor tag; dim instead of hiding
	//visible ? d$.show("woas_"+id, true) : d$.hide("woas_"+id);
	i=id;id = d$('woas_' + id);
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
	if (window.console) console.log(i+" "+opaque+"  '"+ic + "'  " + p + "  '"+id.className+"'");
	//visible ? woas.ui.set_css("woas_" + id, visible);
};

woas.refresh_mts = function(mts) {
	// generate the last modified string to append
	if (mts) {
		this.setHTMLDiv(d$("woas_mts"), this.last_modified(mts));
		d$.show("woas_mts");
	} else
		d$.hide("woas_mts");
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

// called from Special::Lock page
function _lock_page() {
	// do not call if not on a page locking context
	if (current.indexOf("Lock::")!==0)
		return;
	var page = current.substring(6);

	d$("btn_lock").value = "Lock "+page;
	d$("pw1").focus();
	//TODO: check for other browsers too
	if (woas.browser.firefox)
		d$("btn_lock").setAttribute("onclick", "lock_page('"+woas.js_encode(page)+"')");
	else
		d$("btn_lock").onclick = woas._make_delta_func('lock_page', "'"+woas.js_encode(page)+"'");
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

// get file URL from input XHTML element
// this might not work on some browsers
// not to be called for Mozilla-based browsers
woas.get_input_file_url = function() {
	var r = false;
	if (this.browser.opera || this.browser.webkit) {
		// ask user for path, since browser do not allow us to see where file really is
		r = d$("filename_").value;
		r = prompt(this.i18n.ALT_BROWSER_INPUT.sprintf(this.basename(r)), this.ROOT_DIRECTORY);
		if ((r === null) || !r.length)
			r = false;
		else
			this._last_filename = r;
	} else { // we have requested a direct read of the file from the input object
		r = d$("filename_").value;
		if (!r.length)
			r = false;
	}
	if (r === false)
		this.alert(this.i18n.FILE_SELECT_ERR);
	return r;
};

/*
woas.css.ff2 (string:valid CSS): css added if browser == ff2 when !raw 
woas.css.set(css, raw)
  css (string:valid CSS): the raw css to be set; replaces old css
  raw (boolean, optional): if true browser fixes will not be applied to css
woas.css.get(): returns currently set CSS (string:valid CSS)
*/
//FIXME: could be part of woas.ui object
woas.css = {
	FF2: "\n.woas_nowiki { white-space: -moz-pre-wrap !important; }\n",
	IE: "\n.woas_nowiki { word-wrap: break-word !important; }\n",
	OPERA: "\n.woas_nowiki { white-space: -o-pre-wrap !important; }\n",
	
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
			if (woas.browser.chrome || woas.browser.safari)
				woas.dom._cache.stylesheet.innerText = css;
			else
				woas.dom._cache.stylesheet.innerHTML = css;
		}
	},
	
	// Not used/needed in public API; can't easily fix this with current code.
	// Can't see this being a problem though.
	get: function() {
		if (woas.browser.ie)
			return woas.dom._cache.stylesheet.cssText;
		// on Chrome/Safari innerHTML contains br tags
		if (woas.browser.chrome || woas.browser.safari)
			return woas.dom._cache.stylesheet.innerText;
		return woas.dom._cache.stylesheet.innerHTML;
	}
};

/*
woas.ui.display() closure
	pfx:(private) defines the prefix that will be added to all CSS classes
	state: (private) used to track current control state
	dsp: object passed to display to set new state;
	       - any dsp key that tests true is set in state
		   - any dsp key that tests false is reset in state if it exists
*/
(function() {
	var pfx = 'woas_',
		state = {};
	woas.ui.display = function(dsp) {
		var clas, s = [];
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
}())