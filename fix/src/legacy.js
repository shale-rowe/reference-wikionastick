// deprecated/legacy functions

// All the functions in this file are still supported but deprecated.
// They will be removed from WoaS before version 1.0

// var log = woas.log; set by woas._set_debug

d$.clone = function(o) {
	woas.log("WARNING: Called deprecated function: d$.clone (now woas.clone)");
	return woas.clone(o);
};
function bool2chk(b) {
	woas.log("WARNING: Called deprecated function: bool2chk (now woas.bool2chk)");
	woas.bool2chk(b);
}
function _set_layout(fixed) {
	woas.log("WARNING: Called deprecated function: _set_layout (now woas.ui.set_layout)");
	woas.ui.set_layout(fixed);
}
function home() {
	woas.log("WARNING: Called deprecated function: home (now woas.ui.home)");
	woas.ui.home();
}
function help() {
	woas.log("WARNING: Called deprecated function: help (now woas.ui.help)");
	woas.ui.help();
}
function advanced() {
	woas.log("WARNING: Called deprecated function: advanced (now woas.ui.advanced)");
	woas.ui.advanced();
}
function go_to(t) {
	woas.log("WARNING: Called deprecated function: go_to (now woas.go_to(t))");
	return woas.go_to(t);
}
function go_back() {
	woas.log("WARNING: Called deprecated function: go_back (now woas.ui.back)");
	woas.ui.back();
}
function go_forward() {
	woas.log("WARNING: Called deprecated function: go_forward (now woas.ui.forward)");
	woas.ui.forward();
}
function edit() {
	woas.log("WARNING: Called deprecated function: edit (now woas.ui.edit)");
	woas.ui.edit();
}
function lock() {
	woas.log("WARNING: Called deprecated function: lock (now woas.ui.lock)");
	woas.ui.lock();
}
function unlock() {
	woas.log("WARNING: Called deprecated function: unlock (now woas.ui.unlock)");
	woas.ui.unlock();
}
function save() {
	woas.log("WARNING: Called deprecated function: save (now woas.save)");
	woas.save();
}
// old tables parsing syntax
woas.parser.reReapTables = /^\{\|.*((?:\n\|.*)*)$/gm;
woas.parser.reReapTableRows = /\n\|([+ -])(.*)/g;
woas.parser.parse_tables =  function (str, p1) {
	var caption = false,
		stk = [];
	p1.replace(woas.parser.reReapTableRows, function(str, pp1, pp2) {
			if (pp1 == '-')
				return;
			else if (pp1 == '+') {
				caption = caption || pp2;
				return;
			}
			stk.push('<'+'td>' + pp2.split('||').join('<'+'/td><'+'td>') + '<'+'/td>');
		} 
	);
	if (stk.length)
		return  '<' + 'table class="woas_text_area">' + (caption?('<' + 'caption>' + caption +
			'<' + '/caption>'):'') + '<' + 'tr>' + stk.join('<' + '/tr><' + 'tr>') + '<' +
			'/tr>' + '<' + '/table>' + woas.parser.NL_MARKER;
	return str;
};
woas.refresh_menu_area = function() {
	woas.log("WARNING: Called deprecated function: woas.refresh_menu_area (now woas.ui.refresh_menu)");
	this.ui.refresh_menu();
}
