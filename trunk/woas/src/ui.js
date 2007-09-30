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
	woas.set_current(cr);
}

function back_or(or_page) {
	if (!go_back())
		woas.set_current(or_page);
}

// when Back button is clicked
function go_back()
{
	if(backstack.length > 0)
	{
		forstack.push(current);
		woas.set_current(backstack.pop());
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
		woas.set_current(forstack.pop());
	}
}

// when cancel is clicked
function cancel() {
//	if(confirm("Are you sure you want to cancel this edit?")) 
	if (kbd_hooking)
		woas.disable_edit();
}

function save() { woas.save(); }

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
	if (!this.config.dblclick_edit)
		return false;
	edit_menu();
	return true;
}

function ns_menu_dblclick() {
	if (!this.config.dblclick_edit)
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
//          ff_fix_focus();
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

function menu_key_hook(orig_e) {
    var e;
    if (!orig_e)
        e = window.event;
    else
        e = orig_e;
	
    if (e.keyCode==13) {
	ff_fix_focus();
	_raw_do_search($('menu_string_to_search').value);
        return false;
     }
     return orig_e;
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
	if (!woas.config.permit_edits)
		return false;
	woas.save_to_file(false);
	woas.set_current("Special::Advanced");
}

function ro_woas() {
	if (!woas.config.permit_edits) {
		alert("Sorry, this WoaS is already write-protected");
		return false;
	}
	woas.config.permit_edits = false;
	woas.save_to_file(false);
	woas.set_current("Special::Advanced");
}
