/*
 * User Interface module
*/

woas.ui = {
	edit_mode: false,		// set to true when inside an edit textarea
	_textbox_focus: false,	// true when a text box is currently focused
	focus_textbox: function() { // called when a textbox has currently focus
		this._textbox_focus = true;
	},
	blur_textbox: function() { // called when a textbox looses focus
		this._textbox_focus = false;
		ff_fix_focus();
		// reset event handler
		this._textbox_enter_event = this._textbox_enter_event_dummy;
	},
	// event (to be overriden) to run in case of enter key pressed
	// for example, searching
	_textbox_enter_event_dummy: function() {
	},
	_textbox_enter_event: this._textbox_enter_event_dummy,
	
	// custom event handler which can be overriden to process the keypresses
	_custom_key_hook: function(orig_e) {
		// continue parsing as normal
		return true;
	},
	
	// event called on key press
	//NOTE: since this is attached directly to DOM, you should not use 'this'
	_keyboard_event_hook: function(orig_e) {
		if (!orig_e)
			e = window.event;
		else
			e = orig_e;
		
		if (!woas.ui.edit_mode) {
			// there is a custom focus active, call the hook
			// and return if it told us to do so
			if (!woas.ui._custom_key_hook(orig_e))
				return orig_e;
			if (woas.ui._textbox_focus) {
				// return key
				if (e.keyCode==13) {
					// clear focus
					ff_fix_focus();
					// run attached event
					(woas.ui._textbox_enter_event)();
					return false;
				}
				return orig_e;
			}
			// back or cancel keys
			if ((e.keyCode == woas.hotkey.all.back) || (e.keyCode == woas.hotkey.all.cancel)) {
				go_back();
				ff_fix_focus();
				return false;
			}
		}

		// cancel key
		if (e.keyCode==woas.hotkey.all.cancel) {
			woas.ui.cancel();
			ff_fix_focus();
			return false;
		}

		return orig_e;
	},
	tables_help: function() {
		woas.help_system.go_to("WoaS::Help::Tables");
	},
	clear_search: function() {
		woas.log("Clearing search"); //log:1
		if (current === "Special::Search") {
			d$("string_to_search").value = "";
			d$("string_to_search").focus();
		}
		// clear search results
		woas._cached_body_search = [];
		woas._cached_title_search = [];
		woas._last_search = null;
		woas.pager.bucket.clear();
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
	// used by Special::Import
	_import_xhtml_load: function() {
		this._import_load(0);
	},
	// used by Special::ImportWSIF
	_import_wsif_load: function() {
		this._import_load(3);
	},
	
	_import_load: function(except) {
		if (!woas.config.permit_edits)
			d$("btn_import").disabled = true;
		// restore default settings - with some exceptions
		for(var i=0;i < woas.importer._settings_props.length-except;++i) {
			d$("woas_cb_import"+woas.importer._settings_props[i].substr(1)).checked =
							woas.bitfield.get(woas.config.import_settings, i);
		}
		// restore the overwrite option which covers other 2 bits
		var ovr = 0;
		if (woas.bitfield.get(woas.config.import_settings, woas.importer._OVR_ID))
			ovr += 1;
		if (woas.bitfield.get(woas.config.import_settings, woas.importer._OVR_ID+1))
			ovr += 2;
		var params = ["erase", "ignore", "overwrite", "ask"];
		// apply parameter
		d$('woas_import_'+params[ovr]).checked = true;
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
			woas._ghost_page = false;
			woas.log("Ghost page disabled"); //log:1
		}
		woas.disable_edit();
		current = woas.prev_title;
	},
	// when back button is clicked
	back: function() {
		if (this.edit_mode)
			return false;
		var p = woas.history.back();
		if (p === null)
			return false;
		woas.history._forward_browse = true;
		return woas.set_current(p, true);
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
		woas.edit_page(current_namespace+"::Menu");
	},
	lock: function() {
		if (woas.pager.bucket.items.length)
			_lock_pages(woas.pager.bucket.items);
		else
			woas.go_to("Lock::" + current);
	},
	unlock: function() {
		if (woas.pager.bucket.items.length)
			_unlock_pages(woas.pager.bucket.items);
		else
			go_to("Unlock::" + current);
	},
	// scroll to top of page
	top: function() {
		scrollTo(0,0);
	}
	
};

