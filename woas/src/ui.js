/* This file contains javascript used by user interface */
// no references to 'this' are allowed - global woas object is used

// when home is clicked
function home() {
	go_to(main_page);
}

// when Advanced is clicked
function advanced() {
	go_to("Special::Advanced");
}

// follows a link
function go_to(cr) {
	if(cr == current)
		return;
	history_mem(current);
	forstack = [];
	woas.set_current(cr, true);
}

function back_or(or_page) {
	if (!go_back())
		woas.set_current(or_page, true);
}

// when Back button is clicked
function go_back() {
	if(backstack.length > 0) {
		forstack.push(current);
		woas.set_current(backstack.pop(), true);
		return true;
	}
	return false;
}

// when Forward button is clicked
function go_forward() {
	if(forstack.length > 0)
	{
		history_mem(current);
		woas.set_current(forstack.pop(), true);
	}
}

// when cancel is clicked
function cancel() {
	if (!confirm("Are you sure you want to cancel this edit?"))
		return;
	if (kbd_hooking)
		woas.disable_edit();
}

//DEPRECATED
function save() {
	woas.save();
}

// when edit is clicked
//DEPRECATED
function edit() {	woas.edit_page(current);	}

//DEPRECATED
function lock() {
	if (result_pages.length)
		_lock_pages(result_pages);
	else
		go_to("Lock::" + current);
}

//DEPRECATED
function unlock() {
	if (result_pages.length)
		_unlock_pages(result_pages);
	else
		go_to("Unlock::" + current);
}

function menu_dblclick() {
	if (!woas.config.dblclick_edit)
		return false;
	edit_menu();
	return true;
}

