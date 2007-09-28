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
	edit_page("::Menu");
}

function edit_ns_menu() {
	edit_page(current_namespace+"::Menu");
}