//API1.0
woas.go_to = function(cr) {
	if (cr === current)
			return true;
	return this.set_current(cr, true)
};

function back_or(or_page) {
	if (!go_back())
		woas.set_current(or_page, true);
}

// when Forward button is clicked
function go_forward() {
	var _b_current = current,
		p = woas.history.forward();
	if (p === null)
		return false;
	return woas.set_current(p, true)
//	if (woas.set_current(p, true))
//		woas.history.store(_b_current);
}

// when cancel is clicked
function cancel() {
	woas.log("Called deprecated function: cancel");
	woas.ui.cancel();
}

// @module help_system
woas.help_system = {
	popup_window: null,
	page_title: null,
	going_back: false,
	previous_page: [],

	_mk_help_button: function(n) {
		var w = "[[Include::WoaS::Template::Button|";
		if (n)
			w += "Back|help_go_back";
		else
			w += "Close|window.close";
		w += "();]]\n";
		return w;
	},

	_help_lookup: ["Plugins", "CSS", "Aliases", "Hotkeys"],
	cPopupCode: "\n\
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
// used in help popups to go back to previous page\n\
function help_go_back() {\n\
	var woas = get_parent_woas();\n\
	if (woas === null) return;\n\
	if (woas.browser.chrome || woas.browser.safari || woas.browser.opera) {\n\
		woas.help_system.going_back = true;\n\
		woas.help_system.go_to(woas.help_system.previous_page.pop());\n\
		return;\n\
	}\n\
	// this works for other browsers\n\
	scrollTo(0,0);\n\
	history.go(0);\n\
}\n\
",
	go_to: function(wanted_page, pi) {
		if (typeof pi == "undefined")
			pi = woas.page_index(wanted_page);
		var text;
		// this is a namespace
		if (pi === -1) {
			go_to(wanted_page);
			return;
		} else {
			// see if this page shall be opened in the main wiki or in the help popup
			var _pfx = "WoaS::Help::";
			if (page_titles[pi].substr(0, _pfx.length) === _pfx)
				text = woas.get__text(pi);
			else { // open in main wiki
				go_to(page_titles[pi]);
				return;
			}
		}
		if (text === null)
			return;
		// save previous page and set new
		if (this.going_back)
			this.going_back = false;
		else if (this.page_title !== null)
			this.previous_page.push( this.page_title );
		// now create the popup
		if ((this.popup_window === null) || this.popup_window.closed) {
			this.previous_page = [];
			this.popup_window = woas._customized_popup(wanted_page, woas.parser.parse(
					this._mk_help_button(0)+text),
					this.cPopupCode,
				"", " class=\"woas_help_background\"");
		} else { // hotfix the page
			this.popup_window.document.title = wanted_page;
			woas.setHTMLDiv(this.popup_window.document.body, woas.parser.parse(this._mk_help_button(this.previous_page.length)+text));
			this.popup_window.scrollTo(0,0);
		}
		this.page_title = wanted_page;
	}
};

// could have a better name
function help() {
	var wanted_page = "WoaS::Help::Index";
	var pi = woas.page_index(wanted_page);
	// we are editing
	if (woas.ui.edit_mode) {
		wanted_page = "WoaS::Help::Edit a page";
		pi = woas.page_index(wanted_page);
	} else {
		var htitle = null;
		// change the target page in some special cases
		for(var i=0,it=woas.help_system._help_lookup.length;i < it;++i) {
			if (current.substr(0, woas.help_system._help_lookup[i].length) === woas.help_system._help_lookup[i]) {
				htitle = woas.help_system._help_lookup[i];
				break;
			}
		}
		if (htitle === null)
			htitle = current;
		var npi = woas.page_index("WoaS::Help::"+htitle);
		if (npi != -1) {
			wanted_page = "WoaS::Help::"+htitle;
			pi = npi;
		}
	}
	woas.help_system.go_to(wanted_page, pi);
}

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
    woas.do_search(d$('menu_string_to_search').value, true);
}

// Used by Special::Search
// make the actual search and cache the results
function ssearch_do_search() {
	var search_string = d$("string_to_search").value;
	if ( !search_string.length )
		return;
	woas.do_search(search_string, true);
}