function ns_menu_dblclick() {
	if (!woas.config.dblclick_edit)
		return false;
	edit_ns_menu();
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

function edit_ns_menu() {
	woas.edit_page(current_namespace+"::Menu");
}

/** Used by search box **/

function menu_search_focus(f) {
	if (f) {
		if (current == "Special::Search") {
//		ff_fix_focus();
			$('string_to_search').focus();
		} else
			search_focused = true;
	} else {
		if (current != "Special::Search")
			search_focused = false;
	}
}

function menu_do_search() {
    if (current == "Special::Search") {
	$('string_to_search').value = $('menu_string_to_search').value;
       do_search($('menu_string_to_search').value);
    } else {
	_raw_do_search($('menu_string_to_search').value);
    }
}

function _raw_do_search(str) {
       cached_search = woas.parser.parse(woas.special_search( str ));
       woas.assert_current("Special::Search");
}

// Used by Special::Search
// make the actual search and cache the results
function do_search() {
	var search_string = $("string_to_search").value;
	if ( !search_string.length )
		return;
	_raw_do_search(search_string);
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

function open_table_help() {
	woas.popup("help", 350, 200, ",menubar=no,toolbar=no,location=no,status=no,dialog=yes", 
	"<title>Building tables<\/title>",
	"<u>Building tables:<\/u><br /><br />"
	+"<tt>{|   <\/tt><br />"
	+"<tt>|+ Table Caption<\/tt><br />"
	+"<tt>| *colum 1* || *column 2* || *column 3*<\/tt><br />"
	+"<tt>|-<\/tt><br />"
	+"<tt>| line 2 || [[a link]] || something<\/tt><br />"
	+"<tt>|-<\/tt><br />"
	+"<tt>| line 3 || || more stuff<\/tt><br />"
	+"<tt>|}   <\/tt>");
}

// Used by Special::Lock
function lock_page(page) {
	var pwd = $("pw1").value;
	if (!pwd.length) {
		$("pw1").focus();
		return;
	}
	if (pwd!=$("pw2").value) {
		$("pw2").focus();
		return;
	}
	var pi = woas.page_index(page);
	AES_setKey(pwd);
	woas._finalize_lock(pi);
}

// import wiki from external file
function import_wiki() {
	if (!woas.config.permit_edits) {
		alert(woas.i18n.READ_ONLY);
		return false;
	}
	return woas.import_wiki();
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
//		log("pwstrength = "+(pwstrength/100).toFixed(2)+", repco = "+repco);	// log:1
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

// used by embedded file show page
function show_full_file(pi) {
	var text = woas.get__text(pi);
	if (text==null)
		return;
	// put WoaS in loading mode
	this.progress_init("Loading full file");
	// clear the partial display and put in the whole file content
	woas.setHTML($('_part_display'), '');
	woas.setHTML($('_file_ct'), woas.xhtml_encode(decode64(text)));
	// finished loading the file
	this.progress_finish();
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
	woas.delete_page(cr);
	back_or(main_page);
}

// delayed function called after page loads and runs the script tag
function _img_properties_show(mime, tot_len, enc_len, mts) {
	var img=$('img_tag');
	woas.setHTML($('img_desc'),
		woas.i18n.MIME_TYPE+": "+mime+"<br /"+
		">"+woas.i18n.FILE_SIZE+": about "+_convert_bytes(((tot_len-enc_len)*3)/4)+
		woas.i18n.B64_REQ.sprintf(_convert_bytes(tot_len))+
	"<br />"+woas.last_modified(mts)+
	"<br />"+woas.i18n.WIDTH+": "+img.width+"px<br />"+woas.i18n.HEIGHT+": "+img.height+"px");
}

function query_delete_image(cr) {
	if (!confirm(woas.i18n.CONFIRM_DELETE_IMAGE.sprintf(cr)))
		return;
	woas.delete_page(cr);
	back_or(main_page);
}

// triggered by UI graphic button
function page_print() {
	var css_payload = "";
	if (woas.browser.ie && !woas.browser.ie8) {
		if (woas.browser.ie6)
			css_payload = "div.wiki_toc { align: center;}";
		else
			css_payload = "div.wiki_toc { position: relative; left:25%; right: 25%;}";
	} else
		css_payload = "div.wiki_toc { margin: 0 auto;}\n";
	// create the popup
	woas.popup("print_popup", Math.ceil(screen.width*0.75),Math.ceil(screen.height*0.75),
						",status=yes,menubar=yes,resizable=yes,scrollbars=yes",
						// head
						"<title>"+current+"</title>"+"<st"+"yle type=\"text/css\">"+
						css_payload+_css_obj().innerHTML+"</sty"+"le>"+
						woas.raw_js("function go_to(page) { alert(\""+woas.js_encode(woas.i18n.PRINT_MODE_WARN)+"\");}"),
						// body
						$("wiki_text").innerHTML);
}

// below functions used by Special::Export

woas["export_wiki_wsif"] = function () {
	var path, author, single_wsif, inline_wsif;
	try {
		path = $("woas_ep_wsif").value;
		author = this.trim($("woas_ep_author").value);
		single_wsif = $("woas_cb_single_wsif").checked ? true : false;
		inline_wsif = $("woas_cb_inline_wsif").checked ? true : false;
	} catch (e) { this.crash(e); return false; }
	
	var done = this._native_wsif_save(path, single_wsif, inline_wsif, author, false);

	this.alert(this.i18n.EXPORT_OK.sprintf(done));
	return true;
}

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
	return fileName
}

var _wsif_js_sec = {
	"comment_js": true,
	"comment_macros": true,
	"woas_ns": true
};

// apply some javascript security settings
function _import_wsif_pre_hook(NP) {
	// comment out all javascript blocks
	var snippets = [];
	// put away text in nowiki blocks
	var page = NP.page.replace(reNowiki, function (str, $1) {
		var r = "<!-- "+parse_marker+"::"+snippets.length+" -->";
		snippets.push($1);
		return r;
	});
	if (_wsif_js_sec.comment_js) {
		page = page.replace(reScripts, "<disabled_script$1>$2</disabled_script>");
		NP.modified = true;
	}
	if (_wsif_js_sec.comment_macros) {
		page = page.replace(reMacros, "<<< Macro disabled\n$1>>>");
		NP.modified = true;
	}
	if (_wsif_js_sec.woas_ns) {
		if (NP.title.match(/^WoaS::/))
			return false;
	}
	if (NP.modified) {
		// put back in place all HTML snippets
		if (snippets.length>0) {
			NP.page = page.replace(new RegExp("<\\!-- "+parse_marker+"::(\\d+) -->", "g"), function (str, $1) {
				return snippets[$1];
			});
		} else
			NP.page = page;
	}
	return true;
}

function import_wiki_wsif() {
	if (!woas.config.permit_edits) {
		this.alert(woas.i18n.READ_ONLY);
		return false;
	}
	
	var done;
	if (!confirm(woas.i18n.CONFIRM_IMPORT_OVERWRITE))
		done = false;
	else {
		// grab settings
		_wsif_js_sec.comment_js = $("woas_cb_import_comment_js").checked;
		_wsif_js_sec.comment_macros = $("woas_cb_import_comment_macros").checked;
		_wsif_js_sec.comment_woas_ns = $("woas_cb_import_woas_ns").checked;
		// automatically retrieve the filename (calls load_file())
		done = woas._native_wsif_load(null, $("woas_cb_import_overwrite").checked, true, false,
				_import_wsif_pre_hook);
		if (done === false)
			woas.crash(woas.wsif.emsg);
	}

	if (done !== false) {
		// add some info about total pages
		if (woas.wsif.expected_pages !== null)
			done = String(done)+"/"+woas.wsif.expected_pages;
		woas.alert(woas.i18n.IMPORT_OK.sprintf(done, woas.wsif.system_pages));
	}
	return done;
}

// create a centered popup given some options
woas["popup"] = function(name,fw,fh,extra,head,body) {
	var hpos=Math.ceil((screen.width-fw)/2);
	var vpos=Math.ceil((screen.height-fh)/2);
	var wnd = window.open("about:blank",name,"width="+fw+",height="+fh+		
	",left="+hpos+",top="+vpos+extra);
	wnd.focus();
	wnd.document.writeln(this.DOCTYPE+"<ht"+"ml><he"+"ad>"+head+"</h"+"ead><"+"body>"+
						body+"</bod"+"y></h"+"tml>\n");
	wnd.document.close();
	return wnd;
}

// tell user how much work was already done
woas["progress_status"] = function (ratio) {
	this.setHTML($("woas_wait_text"), this._progress_section + "\n" +
				Math.ceil(ratio*100)+"% done");
}

// used to debug progress indicators
woas["_progress_section"] = false;

// reset progress indicator
woas["progress_init"] = function(section) {
	if (this._progress_section !== false) {
		this.crash("Progress indicator already started for "+this._progress_section+
					", will not start a new one for "+section)
		return;
	}
	this._progress_section = section;
	if (typeof section == "undefined")
		section = "";
	else section = "\n" + section;
	this.setHTML($("woas_wait_text"), section);
	document.body.style.cursor = "wait";
	// put in busy mode and block interaction for a while
	$.show("loading_overlay");
	$("loading_overlay").focus();
}

woas["progress_finish"] = function(section) {
	if (this._progress_section === false) {
		this.crash("Cannot finish an unexisting progress indicator section");
		return;
	}
	$.hide("loading_overlay");
	document.body.style.cursor = "auto";
	this.setHTML($("woas_wait_text"), this.i18n.LOADING);
	this._progress_section = false;
}
