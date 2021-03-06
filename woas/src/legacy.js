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

// old tables parsing syntax - DEPRECATED
var reReapTables = /^\{\|.*((?:\n\|.*)*)$/gm,
	reReapTableRows = /\n\|([+ -])(.*)/g;
woas.parser.parse_tables =  function (str, p1) {
	var caption = false,
		stk = [];
	p1.replace(reReapTableRows, function(str, pp1, pp2) {
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
		return  '<'+'table class="woas_text_area">' +
				(caption?('<'+'caption>' + caption + '<'+'/caption>'):'') +
				'<'+'tr>' + stk.join('<'+'/tr><'+'tr>') + '<'+'/tr>' +
			'<'+'/table>';
	return str;
};