function menu_key_hook(orig_e) {
    var e;
    if (!orig_e)
        e = window.event;
    else
        e = orig_e;
	
    if (e.keyCode==13) {
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
	woas.log("Called woas.do_search()");
	// clear previous search results
	if (!noclear)
		woas.ui.clear_search();

	woas.progress_init("Searching");
	// reset result pages
	result_pages = [];

	// cache new search results
	woas._cache_search( str );
	woas.progress_finish();

	// refresh the search page, or go to it if we are not
	woas.ui._search_render();
}

// Used by Special::Options page
function save_options() {
	if (!woas.config.permit_edits) {
		alert(woas.i18n.READ_ONLY);
		return false;
	}
	woas.cfg_commit();
	woas.set_current("Special::Advanced", true);
}

function ro_woas() {
	if (!woas.config.permit_edits) {
		alert(woas.i18n.WRITE_PROTECTED);
		return false;
	}
	if (confirm(woas.i18n.CONFIRM_READ_ONLY)) {
		woas.config.permit_edits = false;
		woas.cfg_commit();
		woas.set_current("Special::Advanced", true);
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

// import wiki from external file
function import_wiki() {
	if (!woas.config.permit_edits) {
		alert(woas.i18n.READ_ONLY);
		return false;
	}
	woas.import_wiki();
	woas.refresh_menu_area();
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
	woas._customized_popup(current, woas.getHTMLDiv(d$("woas_wiki_area")), 
			"function go_to(page) { alert(\""+woas.js_encode(woas.i18n.PRINT_MODE_WARN)+"\");}");
}

woas._customized_popup = function(page_title, page_body, additional_js, additional_css, body_extra) {
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
		"<"+"/sty" + "le>" + additional_js,
		page_body,
		body_extra
	);
};

// below functions used by Special::Export

woas.export_wiki_wsif = function () {
	var path, author, single_wsif, inline_wsif;
	try {
		path = d$("woas_ep_wsif").value;
		author = this.trim(d$("woas_ep_author").value);
		single_wsif = d$("woas_cb_single_wsif").checked ? true : false;
		inline_wsif = d$("woas_cb_inline_wsif").checked ? true : false;
	} catch (e) { this.crash(e); return false; }
	
	var done = this._native_wsif_save(path, this.wsif.DEFAULT_INDEX, false, single_wsif, inline_wsif, author, false);

	this.alert(this.i18n.EXPORT_OK.sprintf(done, this.wsif.expected_pages));
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
woas.popup = function(name,fw,fh,extra,head,body, body_extra) {
	if (typeof body_extra == "undefined")
		body_extra = "";
	var hpos=Math.ceil((screen.width-fw)/2);
	var vpos=Math.ceil((screen.height-fh)/2);
	var wnd = window.open("about:blank",name,"width="+fw+",height="+fh+		
	",left="+hpos+",top="+vpos+extra);
	wnd.focus();
	wnd.document.writeln(this.DOCTYPE+"<"+"html><"+"head>"+head+
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
	var P = {body: ""};
	if (this._last_search === null) {
		woas.log("No search done, returning blank");	//log:1
	} else {
		// proceed to parsing if there are matching pages
		if (this._cached_title_search.length + this._cached_body_search.length !== 0) {
		
			// (1) prepare the title results
			for(var i=0,it=this._cached_title_search.length;i<it;++i) {
				P.body += "* [["+ this._cached_title_search[i] + "]]\n";
				result_pages.push(this._cached_title_search[i]);
			}
			
			// (2) parse the body snippets
			for(var i=0,it=this._cached_body_search.length;i<it;++i) {
				P.body += "* [[" + this._cached_body_search[i].title + "]]: found " + this._hl_marker+":"+i+":";
				if (result_pages.indexOf(this._cached_body_search[i].title) === -1)
					result_pages.push(this._cached_body_search[i].title);
			}

			P.body = 'Results for <'+'strong class="woas_search_highlight">' + woas.xhtml_encode(woas._last_search) + "<"+"/strong>\n" + P.body;
		} else
			P.body = "/No results found for *"+woas.xhtml_encode(woas._last_search)+"*/";

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
						})+"\n<"+"/pre>";
			}
			return " <"+"strong>"+count+"<"+"/strong> times: "+r;
		});
	}
	
	// finally output XHTML content
	woas.setHTML(d$('woas_search_results'), P.body);
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

