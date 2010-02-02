/* This file contains javascript used by user interface */
// no references to 'this' are allowed - global woas object is used

// when home is clicked
function home()
{
	go_to(main_page);
}

// when Advanced is clicked
function advanced()
{
	go_to("Special::Advanced");
}

// follows a link
function go_to(cr)
{
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
function go_back()
{
	if(backstack.length > 0)
	{
		forstack.push(current);
		woas.set_current(backstack.pop(), true);
		return true;
	}
	return false;
}

// when Forward button is clicked
function go_forward()
{
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

function save() {
	woas.save();
}

// when edit is clicked
function edit() {	woas.edit_page(current);	}

function lock() {
	if (result_pages.length)
		_lock_pages(result_pages);
	else
		go_to("Lock::" + current);
}

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

//TODO: make procedural
function open_table_help() {
	var w = woas.popup("help", 350, 200, ",menubar=no,toolbar=no,location=no,status=no,dialog=yes", 
	"<html><head><title>Building tables<\/title><\/head><body>"
	+"<u>Building tables:<\/u><br /><br />"
	+"<tt>{|   <\/tt><br />"
	+"<tt>|+ Table Caption<\/tt><br />"
	+"<tt>| *colum 1* || *column 2* || *column 3*<\/tt><br />"
	+"<tt>|-<\/tt><br />"
	+"<tt>| line 2 || [[a link]] || something<\/tt><br />"
	+"<tt>|-<\/tt><br />"
	+"<tt>| line 3 || || more stuff<\/tt><br />"
	+"<tt>|}   <\/tt>"
	+"<\/body><\/html>"
	);
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
	var filename = $("filename_").value;
	if(filename == "") {
		alert(woas.i18n.FILE_SELECT_ERR);
		return false;
	}
	return woas.import_wiki(filename);
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
		log("pwstrength = "+(pwstrength/100).toFixed(2)+", repco = "+repco);	// log:1
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
	$.show('loading_overlay');
	// clear the partial display and put in the whole file content
	woas.setHTML($('_part_display'), '');
	woas.setHTML($('_file_ct'), woas.xhtml_encode(decode64(text)));
	// finished loading the file
	$.hide('loading_overlay');
}

// used in path normalization during export
var _g_slash_c = (navigator.appVersion.indexOf("Win")!=-1)?"\\":"/";

// the export path used by export feature
var _g_exp_path = _get_this_filename().
	replace(new RegExp("\\"+_g_slash_c+"[^\\"+_g_slash_c+"]*$"),
				(_g_slash_c=="\\"?"\\\\":"/"));

function query_export_file(cr) {
	var fn = cr.substr(cr.indexOf("::")+2);
	if (confirm(woas.i18n.CONFIRM_EXPORT+"\n\n\""+_g_exp_path+fn))
		woas.export_file(cr, _g_exp_path+fn);
}

function query_export_image(cr) {
	var img_name = cr.substr(cr.indexOf("::")+2);
	if (confirm(woas.i18n.IMAGE_CONFIRM_EXPORT+"\n\n\""+_g_exp_path+img_name))
		woas.export_file(cr, _g_exp_path+img_name);
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
		">"+woas.i18n.FILE_SIZE+": "+_convert_bytes((tot_len-enc_len*3)/4)+
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
	if (ie && !ie8) {
		if (ie6)
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

// get path of current WoaS file (through browser)
function _get_this_path() {
	var slash_c = (navigator.appVersion.indexOf("Win")!=-1)?"\\\\":"/";
	return _get_this_filename().replace(new RegExp("("+slash_c+")"+"[^"+slash_c+"]*$"), "$1");
}

woas["export_wiki_wsif"] = function () {
	var path, author, single_wsif, inline_wsif;
	try {
		path = $("woas_ep_wsif").value;
		author = this.trim($("woas_ep_author").value);
		single_wsif = $("woas_cb_single_wsif").checked ? true : false;
		inline_wsif = $("woas_cb_inline_wsif").checked ? true : false;
	} catch (e) { this.crash(e); return false; }
	
	// block interaction for a while
	$.show("loading_overlay");
	$("loading_overlay").focus();
	
	var done = this._native_wsif_save(path, single_wsif, inline_wsif, author, false);

	$.hide("loading_overlay");
	this.alert(this.i18n.EXPORT_OK.sprintf(done));
	return true;
}

function import_wiki_wsif() {
	if (!woas.config.permit_edits) {
		this.alert(woas.i18n.READ_ONLY);
		return false;
	}
	var filename = $("filename_").value;
	if (!filename.length) {
		woas.alert(woas.i18n.FILE_SELECT_ERR);
		return false;
	}
	// block interaction for a while
	$.show("loading_overlay");
	$("loading_overlay").focus();
	var done;
	if (!confirm(woas.i18n.CONFIRM_IMPORT_OVERWRITE))
		done = false;
	else {
		done = woas._native_wsif_load(filename, true);
		if (done === false)
			woas.crash(woas.wsif.emsg);
	}

	$.hide("loading_overlay");
	if (done !== false)
		woas.alert(woas.i18n.IMPORT_OK.sprintf(done));
	return done;
}
