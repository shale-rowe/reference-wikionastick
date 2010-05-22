// deprecated/legacy functions

//DEPRECATED but still supported
var log = woas.log;

//DEPRECATED
function home() {
	woas.log("WARNING: Called deprecated function: home");
	woas.ui.home();
}

// when Advanced is clicked
//DEPRECATED
function advanced() {
	woas.log("WARNING: Called deprecated function: advanced");
	woas.go_to("Special::Advanced");
}

//DEPRECATED
function go_to(t) {
	woas.log("WARNING: Called deprecated function: go_to");
	return woas.go_to(t);
}

//DEPRECATED
function go_back() {
	woas.log("WARNING: Called deprecated function: go_back");
	woas.ui.back();
}
//DEPRECATED
function edit() {
	woas.log("WARNING: Called deprecated function: edit");
	woas.ui.edit();
}

//DEPRECATED
function lock() {
	woas.log("WARNING: Called deprecated function: lock");
	woas.ui.lock();
}

//DEPRECATED
function unlock() {
	woas.log("WARNING: Called deprecated function: unlock");
	woas.ui.unlock();
}

//DEPRECATED
function save() {
	woas.log("WARNING: Called deprecated function: save");
	woas.save();
}