woas.update_nav_icons = function(page) {
	this.menu_display("back", this.history.has_backstack());
	this.menu_display("forward", this.history.has_forstack());
	this.menu_display("advanced", (page != "Special::Advanced"));
	this.menu_display("edit", this.edit_allowed(page));
	this.update_lock_icons(page);
};

woas.update_lock_icons = function(page) {
	var cyphered, can_lock, can_unlock;
	if (result_pages.length < 2) {
		var pi = this.page_index(page);
		if (pi==-1) {
			can_lock = can_unlock = false;
			cyphered = false;
		} else {
			can_unlock = cyphered = this.is__encrypted(pi);
			can_lock = !can_unlock && this.config.permit_edits;
		}
	} else {
//		woas.log("result_pages is ("+result_pages+")");	// log:0
		can_lock = can_unlock = (result_pages.length>0);
		cyphered = false;
	}
	
	// update the encryption icons accordingly
	this.menu_display("lock", !woas.ui.edit_mode && can_lock);
	this.menu_display("unlock", !woas.ui.edit_mode && can_unlock);
	// we can always input decryption keys by clicking the setkey icon
	//this.menu_display("setkey", cyphered);
	var cls;
	if (cyphered || (page.indexOf("Locked::")==0))
		cls = "woas_text_area locked";
	else
		cls = "woas_text_area";
	d$("woas_wiki_area").className = cls;
};

// when the page is resized
woas._onresize = function() {
	var we = d$("woas_editor");
	we.style.width = window.innerWidth - 30 + "px";
	we.style.height = window.innerHeight - 150 + "px";
};

if (!woas.browser.ie)
	window.onresize = woas._onresize;

woas._set_debug = function(status) {
	if (status) {
		// activate debug panel
		d$.show_ni("woas_debug_panel");
		d$.show("woas_debug_log");
		// hide the progress area
		d$.hide("loading_overlay");
	} else {
		d$.hide_ni("woas_debug_panel");
		d$.hide("woas_debug_console");
	}
};

woas.refresh_menu_area = function() {
	var tmp = current_namespace;
 	current_namespace = this.parser.marker;
	this._add_namespace_menu(tmp);
	var menu = this.get_text("::Menu");
	if (menu == null)
		this.setHTMLDiv(d$("woas_menu_area"), "");
	else {
		this.parser._parsing_menu = true;
		this.setHTMLDiv(d$("woas_menu_area"), this.parser.parse(menu, false, this.js_mode("::Menu")));
		this.parser._parsing_menu = false;
		this.scripting.clear("menu");
		this.scripting.activate("menu");
	}
};

woas._gen_display = function(id, visible, prefix) {
	if (visible)
		d$.show(prefix+"_"+id);
	else
		d$.hide(prefix+"_"+id);
};

woas.img_display = function(id, visible) {
	if (!this.browser.ie || this.browser.ie8) {
		this._gen_display(id, visible, "img");
		this._gen_display(id, !visible, "alt");
	} else {
		this._gen_display(id, !visible, "img");
		this._gen_display(id, visible, "alt");
	}
};

woas.menu_display = function(id, visible) {
	this._gen_display(id, visible, "menu");
//	log("menu_"+id+" is "+d$("menu_"+id).style.display);
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
	var title = woas._prompt_title("Please enter plugin name", "Myplugin");
	if (title === null)
		return;
	var def_text;
	// provide special include page support
	// --UNSUPPORTED FEATURE--
	if (title.charAt(0) === '@') {
		def_text = "plugins/"+title.substr(1)+".js\n";
//		title = title.substr(1);
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
	
	// TODO: replace with factory function for just this browser
	set: function(css, raw) {
		raw = raw || false;
		/*
		This object could become much better in the future, grabbing content
		from appropriate sources, or filtering WoaS::CSS (whatever) to match
		the current browser ... this need only be done once on loading page,
		with a callback function for CSS editing (e.g. woas.css.load and/or
		woas.css.merge, etc.). Note that this change does not affect efficiency
		much but now we can completely change the way this works (over time)
		without having to modify other code. This is generally applicable
		with OOP design concepts. The code is therefore much less fragile
		and many programmers can work on it with changes tending to be much
		more confined to the object they are modifying.
		*/
		//Add fixes
		if (!raw) {
			if (woas.browser.firefox2) {
				// fixes are added first so they can be overridden
				css = this.FF2 + css;
			}
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
