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
		alert("This Wiki on a Stick is read-only");
		return false;
	}
	woas.save_to_file(false);
	woas.set_current("Special::Advanced", true);
}

function ro_woas() {
	if (!woas.config.permit_edits) {
		alert("Sorry, this WoaS is already write-protected");
		return false;
	}
	if (confirm("Are you sure you want to set this WoaS as read-only? You will have to manually edit the file to revert this change.")) {
		woas.config.permit_edits = false;
		woas.save_to_file(false);
		woas.set_current("Special::Advanced", true);
	}
}

//TODO: make procedural
function open_table_help() {
	var w = woas.popup("help", 350, 200, ",menubar=no,toolbar=no,location=no,status=no,dialog=yes");
	w.document.writeln("<html><head><title>Building tables<\/title><\/head><body>");
	w.document.writeln("<u>Building tables:<\/u><br /><br />");
	w.document.writeln("<tt>{|   <\/tt><br />");
	w.document.writeln("<tt>|+ Table Caption<\/tt><br />");
	w.document.writeln("<tt>| *colum 1* || *column 2* || *column 3*<\/tt><br />");
	w.document.writeln("<tt>|-<\/tt><br />");
	w.document.writeln("<tt>| line 2 || [[a link]] || something<\/tt><br />");
	w.document.writeln("<tt>|-<\/tt><br />");
	w.document.writeln("<tt>| line 3 || || more stuff<\/tt><br />");
	w.document.writeln("<tt>|}   <\/tt>");
	w.document.writeln("<\/body><\/html>");
	w.document.close();
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


function import_wiki() {
	if (!woas.config.permit_edits) {
		alert("This Wiki on a Stick is read-only");
		return false;
	}
	var filename = $("filename_").value;
	if(filename == "") {
		alert("A file must be selected");
		return false;
	}
	return woas.import_wiki(filename);
}

function set_key() {
	woas._set_password();
}