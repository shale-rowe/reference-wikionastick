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
	woas.save_to_file(false);
	woas.set_current("Special::Advanced", true);
}

function ro_woas() {
	if (!woas.config.permit_edits) {
		alert(woas.i18n.WRITE_PROTECTED);
		return false;
	}
	if (confirm(woas.i18n.CONFIRM_READ_ONLY)) {
		woas.config.permit_edits = false;
		woas.save_to_file(false);
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
		alert("This Wiki on a Stick is read-only");
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
