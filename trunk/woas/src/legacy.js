// deprecated/legacy functions

//DEPRECATED but still supported
var log = woas.log;

//DEPRECATED
function home() {
	woas.log("WARNING: Called deprecated function: home");
	woas.ui.home();
}

//DEPRECATED
function help() {
	woas.log("WARNING: Called deprecated function: help");
	woas.ui.help();
}

// when Advanced is clicked
//DEPRECATED
function advanced() {
	woas.log("WARNING: Called deprecated function: advanced");
	woas.ui.advanced();
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
function go_forward() {
	woas.log("WARNING: Called deprecated function: go_forward");
	woas.ui.forward();
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
